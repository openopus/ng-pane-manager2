/**********************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (drag-and-drop.ts)
 * Copyright (C) 2019 Opus Logica
 *
 * angular-pane-manager is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * angular-pane-manager is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with angular-pane-manager.  If not, see <https://www.gnu.org/licenses/>.
 *
 *********************************************************************************/

import {Component, ComponentRef, HostListener} from '@angular/core';
import {BehaviorSubject} from 'rxjs';

import {averageTouchPos, beginMouseDrag, beginTouchDrag, DragCancelFn} from './begin-drag';
import {
    NgPaneDropHighlightComponent,
} from './ng-pane-drop-highlight/ng-pane-drop-highlight.component';
import {NgPaneManagerComponent} from './ng-pane-manager/ng-pane-manager.component';
import {NgPaneComponent} from './ng-pane/ng-pane.component';
import {
    childFromId,
    ChildLayout,
    ChildLayoutId,
    LayoutType,
    RootLayout,
    SplitLayout,
    TabbedLayout,
} from './pane-layout/module';
import {clipDenormPos} from './util';

/**
 * Indicates the type of a pane drop target.
 */
export const enum DropTargetType {
    /**
     * The target element is owned by the contents of a pane.
     *
     * **NOTE:** This does _not_ refer to an `NgPaneComponent`, but rather the
     * leaf, split, or tabbed component contained by one.
     */
    Pane,
    /** Similar to `Pane`, but disallows tabbing with the pane */
    PaneNoTab,
    /** The target element is owned by a (non-tabbed) panel header */
    Header,
    /** The target element is owned by a tab in a tab row */
    Tab,
    /** The target element is owned by a tab row (but is not a tab) */
    TabRow,
}

/**
 * Information associated with a hit-testable panel element indicating the
 * properties of the component it belongs to.
 *
 * See `NgPaneManagerComponent.dropTargets`
 */
export interface DropTarget<X> {
    /** The type of the component */
    type: DropTargetType;
    /** The ID of the child layout corresponding to this element */
    id: ChildLayoutId<X>;
}

/** All properties associated with a floating drag-and-drop layout */
interface FloatingInfo<X> {
    /** The layout node removed from the original layout tree */
    readonly layout: ChildLayout<X>;
    /**
     * The ratio of the removed layout node, if it was taken from a split.
     *
     * Note that this ratio has been converted to a percentage from 0.0 to 1.0.
     */
    readonly pct: number;

    /** The floating pane for the removed layout node */
    readonly pane: ComponentRef<NgPaneComponent<X>>;
    /** The drop highlight visual */
    readonly dropHighlight: ComponentRef<NgPaneDropHighlightComponent>;
}

/**
 * Used below to determine how to split or tabify a floating pane when it is
 * dropped.
 */
const enum DropOrientation {
    Left,
    Top,
    Right,
    Bottom,
    Tabbed,
}

/** All basic drop information used regardless of drop orientation. */
interface DropInfoBase<X, O extends DropOrientation = DropOrientation> {
    /** The type and direction of the dropped layout */
    orientation: O;
    /** The layout to modify during the drop */
    layout: ChildLayout<X>;
    /**
     * The element used to determine the drop information.\
     * This element is also used to render the drop highlight visual.
     */
    element: Element;
}

/** Drop information for creating a split layout. */
interface SplitDropInfo<X> extends DropInfoBase<
    X,
    DropOrientation.Left|DropOrientation.Top|DropOrientation.Right|DropOrientation.Bottom> {
    /** The ratio of the removed child as a factor from 0.0 to 1.0 */
    pct: number;
}

/** Drop information for creating a tabbed layout. */
interface TabbedDropInfo<X> extends DropInfoBase<X, DropOrientation.Tabbed> {
    /** The tab index to insert the floating pane at */
    tab: number;
    /**
     * Whether the tab index is before or after the target tab.  A value of
     * `undefined` indicates the target element is not a tab.
     */
    isAfter: boolean|undefined;
}

/** Contains any kind of drop info. */
type DropInfo<X> = SplitDropInfo<X>|TabbedDropInfo<X>;

/** Used below to debounce and differentiate different hover actions. */
const enum HoverActionType {
    None,
    TabSwitch,
}

