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
import {NgPaneManagerComponent} from './ng-pane-manager/ng-pane-manager.component';
import {NgPaneComponent} from './ng-pane/ng-pane.component';
import {ChildLayout, ChildLayoutId, RootLayout, saveLayout} from './pane-layout/module';

// TODO: what's the difference between Header and Tab?
export const enum DropTargetType {
    Leaf,
    Split,
    Tabbed,
    Header,
    Tab,
    TabRow,
}

export interface DropTarget {
    type: DropTargetType;
    id: ChildLayoutId;
}


const enum DropOrientation {
    Left,
    Top,
    Right,
    Bottom,
    Tabbed,
}

export class PaneDragContext {
    private readonly oldLayout: RootLayout;
    private floating = false;

    static mouseDown(evt: MouseEvent, manager: NgPaneManagerComponent, id: ChildLayoutId) {
        const ctx = new PaneDragContext(evt.clientX, evt.clientY, manager, id);

        beginMouseDrag(evt, ctx.dragDelta.bind(ctx), ctx.dragEnd.bind(ctx));
    }

    private constructor(private readonly startX: number,
                        private readonly startY: number,
                        private readonly manager: NgPaneManagerComponent,
                        private readonly id: ChildLayoutId) {
        this.oldLayout = manager.layout;
    }

    private dragDelta(clientX: number, clientY: number, cancel: DragCancelFn) {
        if (this.floating) {}
        else if (Math.abs(clientX - this.startX) >= 5 || Math.abs(clientY - this.startY) >= 5) {
            if (!this.detachPanel(clientX, clientY)) cancel(true);
        }
    }

    private dragEnd(isAbort: boolean) {
        if (!isAbort)
            void 0;
        else
            this.manager.layout = this.oldLayout;
    }

    private detachPanel(x: number, y: number): boolean {
        const {layout, removed} = this.id.stem.withoutChild(this.id.index);

        this.floating = true;

        const transposed = this.manager.layout.transposeDeep(this.id.stem, layout);

        if (transposed === undefined) return false;

        try {
            console.log(saveLayout(transposed.intoRoot()));
            this.manager.layout = transposed.intoRoot();
        }
        catch (e) {
            this.manager.layout = this.oldLayout;

            this.floating = false;
            // TODO: clean up here

            throw e;
        }

        return true;
    }
}

export abstract class DraggablePaneComponent {
    manager!: NgPaneManagerComponent;
    childId!: ChildLayoutId;

    @HostListener('mousedown', ['$event'])
    protected onMouseDown(evt: MouseEvent) {
        if (evt.buttons === 1) {
            PaneDragContext.mouseDown(evt, this.manager, this.childId);

            evt.preventDefault();
            evt.stopPropagation();
        }
    }
}
