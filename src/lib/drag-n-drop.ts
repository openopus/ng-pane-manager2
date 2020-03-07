/********************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (drag-n-drop.ts)
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
 *******************************************************************************/

import {ComponentRef, HostListener, Input} from '@angular/core';

import {beginMouseDrag, DragCancelFn} from './begin-drag';
import {
    NgPaneDropHighlightComponent,
} from './ng-pane-drop-highlight/ng-pane-drop-highlight.component';
import {NgPaneManagerComponent} from './ng-pane-manager.component';
import {NgPaneSlotComponent} from './ng-pane-slot/ng-pane-slot.component';
import {BranchChildId, BranchLayout, LayoutType, PaneLayout} from './pane-layout';

export const enum DropTargetType {
    Pane,
    Header,
    Tab,
}

export type DropTarget = LayoutDropTarget|TabDropTarget;

export interface LayoutDropTarget {
    type: DropTargetType.Pane|DropTargetType.Header;
    layout: PaneLayout;
}

export interface TabDropTarget {
    type: DropTargetType.Tab;
    id: BranchChildId;
}

const enum DropOrientation {
    Left,
    Top,
    Right,
    Bottom,
    Tabbed,
}

export class PaneDragContext {
    origLayout: PaneLayout;
    floatingLayout: PaneLayout|undefined;
    floatingSlot: ComponentRef<NgPaneSlotComponent>|undefined;
    dropHighlight: ComponentRef<NgPaneDropHighlightComponent>|undefined;

    dropLayout: PaneLayout|undefined;
    dropElement: Element|undefined;
    dropOrientation: DropOrientation|undefined;
    dropRatio    = 0.0; // NB: unlike normal ratios, this is from 0 to 1
    dropTabIndex = -1;

    static mouseDown(evt: MouseEvent, manager: NgPaneManagerComponent, id: BranchChildId) {
        const ctx = new PaneDragContext(evt.clientX, evt.clientY, manager, id);

        beginMouseDrag(evt, ctx.dragDelta.bind(ctx), ctx.dragEnd.bind(ctx));
    }

    private static computeDropOrientation(x: number, y: number, rect: ClientRect) {
        const TAB_MARGIN = 0.15;

        const posX = (x - rect.left) / rect.width - 0.5;
        const posY = (y - rect.top) / rect.height - 0.5;

        if (posX >= -TAB_MARGIN && posX < TAB_MARGIN && posY >= -TAB_MARGIN && posY < TAB_MARGIN)
            return DropOrientation.Tabbed;

        if (Math.abs(posX) > Math.abs(posY))
            return posX < 0 ? DropOrientation.Left : DropOrientation.Right;

        return posY < 0 ? DropOrientation.Top : DropOrientation.Bottom;
    }

    private constructor(private readonly startX: number,
                        private readonly startY: number,
                        private readonly manager: NgPaneManagerComponent,
                        private readonly id: BranchChildId) {
        this.origLayout = manager.layout;
    }

    private dragDelta(clientX: number, clientY: number, cancel: DragCancelFn) {
        if (this.floatingSlot !== undefined) {
            this.moveFloatingSlot(clientX, clientY);
            this.moveDropHighlight();
        }

        if (this.floatingLayout !== undefined)
            this.computeDropParams(clientX, clientY);
        else if (Math.abs(clientX - this.startX) >= 5 || Math.abs(clientY - this.startY) >= 5) {
            if (!this.detachPanel(clientX, clientY)) cancel(true);
        }
    }

    private dragEnd(isAbort: boolean) {
        if (!isAbort && this.floatingLayout !== undefined && this.dropLayout !== undefined)
            this.dropFloatingLayout();
        else
            this.manager.layout = this.origLayout;

        if (this.floatingSlot !== undefined) {
            this.floatingSlot.destroy();
            if (this.dropHighlight !== undefined) this.dropHighlight.destroy();
        }
    }

    private moveFloatingSlot(x: number, y: number) {
        if (this.floatingSlot === undefined) return;

        this.floatingSlot.instance.left = x + 8;
        this.floatingSlot.instance.top  = y + 16;
    }

