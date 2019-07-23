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

import {Component, Input, TemplateRef, ViewChild} from '@angular/core';

import {LeafNodeContext} from '../layout-node-factory';
import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';
import {LeafLayout} from '../pane-layout';

@Component({
    selector: 'lib-ng-pane-leaf',
    template: '<ng-container libNgPaneRenderer></ng-container>',
    styleUrls: ['./ng-pane-leaf.component.scss'],
})
export class NgPaneLeafComponent {
    @ViewChild(NgPaneRendererDirective, {static: true}) private renderer: NgPaneRendererDirective;

    private _template?: TemplateRef<LeafNodeContext>;
    @Input() layout: LeafLayout;

    @Input()
    set template(val: TemplateRef<LeafNodeContext>) {
        if (this._template === val) return;

        this._template = val;

        this.renderer.viewContainer.clear();

        if (this._template) this.renderer.viewContainer.createEmbeddedView(this._template, {});
    }

    get template(): TemplateRef<LeafNodeContext> { return this._template; }

    constructor() {}
}