// None action with left beef
/** Represents no pending hover action */
interface NoneHoverAction {
    /** The action type.  Used for type checking. */
    type: HoverActionType.None;
}

/** Represents a pending tab switch */
interface TabSwitchHoverAction<X> {
    /** The action type.  Used for type checking. */
    type: HoverActionType.TabSwitch;
    /** The tabbed layout to switch.  Used for debouncing. */
    layout: TabbedLayout<X>;
    /** The tab index to switch to.  Used for debouncing. */
    index: number;
    /** The handle for the timeout */
    handle: ReturnType<typeof setTimeout>;
}

/** Contains any type of hover action. */
type HoverAction<X> = NoneHoverAction|TabSwitchHoverAction<X>;

/**
 * Provides an implementation of the callbacks needed for `beginMouseDrag` that
 * actuates dragging and dropping panes within a layout.
 */
export class PaneDragContext<X> {
    /**
     * The original layout, before any action was performed.\
     * Used to recover the original layout if an error occurs.
     */
    private readonly oldLayout: RootLayout<X>;
    /** The floating layout node and all associated properties */
    private floatingInfo: FloatingInfo<X>|undefined;
    /** The information needed to drop the floating layout */
    private dropInfo: DropInfo<X>|undefined;
    /** Any currently ongoing hover action */
    private hoverAction: HoverAction<X> = {type: HoverActionType.None};

    /**
     * Compute the orientation of a dropped panel given the posisition of a drag
     * over the panel's client rectangle.
     * @param x the X coordinate of the drag
     * @param y the Y coordinate of the drag
     * @param rects the client rectangles of the hovered element
     */
    private static computeDropOrientation(x: number, y: number, rects: DOMRectList): DropOrientation
        |undefined {
        const TAB_MARGIN = 0.15;

        if (rects.length === 0) { return undefined; }
        const rect = rects[0];

        const posX = (x - rect.left) / clipDenormPos(rect.width) - 0.5;
        const posY = (y - rect.top) / clipDenormPos(rect.height) - 0.5;

        if (posX >= -TAB_MARGIN && posX < TAB_MARGIN && posY >= -TAB_MARGIN && posY < TAB_MARGIN) {
            return DropOrientation.Tabbed;
        }

        if (Math.abs(posX) > Math.abs(posY)) {
            return posX < 0 ? DropOrientation.Left : DropOrientation.Right;
        }

        return posY < 0 ? DropOrientation.Top : DropOrientation.Bottom;
    }

    /**
     * Compute the orientation of a dropped panel given the posisition of a drag
     * over the panel's client rectangle.
     *
     * Unlike `computeDropOrientation`, this function will never return
     * `DropOrientation.Tabbed`.
     * @param x the X coordinate of the drag
     * @param y the Y coordinate of the drag
     * @param rects the client rectangles of the hovered element
     */
    private static computeSplitDropOrientation(x: number, y: number, rects: DOMRectList):
        DropOrientation.Left|DropOrientation.Top|DropOrientation.Right|DropOrientation.Bottom
        |undefined {
        if (rects.length === 0) { return undefined; }
        const rect = rects[0];

        const posX = (x - rect.left) / clipDenormPos(rect.width) - 0.5;
        const posY = (y - rect.top) / clipDenormPos(rect.height) - 0.5;

        if (Math.abs(posX) > Math.abs(posY)) {
            return posX < 0 ? DropOrientation.Left : DropOrientation.Right;
        }

        return posY < 0 ? DropOrientation.Top : DropOrientation.Bottom;
    }

    /**
     * Compute whether a tab should be inserted to the left or the right of a
     * target given the position of a drag over the target's client rectangle.
     * @param x the X coordinate of the drag
     * @param y the Y coordinate of the drag
     * @param rects the client rectangles of the hovered element
     */
    private static computeTabIsAfter(x: number, _y: number, rects: DOMRectList): boolean|undefined {
        if (rects.length === 0) { return undefined; }
        const rect = rects[0];

        // If the drag is closer to the right edge of the tab,
        // insert the floating pane after it
        return x >= rect.left + rect.width * 0.5;
    }

