/***************************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-branch-thumb.component.ts)
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
 **************************************************************************************************/

import {Component, ElementRef, HostBinding, HostListener, Input} from '@angular/core';

import {beginMouseDrag} from '../begin-drag';
import {BranchLayout, LayoutType} from '../pane-layout';

interface DragState {
    scaleFactor: number;
    lastPos: number;
}

@Component({
    selector: 'lib-ng-pane-branch-thumb',
    template: '',
    styleUrls: ['./ng-pane-branch-thumb.component.scss']
})
export class NgPaneBranchThumbComponent {
    @Input() branchEl: ElementRef<HTMLElement>;
    @Input() index: number;
    @Input() layout: BranchLayout;

    @HostBinding('class.horiz')
    get horiz() {
        return this.layout.type === LayoutType.Horiz;
    }

    @HostBinding('class.vert')
    get vert() {
        return this.layout.type === LayoutType.Vert;
    }

    constructor(private el: ElementRef<HTMLElement>) {}

    private makeDragState(clientX: number, clientY: number): DragState {
        const state: DragState = {
            scaleFactor: 0,
            lastPos: -1,
        };

        const branchRect = this.branchEl.nativeElement.getClientRects()[0];
        const selfRect   = this.el.nativeElement.getClientRects()[0];

        switch (this.layout.type) {
        case LayoutType.Horiz:
            state.scaleFactor = this.layout.ratioSum /
                                Math.max(1e-7,
                                         branchRect.width -
                                             selfRect.width * (this.layout.ratios.length - 1));
            state.lastPos = clientX;
            break;
        case LayoutType.Vert:
            state.scaleFactor = this.layout.ratioSum /
                                Math.max(1e-7,
                                         branchRect.height -
                                             selfRect.height * (this.layout.ratios.length - 1));
            state.lastPos = clientY;
            break;
        }

        return state;
    }

    private onDragDelta(clientX: number, clientY: number, state: DragState) {
        let delta: number;

        switch (this.layout.type) {
        case LayoutType.Horiz: {
            delta         = (clientX - state.lastPos) * state.scaleFactor;
            state.lastPos = clientX;
            break;
        }
        case LayoutType.Vert: {
            delta         = (clientY - state.lastPos) * state.scaleFactor;
            state.lastPos = clientY;
            break;
        }
        }

        this.layout.moveSplit(this.index, delta);
    }

    @HostListener('mousedown', ['$event'])
    private onMouseDown(evt: MouseEvent) {
        if (evt.buttons !== 1) return;

        const state = this.makeDragState(evt.clientX, evt.clientY);
        beginMouseDrag(evt, (x, y) => this.onDragDelta(x, y, state));

        // TODO: this won't work at all with touch
    }
}
