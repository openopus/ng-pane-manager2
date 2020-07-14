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

import {Component, ElementRef, HostBinding, HostListener} from '@angular/core';

import {beginMouseDrag} from '../begin-drag';
import {ChildLayoutId, LayoutType, StemLayout} from '../pane-layout/module';

interface DragState {
    scaleFactor: number;
    lastPos: number;
}

@Component({
    selector: 'lib-ng-pane-split-thumb',
    template: '',
    styleUrls: ['./ng-pane-split-thumb.component.scss'],
})
export class NgPaneSplitThumbComponent {
    splitEl!: ElementRef<HTMLElement>;
    childId!: ChildLayoutId&{stem: StemLayout};

    constructor(private readonly el: ElementRef<HTMLElement>) {}

    @HostBinding('class.lib-ng-pane-vert') vert = false;

    @HostBinding('class.lib-ng-pane-horiz')
    get horiz() {
        return !this.vert;
    }

    private makeDragState(clientX: number, clientY: number): DragState {
        const state: DragState = {
            scaleFactor: 0,
            lastPos: -1,
        };

        const branchRect = this.splitEl.nativeElement.getClientRects()[0];
        const selfRect   = this.el.nativeElement.getClientRects()[0];

        const layout = this.childId.stem;

        // TODO: some of these calculations are a little weird because moveSplit
        //       doesn't consider the width of thumbs
        switch (layout.type) {
        case LayoutType.Horiz:
            state.scaleFactor = layout.ratioSum /
                                Math.max(1e-7,
                                         branchRect.width -
                                             selfRect.width * (layout.ratios.length - 1));
            state.lastPos = clientX;
            break;
        case LayoutType.Vert:
            state.scaleFactor = layout.ratioSum /
                                Math.max(1e-7,
                                         branchRect.height -
                                             selfRect.height * (layout.ratios.length - 1));
            state.lastPos = clientY;
            break;
        }

        return state;
    }

    private onDragDelta(clientX: number, clientY: number, state: DragState) {
        let delta: number;

        switch (this.childId.stem.type) {
        case LayoutType.Horiz:
            delta         = (clientX - state.lastPos) * state.scaleFactor;
            state.lastPos = clientX;
            break;
        case LayoutType.Vert:
            delta         = (clientY - state.lastPos) * state.scaleFactor;
            state.lastPos = clientY;
            break;
        default: return;
        }

        this.childId.stem.moveSplit(this.childId.index, delta);
    }

    @HostListener('mousedown', ['$event'])
    protected onMouseDown(evt: MouseEvent) {
        if (evt.buttons !== 1) return;

        const state = this.makeDragState(evt.clientX, evt.clientY);
        beginMouseDrag(evt, (x, y) => this.onDragDelta(x, y, state));

        // TODO: this won't work at all with touch
    }
}
