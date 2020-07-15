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

import {HostListener} from '@angular/core';

import {beginMouseDrag, DragCancelFn} from './begin-drag';
import {NgPaneManagerComponent} from './ng-pane-manager/ng-pane-manager.component';
import {ChildLayoutId, RootLayout} from './pane-layout/module';

/**
 * Indicates the type of a pane drop target.
 */
export const enum DropTargetType {
    /** The target element is owned by a leaf panel */
    Leaf,
    /** The target element is owned by a split branch panel */
    Split,
    /** The target element is owned by a tabbed branch panel */
    Tabbed,
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
    /** **TODO:** remove this */
    private floating: boolean = false;

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
        const DEADBAND = 5;

        if (this.floating) {}
        else if (Math.abs(clientX - this.startX) >= DEADBAND ||
                 Math.abs(clientY - this.startY) >= DEADBAND) {
            if (!this.detachPanel(clientX, clientY)) { cancel(true); }
        }
    }

    /**
     * Drag end callback.\
     * See `begin-drag.ts`
     */
    private dragEnd(isAbort: boolean): void {
        if (!isAbort) {
            // TODO
        }
        else {
            this.manager.layout = this.oldLayout;
        }
    }

    /**
     * Detach the target panel from the host layout.
     * **TODO:** make the panel floating.
     */
    private detachPanel(_x: number, _y: number): boolean {
        const {layout /* , removed */} = this.id.stem.withoutChild(this.id.index);

        this.floating = true;

        const transposed = this.manager.layout.transposeDeep(this.id.stem, layout);

        if (transposed === undefined) { return false; }

        try {
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