    private detachPanel(x: number, y: number): boolean {
        const ratioSum = this.id.branch.ratioSum;
        const {
            layout: withoutChild,
            removed,
            removedRatio,
        } = this.id.branch.withoutChild(this.id.index);

        this.floatingLayout = removed;

        // TODO: this calculation is incorrect
        // TODO: "donate" our ratio to the smallest neighbor
        this.dropRatio = removedRatio !== undefined && ratioSum !== undefined
                             ? removedRatio / ratioSum
                             : 0.5;

        this.floatingSlot = this.manager.factory.placeSlotForRootLayout(
            this.manager.renderer.viewContainer, removed);

        this.floatingSlot.instance.float  = true;
        this.floatingSlot.instance.width  = 300;
        this.floatingSlot.instance.height = 200;
        this.moveFloatingSlot(x, y);

        const transposed = this.manager.layout.transposeDeep(this.id.branch, withoutChild);

        if (transposed === undefined) return false;

        try {
            this.manager.layout = transposed;
        }
        catch (e) {
            this.manager.layout = this.origLayout;

            this.floatingLayout = undefined;
            this.floatingSlot.destroy();

            throw e;
        }

        this.dropHighlight = this.manager.factory.placeDropHighlight(
            this.manager.renderer.viewContainer);

        return true;
    }

    private moveDropHighlight() {
        if (this.dropHighlight === undefined) return;

        const inst = this.dropHighlight.instance;

        if (this.dropElement !== undefined) {
            inst.active = true;

            const rect = this.dropElement.getClientRects()[0];

            switch (this.dropOrientation) {
            case DropOrientation.Left:
                inst.left   = rect.left;
                inst.top    = rect.top;
                inst.width  = rect.width * this.dropRatio;
                inst.height = rect.height;
                break;
            case DropOrientation.Top:
                inst.left   = rect.left;
                inst.top    = rect.top;
                inst.width  = rect.width;
                inst.height = rect.height * this.dropRatio;
                break;
            case DropOrientation.Right:
                inst.left   = rect.left + (1.0 - this.dropRatio) * rect.width;
                inst.top    = rect.top;
                inst.width  = rect.width * this.dropRatio;
                inst.height = rect.height;
                break;
            case DropOrientation.Bottom:
                inst.left   = rect.left;
                inst.top    = rect.top + (1.0 - this.dropRatio) * rect.height;
                inst.width  = rect.width;
                inst.height = rect.height * this.dropRatio;
                break;
            case DropOrientation.Tabbed:
                // TODO: this is incorrect, but complicated to fix.
                inst.left   = rect.left;
                inst.top    = rect.top;
                inst.width  = rect.width;
                inst.height = rect.height;
                break;
            }
        }
        else
            inst.active = false;
    }

    // TODO: dropping on split pane thumbs should probably count as a split in
    //       the same orientation as the branch
    // TODO: should holding over a tab switch to it?
    private computeDropParams(x: number, y: number) {
        const MARGIN = 8;

        const outerRect = this.manager.el.nativeElement.getClientRects()[0];

        if (x >= (outerRect.left + MARGIN) && x < (outerRect.right - MARGIN) &&
            y >= (outerRect.top + MARGIN) && y < (outerRect.bottom - MARGIN)) {
            const hitTargets = this.manager.getNativeHitTargets();

            const els = document.elementsFromPoint(x, y)
                            .filter(e => hitTargets.has(e))
                            .map(e => [e, hitTargets.get(e)] as [Element, DropTarget]);

            if (els.length === 0) {
                this.dropLayout = this.dropOrientation = undefined;

                return;
            }

            let startIdx = els.length - 1;

            // Disallow creating branches within a tabbed container.
            // TODO: it might be a good idea to make this configurable
            for (; startIdx > 0; --startIdx) {
                const el = els[startIdx];

                if (el[1].type === DropTargetType.Pane && el[1].layout.type === LayoutType.Tabbed)
                    break;
            }

            // If we're on top of a header or tab, we can disregard startIdx.
            // This translates to allowing things to tabify correctly if we've
            // somehow placed a branch inside a tab (which should not be doable
            // with drag'n'drop)
            // Note that this is also essential to allowing targeting of tabs,
            // as they will always be before their parent container (and thus
            // have an index < startIdx)
            for (let i = 0; i < startIdx; ++i) {
                const el = els[i];

                if (el[1].type === DropTargetType.Header || el[1].type === DropTargetType.Tab) {
                    startIdx = i;
                    break;
                }
            }

            const dropTarget = els[startIdx][1];
            this.dropElement = els[startIdx][0];

            switch (dropTarget.type) {
            case DropTargetType.Pane:
                this.dropLayout = dropTarget.layout;

                const orientTargetIdx = dropTarget.layout.type === LayoutType.Tabbed
                                            ? Math.max(0, startIdx - 1)
                                            : startIdx;

                this.dropOrientation = PaneDragContext.computeDropOrientation(
                    x, y, els[orientTargetIdx][0].getClientRects()[0]);

                if (this.dropOrientation === DropOrientation.Tabbed)
                    this.dropTabIndex = dropTarget.layout.type === LayoutType.Leaf
                                            ? 1
                                            : dropTarget.layout.children.length;

                break;
            case DropTargetType.Header:
                this.dropLayout      = dropTarget.layout;
                this.dropOrientation = DropOrientation.Tabbed;

                this.dropTabIndex = dropTarget.layout.type === LayoutType.Leaf
                                        ? 1
                                        : dropTarget.layout.children.length;

                break;
            case DropTargetType.Tab:
                this.dropLayout      = dropTarget.id.branch;
                this.dropOrientation = DropOrientation.Tabbed;
                // TODO: this is slightly incorrect
                this.dropTabIndex = dropTarget.id.index;
                break;
            }
        }
        else {
            this.dropLayout      = this.manager.layout;
            this.dropElement     = this.manager.el.nativeElement;
            this.dropOrientation = PaneDragContext.computeDropOrientation(x, y, outerRect);
        }
    }

