/*****************************************************************************************
 *
 * ng-pane-manager2 - a port of ng-pane-manager to Angular 2+ (ng-pane-header.component.ts)
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
 ****************************************************************************************/

import {Component, ElementRef, HostListener, Input} from '@angular/core';

import {PaneDragContext} from '../drag-n-drop';
import {NgPaneManagerComponent} from '../ng-pane-manager.component';
import {BranchLayout} from '../pane-layout';

@Component({
    selector: 'lib-ng-pane-header',
    template: 'title',
    styleUrls: ['./ng-pane-header.component.scss'],
})
export class NgPaneHeaderComponent {
    @Input() manager: NgPaneManagerComponent;
    @Input() branch: BranchLayout;
    @Input() index: number;

    @HostListener('mousedown', ['$event'])
    private onMouseDown(evt: MouseEvent) {
        if (evt.buttons === 1)
            PaneDragContext.mouseDown(evt, this.manager, this.branch, this.index);

        // TODO: this won't work at all with touch
    }

    constructor(public el: ElementRef<HTMLElement>) {}
}
