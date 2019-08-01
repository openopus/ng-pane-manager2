/******************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-tab.component.ts)
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
 *****************************************************************************************/

import {Component, ElementRef, HostBinding, HostListener} from '@angular/core';
import {DraggablePaneComponent} from '../drag-n-drop';

@Component({
    selector: 'lib-ng-pane-tab',
    template: 'tab',
    styleUrls: ['./ng-pane-tab.component.scss'],
})
export class NgPaneTabComponent extends DraggablePaneComponent {
    @HostBinding('class.active')
    get active() {
        return this.branch && this.branch.currentTabIndex === this.index;
    }

    constructor(public el: ElementRef<HTMLElement>) { super(); }

    @HostListener('mousedown', ['$event'])
    protected onMouseDown(evt: MouseEvent) {
        if (evt.buttons === 1) this.branch.currentTabIndex = this.index;

        super.onMouseDown(evt);
    }
}
