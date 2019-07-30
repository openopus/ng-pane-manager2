/****************************************************************************
 *
 * ng-pane-manager2 - a port of ng-pane-manager to Angular 2+ (drag-n-drop.ts)
 * Copyright (C) 2019 Opus Logica
 *
 * ng-pane-manager2 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * ng-pane-manager2 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with ng-pane-manager2.  If not, see <https://www.gnu.org/licenses/>.
 *
 ***************************************************************************/

import {ComponentRef, HostListener, Input} from '@angular/core';

import {beginMouseDrag, DragCancelFn} from './begin-drag';
import {NgPaneManagerComponent} from './ng-pane-manager.component';
import {NgPaneSlotComponent} from './ng-pane-slot/ng-pane-slot.component';
import {BranchLayout, LayoutType, PaneLayout} from './pane-layout';

export enum DropTargetType {
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
    branch: BranchLayout;
    index: number;
}

enum DropOrientation {
    Left,
    Top,
    Right,
    Bottom,
    Tabbed,
}

export class PaneDragContext {
    origLayout: PaneLayout;
    floatingLayout: PaneLayout;
    floatingSlot: ComponentRef<NgPaneSlotComponent>;

    dropLayout: PaneLayout;
    dropOrientation: DropOrientation;
    dropRatio: number; // NB: unlike normal ratios, this is from 0 to 1
    dropTabIndex: number;

    static mouseDown(evt: MouseEvent,
                     manager: NgPaneManagerComponent,
                     branch: BranchLayout,
                     index: number) {
        const ctx = new PaneDragContext(evt.clientX, evt.clientY, manager, branch, index);

        beginMouseDrag(evt, branch ? ctx.dragDelta.bind(ctx) : undefined, ctx.dragEnd.bind(ctx));
    }

    private static computeDropOrientation(x: number, y: number, rect: ClientRect) {
        const TAB_MARGIN = 0.15;

        const posX = (x - rect.left) / rect.width - 0.5;
        const posY = (y - rect.top) / rect.height - 0.5;

        if (posX >= -TAB_MARGIN && posX < TAB_MARGIN && posY >= -TAB_MARGIN && posY < TAB_MARGIN)
            return DropOrientation.Tabbed;

        if (Math.abs(posX) > Math.abs(posY))
            return posX < 0 ? DropOrientation.Left : DropOrientation.Right;
        else
            return posY < 0 ? DropOrientation.Top : DropOrientation.Bottom;
    }

    private constructor(private startX: number,
                        private startY: number,
                        private manager: NgPaneManagerComponent,
                        private branch: BranchLayout,
                        private index: number) {
        this.origLayout = manager.layout;
    }

    private dragDelta(clientX: number, clientY: number, cancel: DragCancelFn) {
        if (this.floatingSlot) this.moveFloatingSlot(clientX, clientY);

        if (this.floatingLayout)
            this.computeDropParams(clientX, clientY);
        else if (Math.abs(clientX - this.startX) >= 5 || Math.abs(clientY - this.startY) >= 5) {
            if (!this.detachPanel(clientX, clientY)) cancel(true);
        }
    }

    private dragEnd(isAbort: boolean) {
        if (!isAbort && this.floatingLayout && this.dropLayout) {
            let replace: PaneLayout;

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
            }

            const transposed = this.manager.layout.transposeDeep(this.dropLayout, replace);

            if (transposed)
                this.manager.layout = transposed;
            else {
                console.error('Failed to insert floating panel into drop target');
            }
        }
        else
            this.manager.layout = this.origLayout;

        if (this.floatingSlot) this.floatingSlot.destroy();
    }

    private moveFloatingSlot(x: number, y: number) {
        this.floatingSlot.instance.left = x + 8;
        this.floatingSlot.instance.top  = y + 16;
    }

    private detachPanel(x: number, y: number): boolean {
        const ratioSum = this.branch.ratioSum;
        const {
            layout: withoutChild,
            removed,
            removedRatio,
        } = this.branch.withoutChild(this.index);

        this.floatingLayout = removed;

        // TODO: this calculation is incorrect
        // TODO: "donate" our ratio to the smallest neighbor
        this.dropRatio = removedRatio ? removedRatio / ratioSum : 0.5;

        this.floatingSlot = this.manager.factory.placeSlotForRootLayout(
            this.manager.renderer.viewContainer, removed);

        this.floatingSlot.instance.float  = true;
        this.floatingSlot.instance.width  = 300;
        this.floatingSlot.instance.height = 200;
        this.moveFloatingSlot(x, y);

        const transposed = this.manager.layout.transposeDeep(this.branch, withoutChild);

        if (transposed) this.manager.layout = transposed;

        return !!transposed;
    }

    // TODO: dropping on split pane thumbs should probably count as a split in
    //       the same orientation as the branch
    private computeDropParams(x: number, y: number) {
        const MARGIN = 8;

        const outerRect = this.manager.el.nativeElement.getClientRects()[0];

        if (x >= (outerRect.left + MARGIN) && x < (outerRect.right - MARGIN) &&
            y >= (outerRect.top + MARGIN) && y < (outerRect.bottom - MARGIN)) {
            const hitTargets = this.manager.getNativeHitTargets();

            let els = document.elementsFromPoint(x, y)
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
                let el = els[startIdx];

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
                let el = els[i];

                if (el[1].type === DropTargetType.Header || el[1].type === DropTargetType.Tab) {
                    startIdx = i;
                    break;
                }
            }

            const dropTarget = els[startIdx][1];

            switch (dropTarget.type) {
            case DropTargetType.Pane:
                this.dropLayout = dropTarget.layout;

                const orientTargetIdx = dropTarget.layout.type === LayoutType.Tabbed
                                            ? Math.max(0, startIdx - 1)
                                            : startIdx;

                this.dropOrientation = PaneDragContext.computeDropOrientation(
                    x, y, els[orientTargetIdx][0].getClientRects()[0]);
                break;
            case DropTargetType.Header:
                this.dropLayout      = dropTarget.layout;
                this.dropOrientation = DropOrientation.Tabbed;
                break;
            case DropTargetType.Tab:
                this.dropLayout      = dropTarget.branch;
                this.dropOrientation = DropOrientation.Tabbed;
                // TODO: this is slightly incorrect
                this.dropTabIndex = dropTarget.index;
                break;
            }
        }
        else {
            this.dropLayout      = this.manager.layout;
            this.dropOrientation = PaneDragContext.computeDropOrientation(x, y, outerRect);
        }
    }
}

export abstract class DraggablePaneComponent {
    @Input() manager: NgPaneManagerComponent;
    @Input() branch: BranchLayout;
    @Input() index: number;

    @HostListener('mousedown', ['$event'])
    protected onMouseDown(evt: MouseEvent) {
        if (evt.buttons === 1) {
            PaneDragContext.mouseDown(evt, this.manager, this.branch, this.index);

            evt.stopPropagation();
        }

        if (evt.buttons === 4) {
            const {layout} = this.branch.withoutChild(this.index);

            const transposed = this.manager.layout.transposeDeep(this.branch, layout);

            if (transposed)
                this.manager.layout = transposed;
            else
                console.error('failed to remove closed panel from tree');
        }

        // TODO: middle-click on headers & tabs should close panes
    }
}
