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

import {Component, ElementRef, ViewChild} from '@angular/core';

import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';
import {NgPaneComponent} from '../ng-pane/ng-pane.component';
import {LeafLayout} from '../pane-layout/module';
import {LeafNodeContext, LeafNodeTemplate} from '../pane-template';

/**
 * A leaf pane node, containing only a rendered template.
 */
@Component({
    selector: 'lib-ng-pane-leaf',
    template: '<ng-container libNgPaneRenderer></ng-container>',
    styleUrls: ['./ng-pane-leaf.component.scss'],
})
export class NgPaneLeafComponent {
    /** Provides a view container to render into */
    @ViewChild(NgPaneRendererDirective, {static: true})
    private readonly renderer!: NgPaneRendererDirective;

    /** See `template`. */
    private _template: LeafNodeTemplate|undefined;
    /**
     * The pane containing this leaf node.\
     * Used by `PaneFactory`.
     */
    public pane!: NgPaneComponent;
    /** The layout node corresponding to this pane */
    public layout!: LeafLayout;

    /** The leaf pane template to render */
    public get template(): LeafNodeTemplate|undefined { return this._template; }

    public set template(val: LeafNodeTemplate|undefined) {
        if (val === this._template) { return; }

        this._template = val;

        this.renderer.viewContainer.clear();

        if (val !== undefined) {
            this.renderer.viewContainer.createEmbeddedView<LeafNodeContext>(...val);
        }
    }

    /**
     * Construct a new leaf pane.
     * @param el injected for use in computing drag-and-drop hit targets
     */
    public constructor(public readonly el: ElementRef<HTMLElement>) {}
}
