/**************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane.component.ts)
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
 *************************************************************************************/

import {Component, ComponentRef, HostBinding, ViewChild} from '@angular/core';

import {NgPaneLeafComponent} from '../ng-pane-leaf/ng-pane-leaf.component';
import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';
import {NgPaneSplitComponent} from '../ng-pane-split/ng-pane-split.component';
import {NgPaneTabbedComponent} from '../ng-pane-tabbed/ng-pane-tabbed.component';
import {PaneHeader, PaneHeaderType} from '../pane-factory';
import {ChildLayoutId} from '../pane-layout/module';

@Component({
    selector: 'lib-ng-pane',
    template: '<ng-container libNgPaneRenderer></ng-container>',
    styleUrls: ['./ng-pane.component.scss'],
})
export class NgPaneComponent {
    @ViewChild(NgPaneRendererDirective, {static: true}) renderer!: NgPaneRendererDirective;

    @HostBinding('style.flex-grow') ratio: number|undefined;
    @HostBinding('class.lib-ng-pane-hidden') hidden = false;

    childId!: ChildLayoutId;
    header: PaneHeader = {type: PaneHeaderType.None};
    content: ComponentRef<NgPaneSplitComponent|NgPaneLeafComponent|NgPaneTabbedComponent>|undefined;
}