    /**
     * Construct and initialize a new `PaneDragContext` given a `mousedown`
     * event.
     * @param evt the `mousedown` event to be passed to `beginMouseDrag`
     * @param manager the pane manager hosting the current pane
     * @param id the ID of the pane being dragged
     */
    public static mouseDown<X>(evt: MouseEvent,
                               manager: NgPaneManagerComponent<X>,
                               id: ChildLayoutId<X>): void {
        const ctx = new PaneDragContext(evt.clientX, evt.clientY, manager, id);

        beginMouseDrag(evt, ctx.dragDelta.bind(ctx), ctx.dragEnd.bind(ctx));
    }

    /**
     * Construct and initialize a new `PaneDragContext` given a `touchstart`
     * event.
     * @param evt the `touchstart` event to be passed to `beginTouchDrag`
     * @param manager the pane manager hosting the current pane
     * @param id the ID of the pane being dragged
     */
    public static touchStart<X>(evt: TouchEvent,
                                manager: NgPaneManagerComponent<X>,
                                id: ChildLayoutId<X>): void {
        const target = evt.target instanceof HTMLElement ? evt.target : undefined;
        const [x, y] = averageTouchPos(evt);
        const ctx    = new PaneDragContext(x, y, manager, id, target);

        beginTouchDrag(evt, ctx.dragDelta.bind(ctx), ctx.dragEnd.bind(ctx));
    }

    /**
     * Construct a new PaneDragContext.
     * @param startX the original client X coordinate of the drag
     * @param startY the original client Y coordinate of the drag
     * @param manager the pane manager hosting the current pane
     * @param id the ID of the pane being dragged
     */
    private constructor(private readonly startX: number,
                        private readonly startY: number,
                        private readonly manager: NgPaneManagerComponent<X>,
                        private readonly id: ChildLayoutId<X>,
                        private readonly target?: HTMLElement) {
        this.oldLayout = manager.layout;
    }

    /**
     * Run the specified callback after a delay, then reset the current hover
     * action.
     * @param fn the callback to run
     */
    private runHoverAction(fn: () => void): ReturnType<typeof setTimeout> {
        const HOVER_ACTION_DELAY = 850;

        const handle = setTimeout(() => {
            fn();

            if (this.hoverAction.type !== HoverActionType.None &&
                Object.is(this.hoverAction.handle, handle)) {
                this.hoverAction = {type: HoverActionType.None};
            }
        }, HOVER_ACTION_DELAY);

        return handle;
    }

    /**
     * Drag motion callback.\
     * See `begin-drag.ts`
     */
    private dragDelta(clientX: number, clientY: number, cancel: DragCancelFn): void {
        if (this.floatingInfo === undefined) {
            const DEADBAND = 5;

            if (Math.abs(clientX - this.startX) >= DEADBAND ||
                Math.abs(clientY - this.startY) >= DEADBAND) {
                if (!this.detachPanel(clientX, clientY)) { cancel(true); }
            }
            else {
                return;
            }
        }

        this.computeDropInfo(clientX, clientY);

        this.updateFloatingPane(clientX, clientY);
        this.updateDropHighlight();
    }

    /**
     * Drag end callback.\
     * See `begin-drag.ts`
     */
    private dragEnd(isAbort: boolean): void {
        // Act as a click if the drag never started
        // TODO: move this to beginDrag?
        if (this.floatingInfo === undefined) {
            if (this.target !== undefined) { this.target.click(); }

            return;
        }

        if (isAbort || this.dropInfo === undefined || !this.dropFloatingPane()) {
            this.manager.layout = this.oldLayout;
        }

        this.destroyFloatingInfo();
    }