    private dropFloatingLayout() {
        if (this.dropLayout === undefined || this.floatingLayout === undefined) return;

        let replace: PaneLayout|undefined;

        // TODO: should gravity/group be inherited?  Gravity probably
        //       shouldn't, but should the group encapsulate the new
        //       parent, or just the split child?

        switch (this.dropOrientation) {
        case DropOrientation.Left:
            replace = BranchLayout.split(LayoutType.Horiz,
                                         [this.floatingLayout, this.dropLayout],
                                         [this.dropRatio, 1 - this.dropRatio]);
            break;
        case DropOrientation.Top:
            replace = BranchLayout.split(LayoutType.Vert,
                                         [this.floatingLayout, this.dropLayout],
                                         [this.dropRatio, 1 - this.dropRatio]);
            break;
        case DropOrientation.Right:
            replace = BranchLayout.split(LayoutType.Horiz,
                                         [this.dropLayout, this.floatingLayout],
                                         [1 - this.dropRatio, this.dropRatio]);
            break;
        case DropOrientation.Bottom:
            replace = BranchLayout.split(LayoutType.Vert,
                                         [this.dropLayout, this.floatingLayout],
                                         [1 - this.dropRatio, this.dropRatio]);
            break;
        case DropOrientation.Tabbed:
            if (this.dropTabIndex === -1) {
                console.error('bad drop parameters (no tab index)');
                break;
            }

            if (this.dropLayout.type === LayoutType.Tabbed) {
                if (this.floatingLayout.type === LayoutType.Tabbed) {
                    const {layout} = this.dropLayout.spliceChildren(
                        this.dropTabIndex,
                        0,
                        this.floatingLayout.children,
                        undefined,
                        this.floatingLayout.currentTabIndex);

                    replace = layout;
                }
                else
                    replace = this.dropLayout.withChild(this.floatingLayout,
                                                        this.dropTabIndex,
                                                        undefined,
                                                        true);
            }
            else {
                if (this.floatingLayout.type === LayoutType.Tabbed) {
                    const {layout} = BranchLayout.tabbed([this.dropLayout], 0)
                                         .spliceChildren(1,
                                                         0,
                                                         this.floatingLayout.children,
                                                         undefined,
                                                         this.floatingLayout.currentTabIndex);

                    replace = layout;
                }
                else
                    replace = BranchLayout.tabbed([this.dropLayout, this.floatingLayout], 1);
            }

            break;
        default: throw new Error('invalid drop layout');
        }

        const transposed = replace === undefined
                               ? undefined
                               : this.manager.layout.transposeDeep(this.dropLayout, replace);

        if (transposed !== undefined)
            this.manager.layout = transposed;
        else {
            console.error('failed to insert floating panel into drop target');
            this.manager.layout = this.origLayout;
        }
    }
}

export abstract class DraggablePaneComponent {
    @Input() manager!: NgPaneManagerComponent;
    @Input() childId: BranchChildId|undefined;

    @HostListener('mousedown', ['$event'])
    protected onMouseDown(evt: MouseEvent) {
        if (this.childId === undefined) return;

        if (evt.buttons === 1) {
            PaneDragContext.mouseDown(evt, this.manager, this.childId);

            evt.stopPropagation();
        }

        if (evt.buttons === 4) {
            const {layout} = this.childId.branch.withoutChild(this.childId.index);

            const transposed = this.manager.layout.transposeDeep(this.childId.branch, layout);

            if (transposed !== undefined)
                this.manager.layout = transposed;
            else
                console.error('failed to remove closed panel from tree');
        }

        // TODO: middle-click on headers & tabs should close panes
    }
}
