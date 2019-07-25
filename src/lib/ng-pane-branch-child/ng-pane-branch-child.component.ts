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

import {Component, HostBinding, Input, ViewChild} from '@angular/core';

import {NgPaneManagerComponent} from '../ng-pane-manager.component';
import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';
import {BranchLayout} from '../pane-layout';

@Component({
    selector: 'lib-ng-pane-branch-child',
    template: `<lib-ng-pane-header
    *ngIf="internalHeader"
    [manager]="manager"
    [branch]="branch"
    [index]="index"></lib-ng-pane-header>
<ng-container libNgPaneRenderer></ng-container>`,
    styleUrls: ['./ng-pane-branch-child.component.scss'],
})
export class NgPaneBranchChildComponent {
    @ViewChild(NgPaneRendererDirective, {static: true}) renderer: NgPaneRendererDirective;
    @Input() internalHeader: boolean;
    @Input() manager: NgPaneManagerComponent;
    @Input() branch: BranchLayout;
    @Input() index: number;

    @HostBinding('style.flex-grow') ratio: number;
    @HostBinding('class.hidden') isHidden: boolean;
}