    /**
     * Detach the target panel from the host layout, creating all the necessary
     * resources to render and track the floating panel.
     * @param x the X coordinate of the drag
     * @param y the Y coordinate of the drag
     */
    private detachPanel(x: number, y: number): boolean {
        let newLayout;
        let floating;
        let floatingPct = 0.5;

        switch (this.id.stem.type) {
        case LayoutType.Horiz:
        case LayoutType.Vert: {
            const {layout, removed, removedRatio} = this.id.stem.withoutChild(this.id.index);
            newLayout                             = layout;
            floating                              = removed;
            // TODO: the ratio calculations are mildly incorrect due to the
            //       width of the split thumbs

            // This is here because of TypeScript
            const stem = this.id.stem;

            // Find the index of the neighbor with the smallest ratio
            // TODO: this can be cleaned up if TypeScript ever introduces a
            //       cleaner reduce signature
            const minId = ([this.id.index - 1, this.id.index + 1].filter(
                               i => i >= 0 && i < stem.children.length) as (number | undefined)[])
                              .reduce((m, i) => m === undefined ||
                                                        stem.ratios[i as number] < stem.ratios[m]
                                                    ? i
                                                    : m,
                                      undefined);

            // If we have a neighbor, donate our ratio to them.  The floating
            // panel ratio will be derived from our size compared to theirs.
            if (minId !== undefined) {
                const oldNeighborRatio = this.id.stem.ratios[minId];
                const combinedRatio    = oldNeighborRatio + removedRatio;

                floatingPct = removedRatio / clipDenormPos(combinedRatio);

                if (newLayout.children.length > 1) {
                    // Find the index in the new layout, since the removal of the
                    // floating pane changes the indices.
                    const newMinId = minId > this.id.index ? minId - 1 : minId;

                    newLayout.resizeChild(newMinId,
                                          combinedRatio * newLayout.ratios[newMinId] /
                                              clipDenormPos(oldNeighborRatio));
                }
            }
            else {
                floatingPct = 0.5;
            }
            break;
        }
        case LayoutType.Tabbed: {
            const {layout, removed} = this.id.stem.withoutChild(this.id.index);
            newLayout               = layout;
            floating                = removed;
            break;
        }
        }

        if (newLayout === undefined || floating === undefined) {
            throw new Error('failed to detach pane - this should never happen');
        }

        const transposed = this.manager.layout.transposeDeep(this.id.stem, newLayout);

        if (transposed === undefined) { return false; }

        try {
            const layout = floating;

            // Fallback numbers for if we can't retrieve the rendered pane size
            let width  = 300;
            let height = 200;

            this.manager.transactLayoutChange(
                (_, factory) => {
                    const rects = factory.getPaneRects(layout);

                    if (rects !== undefined && rects.length > 0) {
                        width  = rects[0].width;
                        height = rects[0].height;
                    }

                    return transposed.intoRoot();
                },
                (factory, renderer) => {
                    // TODO: make sure pane is non-interactable
                    const pane = factory.placePane(renderer.viewContainer,
                                                   layout.intoRoot().childId(),
                                                   new BehaviorSubject(undefined));

                    {
                        const inst = pane.instance;

                        inst.floating = true;
                        inst.width    = width;
                        inst.height   = height;
                    }

                    const dropHighlight = factory.placeDropHighlight(renderer.viewContainer);

                    {
                        const inst = dropHighlight.instance;

                        inst.visible = false;
                        inst.left    = x;
                        inst.top     = y;
                        inst.width   = 0;
                        inst.height  = 0;
                    }

                    this.floatingInfo = {layout, pct: floatingPct, pane, dropHighlight};

                    return false; // Suppress emitting a layout change
                });
        }
        catch (e) {
            console.error(e, 'Drag detach failed!  Attempting to restore original layout...');

            this.manager.layout = this.oldLayout;

            this.destroyFloatingInfo();

            throw e;
        }

        return true;
    }

