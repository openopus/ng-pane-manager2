/***********************************************************************************************
 *
 * ng-pane-manager2 - a port of ng-pane-manager to Angular 2+ (ng-pane-branch-child.component.ts)
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
 **********************************************************************************************/

import {Component, HostBinding, ViewChild} from '@angular/core';

import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';

@Component({
    selector: 'lib-ng-pane-branch-child',
    template: `<div *ngIf="internalHeader" class="ng-pane-header">title</div>
<ng-container libNgPaneRenderer></ng-container>`,
    styleUrls: ['./ng-pane-branch-child.component.scss'],
})
export class NgPaneBranchChildComponent {
    @ViewChild(NgPaneRendererDirective, {static: true}) renderer: NgPaneRendererDirective;
    internalHeader: boolean;

    @HostBinding('style.flex-grow') ratio: number;
}
