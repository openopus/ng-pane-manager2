/************************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (angular-pane-manager.module.ts)
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
 ***********************************************************************************************/

import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {NgPaneHeaderComponent} from './ng-pane-header/ng-pane-header.component';
import {NgPaneLeafComponent} from './ng-pane-leaf/ng-pane-leaf.component';
import {NgPaneManagerComponent} from './ng-pane-manager/ng-pane-manager.component';
import {NgPaneRendererDirective} from './ng-pane-renderer.directive';
import {NgPaneSplitThumbComponent} from './ng-pane-split-thumb/ng-pane-split-thumb.component';
import {NgPaneSplitComponent} from './ng-pane-split/ng-pane-split.component';
import {NgPaneTabRowComponent} from './ng-pane-tab-row/ng-pane-tab-row.component';
import {NgPaneTabComponent} from './ng-pane-tab/ng-pane-tab.component';
import {NgPaneTabbedComponent} from './ng-pane-tabbed/ng-pane-tabbed.component';
import {NgPaneTemplateDirective} from './ng-pane-template.directive';
import {NgPaneComponent} from './ng-pane/ng-pane.component';

/**
 * The root Angular module for `angular-pane-manager`, providing the
 * `ng-pane-manager` tag, the `*ngPaneTemplate` directive, and all other
 * internal components used by `angular-pane-manager`.
 */
@NgModule({
    declarations: [
        NgPaneComponent,
        NgPaneHeaderComponent,
        NgPaneLeafComponent,
        NgPaneManagerComponent,
        NgPaneSplitComponent,
        NgPaneSplitThumbComponent,
        NgPaneTabComponent,
        NgPaneTabRowComponent,
        NgPaneTabbedComponent,
        NgPaneRendererDirective,
        NgPaneTemplateDirective,
    ],
    imports: [BrowserModule],
    exports: [NgPaneManagerComponent, NgPaneTemplateDirective],
    entryComponents: [],
})
export class AngularPaneManagerModule {
}
