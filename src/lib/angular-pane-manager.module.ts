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
import {NgPaneSplitComponent} from './ng-pane-split/ng-pane-split.component';
import {NgPaneTabRowComponent} from './ng-pane-tab-row/ng-pane-tab-row.component';
import {NgPaneTabComponent} from './ng-pane-tab/ng-pane-tab.component';
import {NgPaneTitleComponent} from './ng-pane-title/ng-pane-title.component';
import {NgPaneComponent} from './ng-pane/ng-pane.component';

@NgModule({
    declarations: [
        NgPaneComponent,
        NgPaneHeaderComponent,
        NgPaneLeafComponent,
        NgPaneManagerComponent,
        NgPaneSplitComponent,
        NgPaneTabComponent,
        NgPaneTabRowComponent,
        NgPaneTitleComponent,
        NgPaneRendererDirective,
    ],
    imports: [BrowserModule],
    exports: [NgPaneManagerComponent],
    entryComponents: [],
})
export class AngularPaneManagerModule {
}
