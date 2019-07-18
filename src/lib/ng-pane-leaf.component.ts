/***************************************************************************************
 *
 * ng-pane-manager2 - a port of ng-pane-manager to Angular 2+ (ng-pane-leaf.component.ts)
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
 **************************************************************************************/

import {Component, Input, OnInit, TemplateRef, ViewChild, ViewContainerRef} from '@angular/core';

import {NgPaneManagerContext} from './ng-pane-manager.component';

@Component({selector: 'lib-ng-pane-leaf', template: '', styles: []})
export class NgPaneLeafComponent {
    private _template?: TemplateRef<NgPaneManagerContext>;

    @Input()
    set template(val: TemplateRef<NgPaneManagerContext>) {
        if (this._template === val) return;

        this._template = val;

        this.viewContainer.clear();
        this.viewContainer.createEmbeddedView(this._template, new NgPaneManagerContext());
    }

    get template(): TemplateRef<NgPaneManagerContext> { return this._template; }

    constructor(private viewContainer: ViewContainerRef) {}
}
