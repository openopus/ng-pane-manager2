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

import {ComponentRef, HostListener} from '@angular/core';

import {beginMouseDrag, DragCancelFn} from './begin-drag';
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
export interface DropTarget {
    /** The type of the component */
    type: DropTargetType;
    /** The ID of the child layout corresponding to this element */
    id: ChildLayoutId;
}

/** All properties associated with a floating drag-and-drop layout */
interface FloatingInfo {
    /** The layout node removed from the original layout tree */
    readonly layout: ChildLayout;
    /**
     * The ratio of the removed layout node, if it was taken from a split.
     *
     * Note that this ratio has been converted to a percentage from 0.0 to 1.0.
     */
    readonly pct: number;

    /** The floating pane for the removed layout node */
    readonly pane: ComponentRef<NgPaneComponent>;
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
interface DropInfoBase<T extends DropOrientation = DropOrientation> {
    /** The type and direction of the dropped layout */
    orientation: T;
    /** The layout to modify during the drop */
    layout: ChildLayout;
    /**
     * The element used to determine the drop information.\
     * This element is also used to render the drop highlight visual.
     */
    element: Element;
}

/** Drop information for creating a split layout. */
interface SplitDropInfo extends DropInfoBase<
    DropOrientation.Left|DropOrientation.Top|DropOrientation.Right|DropOrientation.Bottom> {
    /** The ratio of the removed child as a factor from 0.0 to 1.0 */
    pct: number;
}

/** Drop information for creating a tabbed layout. */
interface TabbedDropInfo extends DropInfoBase<DropOrientation.Tabbed> {
    /** The tab index to insert the floating pane at */
    tab: number;
}

/** Contains any kind of drop info. */
type DropInfo = SplitDropInfo|TabbedDropInfo;

/**
 * Provides an implementation of the callbacks needed for `beginMouseDrag` that
 * actuates dragging and dropping panes within a layout.
 */
export class PaneDragContext {
    /**
     * The original layout, before any action was performed.\
     * Used to recover the original layout if an error occurs.
     */
    private readonly oldLayout: RootLayout;
    /** The floating layout node and all associated properties */
    private floatingInfo: FloatingInfo|undefined;
    /** The information needed to drop the floating layout */
    private dropInfo: DropInfo|undefined;