    // TODO: dropping on split pane thumbs should probably count as inserting
    //       the pane between the two adjacent children
    /**
     * Compute the information necessary to drop the floating pane.
     * @param x the current X coordinate of the drag
     * @param y the current Y coordinate of the drag
     */
    private computeDropInfo(x: number, y: number): void {
        if (this.floatingInfo === undefined) { return; }

        const MARGIN = 8;

        /**
         * The next hover action to switch to.  A type of `HoverActionType.None`
         * indicates to cancel the current action, and a value of `undefined`
         * indicates to continue running the current action.  All other values
         * will cancel the current action and start a new one.
         */
        let nextHoverAction: HoverAction<X>|undefined = {type: HoverActionType.None};

        const outerRects = this.manager.el.nativeElement.getClientRects();
        if (outerRects.length === 0) {
            this.dropInfo = undefined;

            return;
        }

        const outerRect = outerRects[0];

        if (x >= (outerRect.left + MARGIN) && x < (outerRect.right - MARGIN) &&
            y >= (outerRect.top + MARGIN) && y < (outerRect.bottom - MARGIN)) {
            // TODO: debounce this if it becomes a performance issue
            const targetMap = this.manager.collectNativeDropTargets();

            // TODO: remove elements that belong to the floating pane
            // NOTE: children in this array should appear before their parents
            //       in order for the code below to work correctly
            const targets = document.elementsFromPoint(x, y)
                                .filter(e => targetMap.has(e))
                                .map(e => [e, targetMap.get(e)] as [Element, DropTarget<X>]);

            if (targets.length === 0) {
                this.dropInfo = undefined;

                return;
            }

            let targetIdx = targets.length - 1;

            // TODO: it might be a good idea to make this configurable
            // This loop sets targetIdx to either 0 or the index of the
            // outermost tabbed container found in the tree.  This has the
            // effect of preventing splits from being created inside tabbed
            // branch panes.
            for (; targetIdx > 0; targetIdx -= 1) {
                const [, target] = targets[targetIdx];

                if (childFromId(target.id).type === LayoutType.Tabbed) { break; }
            }

            // Run an additional search within the innermost disregarded
            // containers to see if there is a header or tab bar we can drop
            // the current container on.  This allows tabs to be created in
            // cases where the above loop would otherwise prevent interacting
            // with certain panes, without allowing splits to be created.
            // NOTE: this is also essential to make tab elements targetable, as
            //       they show up before tabbed containers in the list and will
            //       always have an index < targetIdx
            tabCheck: for (let i = 0; i < targetIdx; i += 1) {
                const [, target] = targets[i];

                switch (target.type) {
                case DropTargetType.Header:
                case DropTargetType.TabRow:
                case DropTargetType.Tab: targetIdx = i; break tabCheck;
                }
            }

            {
                const [element, target] = targets[targetIdx];
                const layout            = childFromId(target.id);

                switch (target.type) {
                case DropTargetType.Pane: {
                    const orientation = PaneDragContext.computeDropOrientation(
                        x, y, element.getClientRects());

                    if (orientation === undefined) { this.dropInfo = undefined; }
                    else if (orientation === DropOrientation.Tabbed) {
                        this.dropInfo = {
                            orientation: DropOrientation.Tabbed,
                            layout,
                            element,
                            tab: layout.type === LayoutType.Tabbed ? layout.currentTab + 1 : 1,
                            isAfter: undefined,
                        };
                    }
                    else {
                        this.dropInfo = {
                            orientation,
                            layout,
                            element,
                            pct: this.floatingInfo.pct,
                        };
                    }
                    break;
                }
                case DropTargetType.PaneNoTab: {
                    const orientation = PaneDragContext.computeSplitDropOrientation(
                        x, y, element.getClientRects());

                    this.dropInfo = orientation === undefined ? undefined : {
                        orientation,
                        layout,
                        element,
                        pct: this.floatingInfo.pct,
                    };
                    break;
                }
                case DropTargetType.Header: {
                    const isAfter = PaneDragContext.computeTabIsAfter(x,
                                                                      y,
                                                                      element.getClientRects());

                    this.dropInfo = isAfter === undefined ? undefined : {
                        orientation: DropOrientation.Tabbed,
                        layout,
                        element,
                        tab: isAfter ? 1 : 0,
                        isAfter,
                    };
                    break;
                }
                case DropTargetType.TabRow:
                    this.dropInfo = {
                        orientation: DropOrientation.Tabbed,
                        layout,
                        element,
                        tab: layout.type === LayoutType.Tabbed ? layout.children.length : 1,
                        isAfter: undefined,
                    };
                    break;
                case DropTargetType.Tab: {
                    const isAfter = PaneDragContext.computeTabIsAfter(x,
                                                                      y,
                                                                      element.getClientRects());

                    if (isAfter === undefined) { this.dropInfo = undefined; }
                    else if (target.id.stem.type === LayoutType.Tabbed) {
                        const {stem, index} = target.id;

                        if (target.id.stem.currentTab !== target.id.index) {
                            if (this.hoverAction.type === HoverActionType.TabSwitch &&
                                Object.is(this.hoverAction.layout, stem) &&
                                this.hoverAction.index === index) {
                                nextHoverAction = undefined;
                            }
                            else {
                                const handle = this.runHoverAction(() => stem.currentTab = index);

                                nextHoverAction =
                                    {type: HoverActionType.TabSwitch, layout: stem, index, handle};
                            }
                        }

                        this.dropInfo = {
                            orientation: DropOrientation.Tabbed,
                            layout: stem,
                            element,
                            tab: isAfter ? index + 1 : index,
                            isAfter,
                        };
                    }
                    else {
                        this.dropInfo = {
                            orientation: DropOrientation.Tabbed,
                            layout,
                            element,
                            tab: isAfter ? 1 : 0,
                            isAfter,
                        };
                    }
                    break;
                }
                }
            }
        }
        else if (this.manager.layout.layout !== undefined) {
            const orientation = PaneDragContext.computeSplitDropOrientation(x, y, outerRects);

            this.dropInfo = orientation === undefined ? undefined : {
                orientation,
                layout: this.manager.layout.layout,
                element: this.manager.el.nativeElement,
                pct: this.floatingInfo.pct,
            };
        }
        else {
            this.dropInfo = undefined;
        }

        if (nextHoverAction !== undefined) {
            if (this.hoverAction.type !== HoverActionType.None) {
                clearTimeout(this.hoverAction.handle);
            }

            this.hoverAction = nextHoverAction;
        }
    }

