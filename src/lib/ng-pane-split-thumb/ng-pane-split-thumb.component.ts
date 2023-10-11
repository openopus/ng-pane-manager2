/**************************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-split-thumb.component.ts)
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
 *************************************************************************************************/

import { Component, ElementRef, HostBinding, HostListener } from '@angular/core';

import { averageTouchPos, beginMouseDrag, beginTouchDrag } from '../begin-drag';
import { PaneFactory } from '../pane-factory';
import { ChildLayoutId, LayoutType, SplitLayout } from '../pane-layout/module';
import { clipDenormPos } from '../util';

/**
 * State information for dragging a split branch thumb.
 */
interface DragState {
    /** The scale factor used to translate pixels into pane ratios */
    scaleFactor: number;
    /** The last X or Y position of the cursor, depending on the split direction */
    lastPos: number;
}

/**
 * A thumb for resizing two adjacent panes in a split, rendered as a separator
 * between them.
 */
@Component({
    selector: 'lib-ng-pane-split-thumb',
    template: '',
    styleUrls: ['./ng-pane-split-thumb.component.scss'],
})
export class NgPaneSplitThumbComponent<X> {
    /** The pane factory of this pane manager */
    public factory!: PaneFactory<X>;
    /**
     * The ID of the first child of the split bordering this thumb.\
     * For horizontal splits this is the left child, and for vertical splits it
     * is the top.
     */
    public childId!: ChildLayoutId<X, SplitLayout<X>>;

    /** Indicates this thumb belongs to a vertical split */
    @HostBinding('class.lib-ng-pane-vert') public vert: boolean = false;

    /** Indicates this thumb belongs to a horizontal split */
    @HostBinding('class.lib-ng-pane-horiz')
    public get horiz(): boolean {
        return !this.vert;
    }

    /**
     * Construct a new branch split thumb.
     * @param el injected for use in computing pixel scale factor
     */
    public constructor(public readonly el: ElementRef<HTMLElement>) {}

    /**
     * Compute the initial drag state from a drag start event.
     * @param clientX the client X coordinate of the event
     * @param clientY the client y coordinate of the event
     */
    private makeDragState(clientX: number, clientY: number): DragState {
        const state: DragState = {
            scaleFactor: 0,
            lastPos: -1,
        };

        const layout = this.childId.stem;
        const stemRect = this.factory.getPaneRect(layout);

        if (stemRect === undefined) {
            throw new Error('failed to find stem bounding rect');
        }

        const siblingRects = [];

        for (const child of layout.children) {
            const rect = this.factory.getPaneRect(child);
            if (rect === undefined) {
                throw new Error('failed to find sibling bounding rect');
            }
            siblingRects.push(rect);
        }

        // NOTE: because thumbs take up space on screen but moveSplit does not
        //       consider them for calculation, the total width of the stem
        //       element cannot be used directly.
        switch (layout.type) {
            case LayoutType.Horiz:
                state.scaleFactor =
                    layout.ratioSum / clipDenormPos(siblingRects.reduce((s, r) => s + r.width, 0));
                state.lastPos = clientX;
                break;
            case LayoutType.Vert:
                state.scaleFactor =
                    layout.ratioSum / clipDenormPos(siblingRects.reduce((s, r) => s + r.height, 0));
                state.lastPos = clientY;
                break;
        }

        return state;
    }

    /**
     * See `pane-drag.ts`
     */
    private onDragDelta(clientX: number, clientY: number, state: DragState): void {
        let delta: number;

        switch (this.childId.stem.type) {
            case LayoutType.Horiz:
                delta = (clientX - state.lastPos) * state.scaleFactor;
                state.lastPos = clientX;
                break;
            case LayoutType.Vert:
                delta = (clientY - state.lastPos) * state.scaleFactor;
                state.lastPos = clientY;
                break;
            default:
                return;
        }

        this.childId.stem.moveSplit(this.childId.index, delta);
    }

    /**
     * Initiate a drag to resize the two neighboring children.
     */
    @HostListener('mousedown', ['$event'])
    public onMouseDown(evt: MouseEvent): void {
        if (evt.buttons !== 1) {
            return;
        }

        const state = this.makeDragState(evt.clientX, evt.clientY);
        beginMouseDrag(evt, (x, y) => this.onDragDelta(x, y, state));

        evt.preventDefault();
        evt.stopPropagation();
    }

    /**
     * Initiate a touch drag to resize the two neighboring children.
     */
    @HostListener('touchstart', ['$event'])
    public onTouchStart(evt: TouchEvent): void {
        const [startX, startY] = averageTouchPos(evt);
        const state = this.makeDragState(startX, startY);
        beginTouchDrag(evt, (x, y) => this.onDragDelta(x, y, state));

        evt.preventDefault();
        evt.stopPropagation();
    }
}