    /**
     * Compute the orientation of a dropped panel given the posisition of a drag
     * over the panel's client rectangle.
     * @param x the X coordinate of the drag
     * @param y the Y coordinate of the drag
     * @param rect the client rectangle of the hovered element
     */
    private static computeDropOrientation(x: number, y: number, rect: ClientRect): DropOrientation {
        const TAB_MARGIN = 0.15;

        const posX = (x - rect.left) / rect.width - 0.5;
        const posY = (y - rect.top) / rect.height - 0.5;

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
     * @param rect the client rectangle of the hovered element
     */
    private static computeSplitDropOrientation(x: number, y: number, rect: ClientRect):
        DropOrientation.Left|DropOrientation.Top|DropOrientation.Right|DropOrientation.Bottom {
        const posX = (x - rect.left) / rect.width - 0.5;
        const posY = (y - rect.top) / rect.height - 0.5;

        if (Math.abs(posX) > Math.abs(posY)) {
            return posX < 0 ? DropOrientation.Left : DropOrientation.Right;
        }

        return posY < 0 ? DropOrientation.Top : DropOrientation.Bottom;
    }

    /**
     * Construct and initialize a new `PaneDragContext` given a `mousedown`
     * event.
     * @param evt the `mousedown` event to be passed to `beginMouseDrag`
     * @param manager the pane manager hosting the current pane
     * @param id the ID of the pane being dragged
     */
    public static mouseDown(evt: MouseEvent, manager: NgPaneManagerComponent, id: ChildLayoutId):
        void {
        const ctx = new PaneDragContext(evt.clientX, evt.clientY, manager, id);

        beginMouseDrag(evt, ctx.dragDelta.bind(ctx), ctx.dragEnd.bind(ctx));
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
                        private readonly manager: NgPaneManagerComponent,
                        private readonly id: ChildLayoutId) {
        this.oldLayout = manager.layout;
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
        // Don't do anything if the drag never started
        if (this.floatingInfo === undefined) { return; }

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
        let floatingRatio = 0.5;

        switch (this.id.stem.type) {
        case LayoutType.Horiz:
        case LayoutType.Vert: {
            const {layout, removed, removedRatio} = this.id.stem.withoutChild(this.id.index);
            newLayout                             = layout;
            floating                              = removed;
            // TODO: the ratio calculations are mildly incorrect due to the
            //       width of the split thumbs
            // TODO: "donate" our ratio to the smallest neighbor
            floatingRatio = removedRatio / this.id.stem.ratioSum;
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

            this.manager.transactLayoutChange(_ => transposed.intoRoot(), (factory, renderer) => {
                // TODO: make sure pane is non-interactable
                const pane = factory.placePane(renderer.viewContainer, layout.intoRoot().childId());

                {
                    // TODO: choose smarter values, or consider the viewport size
                    const FLOATING_WIDTH  = 300;
                    const FLOATING_HEIGHT = 200;

                    const inst = pane.instance;

                    inst.floating = true;
                    inst.width    = FLOATING_WIDTH;
                    inst.height   = FLOATING_HEIGHT;
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

                this.floatingInfo = {layout, pct: floatingRatio, pane, dropHighlight};
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
    // TODO?: should holding over a tab switch to it?
    /**
     * Compute the information necessary to drop the floating pane.
     * @param x the current X coordinate of the drag
     * @param y the current Y coordinate of the drag
     */
    private computeDropInfo(x: number, y: number): void {
        if (this.floatingInfo === undefined) { return; }

        const MARGIN = 8;

        const outerRect = this.manager.el.nativeElement.getClientRects()[0];

        if (x >= (outerRect.left + MARGIN) && x < (outerRect.right - MARGIN) &&
            y >= (outerRect.top + MARGIN) && y < (outerRect.bottom - MARGIN)) {
            // TODO: debounce this if it becomes a performance issue
            const targetMap = this.manager.collectNativeDropTargets();

            // TODO: remove elements that belong to the floating pane
            // NOTE: children in this array should appear before their parents
            //       in order for the code below to work correctly
            const targets = document.elementsFromPoint(x, y)
                                .filter(e => targetMap.has(e))
                                .map(e => [e, targetMap.get(e)] as [Element, DropTarget]);

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
                case DropTargetType.Pane:
                    const orientation = PaneDragContext.computeDropOrientation(
                        x, y, element.getClientRects()[0]);

                    if (orientation === DropOrientation.Tabbed) {
                        this.dropInfo = {
                            orientation: DropOrientation.Tabbed,
                            layout,
                            element,
                            tab: layout.type === LayoutType.Leaf ? 1 : layout.children.length,
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
                case DropTargetType.Header:
                case DropTargetType.TabRow:
                    if (target.id.stem.type === LayoutType.Root) { this.dropInfo = undefined; }
                    else {
                        this.dropInfo = {
                            orientation: DropOrientation.Tabbed,
                            layout,
                            element,
                            tab: layout.type === LayoutType.Leaf ? 1 : layout.children.length,
                        };
                    }
                    break;
                case DropTargetType.Tab:
                    if (target.id.stem.type === LayoutType.Tabbed) {
                        this.dropInfo = {
                            orientation: DropOrientation.Tabbed,
                            layout: target.id.stem,
                            element,
                            tab: target.id.index,
                        };
                    }
                    else {
                        this.dropInfo = {
                            orientation: DropOrientation.Tabbed,
                            layout,
                            element,
                            tab: 0,
                        };
                    }
                    break;
                }
            }
        }
        else if (this.manager.layout.layout !== undefined) {
            this.dropInfo = {
                orientation: PaneDragContext.computeSplitDropOrientation(x, y, outerRect),
                layout: this.manager.layout.layout,
                element: this.manager.el.nativeElement,
                pct: this.floatingInfo.pct,
            };
        }
        else {
            this.dropInfo = undefined;
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

            const rect = this.dropInfo.element.getClientRects()[0];
            const pct  = 0.5; // TODO

            switch (this.dropInfo.orientation) {
            case DropOrientation.Left:
                inst.left   = rect.left;
                inst.top    = rect.top;
                inst.width  = rect.width * pct;
                inst.height = rect.height;
                break;
            case DropOrientation.Top:
                inst.left   = rect.left;
                inst.top    = rect.top;
                inst.width  = rect.width;
                inst.height = rect.height * pct;
                break;
            case DropOrientation.Right:
                inst.left   = rect.left + rect.width * (1 - pct);
                inst.top    = rect.top;
                inst.width  = rect.width * pct;
                inst.height = rect.height;
                break;
            case DropOrientation.Bottom:
                inst.left   = rect.left;
                inst.top    = rect.top + rect.height * (1 - pct);
                inst.width  = rect.width;
                inst.height = rect.height * pct;
                break;
            case DropOrientation.Tabbed:
                // TODO?: should this attempt to position itself on the tab bar?
                inst.left   = rect.left;
                inst.top    = rect.top;
                inst.width  = rect.width;
                inst.height = rect.height;
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

        let replace: ChildLayout;

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
export abstract class DraggablePaneComponent {
    /** The pane manager hosting this pane */
    public manager!: NgPaneManagerComponent;
    /** The ID of this pane */
    public childId!: ChildLayoutId;

    /**
     * Initiates drag-and-drop for this pane.
     *
     * **NOTE**: Do _not_ adorn any overrides of this method with
     *           `@HostListener`, this will result in undesired behavior.
     */
    @HostListener('mousedown', ['$event'])
    protected onMouseDown(evt: MouseEvent): void {
        if (evt.buttons === 1) {
            PaneDragContext.mouseDown(evt, this.manager, this.childId);

            evt.preventDefault();
            evt.stopPropagation();
        }
    }
}