    /**
     * Adjust the floating pane to match the current drag state.
     * @param x the current X coordinate of the drag
     * @param y the current Y coordinate of the drag
     */
    private updateFloatingPane(x: number, y: number): void {
        if (this.floatingInfo === undefined) { return; }

        const OFFS_X = 8;
        const OFFS_Y = 16;

        const inst = this.floatingInfo.pane.instance;

        inst.left = x + OFFS_X;
        inst.top  = y + OFFS_Y;
    }

    /**
     * Adjust the drop highlight visual to match the current drop information.
     */
    private updateDropHighlight(): void {
        if (this.floatingInfo === undefined) { return; }

        const inst = this.floatingInfo.dropHighlight.instance;

        if (this.dropInfo !== undefined) {
            inst.visible = true;

            const rects = this.dropInfo.element.getClientRects();
            if (rects.length === 0) {
                inst.visible = false;

                return;
            }

            const rect = rects[0];

            const MIN_PCT = 0.15;
            const MAX_PCT = 1 - MIN_PCT;

            const clip = (pct: number) => Math.max(MIN_PCT, Math.min(MAX_PCT, pct));

            switch (this.dropInfo.orientation) {
            case DropOrientation.Left:
                inst.left      = rect.left;
                inst.top       = rect.top;
                inst.width     = rect.width * clip(this.dropInfo.pct);
                inst.height    = rect.height;
                inst.emphasize = undefined;
                break;
            case DropOrientation.Top:
                inst.left      = rect.left;
                inst.top       = rect.top;
                inst.width     = rect.width;
                inst.height    = rect.height * clip(this.dropInfo.pct);
                inst.emphasize = undefined;
                break;
            case DropOrientation.Right:
                inst.left      = rect.left + rect.width * clip(1 - this.dropInfo.pct);
                inst.top       = rect.top;
                inst.width     = rect.width * this.dropInfo.pct;
                inst.height    = rect.height;
                inst.emphasize = undefined;
                break;
            case DropOrientation.Bottom:
                inst.left      = rect.left;
                inst.top       = rect.top + rect.height * clip(1 - this.dropInfo.pct);
                inst.width     = rect.width;
                inst.height    = rect.height * this.dropInfo.pct;
                inst.emphasize = undefined;
                break;
            case DropOrientation.Tabbed:
                inst.left   = rect.left;
                inst.top    = rect.top;
                inst.width  = rect.width;
                inst.height = rect.height;

                switch (this.dropInfo.isAfter) {
                case undefined: inst.emphasize = undefined; break;
                case false: inst.emphasize = 'left'; break;
                case true: inst.emphasize = 'right'; break;
                }
                break;
            }
        }
        else {
            inst.visible = false;
        }
    }

