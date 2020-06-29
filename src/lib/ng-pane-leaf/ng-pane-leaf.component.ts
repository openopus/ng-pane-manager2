/*******************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-leaf.component.ts)
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

import {
    Component,
    ElementRef,
    Input,
    TemplateRef,
    ViewChild,
} from '@angular/core';

import {LeafNodeContext, LeafTemplate} from '../layout-node-factory';
import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';
import {LeafLayout} from '../pane-layout';

@Component({
    selector: 'lib-ng-pane-leaf',
    template: '<ng-container libNgPaneRenderer></ng-container>',
    styleUrls: ['./ng-pane-leaf.component.scss'],
})
export class NgPaneLeafComponent {
    @ViewChild(NgPaneRendererDirective, {static: true})
    private readonly renderer!: NgPaneRendererDirective;

    private _template: LeafTemplate|undefined;
    @Input() layout!: LeafLayout;

    @Input()
    set template(val: LeafTemplate|undefined) {
        if (this._template === val) return;

        this._template = val;

        this.renderer.viewContainer.clear();

        if (this._template !== undefined)
            this.renderer.viewContainer.createEmbeddedView<LeafNodeContext>(...this._template);
    }

    get template(): LeafTemplate|undefined { return this._template; }

    constructor(public el: ElementRef<HTMLElement>) {}
}
