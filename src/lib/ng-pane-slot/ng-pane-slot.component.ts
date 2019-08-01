/*******************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-slot.component.ts)
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
 ******************************************************************************************/

import {Component, HostBinding, ViewChild} from '@angular/core';

import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';

@Component({
    selector: 'lib-ng-pane-slot',
    template: '<ng-container libNgPaneRenderer></ng-container>',
    styleUrls: ['./ng-pane-slot.component.scss'],
})
export class NgPaneSlotComponent {
    @ViewChild(NgPaneRendererDirective, {static: true}) renderer: NgPaneRendererDirective;

    @HostBinding('style.flex-grow') ratio: number;
    @HostBinding('class.hidden') isHidden: boolean;
    @HostBinding('class.float') float: boolean;
    @HostBinding('style.left.px') left: number;
    @HostBinding('style.top.px') top: number;
    @HostBinding('style.width.px') width: number;
    @HostBinding('style.height.px') height: number;
}