    /**
     * Drop the floating pane into the original layout tree using the computed
     * drop information.
     */
    private dropFloatingPane(): boolean {
        if (this.floatingInfo === undefined || this.dropInfo === undefined) { return false; }

        let replace: ChildLayout<X>;

        switch (this.dropInfo.orientation) {
        case DropOrientation.Left:
            replace = new SplitLayout(LayoutType.Horiz,
                                      [this.floatingInfo.layout, this.dropInfo.layout],
                                      [this.dropInfo.pct, 1 - this.dropInfo.pct]);
            break;
        case DropOrientation.Top:
            replace = new SplitLayout(LayoutType.Vert,
                                      [this.floatingInfo.layout, this.dropInfo.layout],
                                      [this.dropInfo.pct, 1 - this.dropInfo.pct]);
            break;
        case DropOrientation.Right:
            replace = new SplitLayout(LayoutType.Horiz,
                                      [this.dropInfo.layout, this.floatingInfo.layout],
                                      [1 - this.dropInfo.pct, this.dropInfo.pct]);
            break;
        case DropOrientation.Bottom:
            replace = new SplitLayout(LayoutType.Vert,
                                      [this.dropInfo.layout, this.floatingInfo.layout],
                                      [1 - this.dropInfo.pct, this.dropInfo.pct]);
            break;
        case DropOrientation.Tabbed:
            if (this.dropInfo.layout.type === LayoutType.Tabbed) {
                if (this.floatingInfo.layout.type === LayoutType.Tabbed) {
                    const {layout} = this.dropInfo.layout.spliceChildren(
                        this.dropInfo.tab,
                        0,
                        this.floatingInfo.layout.children,
                        this.floatingInfo.layout.currentTab,
                    );

                    replace = layout;
                }
                else {
                    replace = this.dropInfo.layout.withChild(this.dropInfo.tab,
                                                             this.floatingInfo.layout,
                                                             true);
                }
            }
            else {
                if (this.floatingInfo.layout.type === LayoutType.Tabbed) {
                    const {layout} = new TabbedLayout([this.dropInfo.layout], 0)
                                         .spliceChildren(this.dropInfo.tab,
                                                         0,
                                                         this.floatingInfo.layout.children,
                                                         this.floatingInfo.layout.currentTab);

                    replace = layout;
                }
                else {
                    replace = new TabbedLayout([this.dropInfo.layout], 0)
                                  .withChild(this.dropInfo.tab, this.floatingInfo.layout, true);
                }
            }

            break;
        }

        const transposed = this.manager.layout.transposeDeep(this.dropInfo.layout, replace);

        if (transposed === undefined) {
            console.error('failed to drop floating panel into drop target');

            return false;
        }

        this.manager.layout = transposed.intoRoot();

        return true;
    }

    /**
     * Clean up all components and properties related to the floating layout.
     */
    private destroyFloatingInfo(): void {
        if (this.floatingInfo === undefined) { return; }

        this.floatingInfo.pane.destroy();
        this.floatingInfo.dropHighlight.destroy();

        this.floatingInfo = undefined;
    }
}

/**
 * Abstract base component class for components hosting a draggable pane.
 *
 * Provides a `mousedown` handler that covers all pane drag-and-drop
 * functionality.
 */
@Component({template: ''})
export abstract class DraggablePaneComponent<X> {
    /** The pane manager hosting this pane */
    public manager!: NgPaneManagerComponent<X>;
    /** The ID of this pane */
    public childId!: ChildLayoutId<X>;

    /**
     * Initiates drag-and-drop for this pane.
     *
     * **NOTE**: Do _not_ adorn any overrides of this method with
     *           `@HostListener`, this will result in undesired behavior.
     */
    @HostListener('mousedown', ['$event'])
    public onMouseDown(evt: MouseEvent): void {
        if (evt.buttons === 1) {
            PaneDragContext.mouseDown(evt, this.manager, this.childId);

            evt.preventDefault();
            evt.stopPropagation();
        }
    }

    /**
     * Initiates touch drag-and-drop for this pane.
     *
     * **NOTE**: Do _not_ adorn any overrides of this method with
     *           `@HostListener`, this will result in undesired behavior.
     */
    @HostListener('touchstart', ['$event'])
    public onTouchStart(evt: TouchEvent): void {
        PaneDragContext.touchStart(evt, this.manager, this.childId);

        evt.preventDefault();
        evt.stopPropagation();
    }
}
