/******************************************************************************************
 *
 * ng-pane-manager2 - a port of ng-pane-manager to Angular 2+ (ng-pane-manager.component.ts)
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
 *****************************************************************************************/

import {
    Component,
    ComponentFactoryResolver,
    Input,
    TemplateRef,
    ViewChild,
} from '@angular/core';

import {LayoutNodeFactory, LeafNodeContext} from './layout-node-factory';
import {NgPaneRendererDirective} from './ng-pane-renderer.directive';
import {PaneLayout} from './pane-layout';

@Component({
    selector: 'ng-pane-manager',
    template: '<ng-container libNgPaneRenderer></ng-container>',
    styleUrls: ['./ng-pane-manager.component.scss'],
})
export class NgPaneManagerComponent {
    @ViewChild(NgPaneRendererDirective, {static: true}) private renderer: NgPaneRendererDirective;

    private _layout: PaneLayout;
    private factory: LayoutNodeFactory;

    @Input()
    set layout(val: PaneLayout) {
        this._layout = val && (val.simplifyDeep() || val);

        const oldView = this.renderer.viewContainer.detach();

        this.factory.placeComponentForLayout(this.renderer.viewContainer, this._layout);

        if (oldView) oldView.destroy();
    }

    get layout(): PaneLayout { return this._layout; }

    constructor(cfr: ComponentFactoryResolver) { this.factory = new LayoutNodeFactory(this, cfr); }

    registerPanelTemplate(name: string, template: TemplateRef<LeafNodeContext>) {
        this.factory.registerTemplate(name, template);
    }

    unregisterPanelTemplate(name: string) { this.factory.unregisterTemplate(name); }
}
