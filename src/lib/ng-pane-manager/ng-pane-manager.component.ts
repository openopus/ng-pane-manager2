/**********************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-manager.component.ts)
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
 *********************************************************************************************/

import {
    Component,
    ComponentFactoryResolver,
    ComponentRef,
    Input,
    TemplateRef,
    ViewChild,
} from '@angular/core';

import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';
import {NgPaneComponent} from '../ng-pane/ng-pane.component';
import {PaneFactory} from '../pane-factory';
import {LayoutType, RootLayout} from '../pane-layout/module';
import {LeafNodeContext, PaneHeaderStyle} from '../pane-template';

@Component({
    selector: 'ng-pane-manager',
    template: '<ng-container libNgPaneRenderer></ng-container>',
    styleUrls: ['./ng-pane-manager.component.scss'],
})
export class NgPaneManagerComponent {
    @ViewChild(NgPaneRendererDirective, {static: true}) readonly renderer!: NgPaneRendererDirective;

    private _layout: RootLayout|undefined;
    private pane: ComponentRef<NgPaneComponent>|undefined;
    readonly factory: PaneFactory;

    @Input()
    get layout(): RootLayout|undefined {
        return this._layout;
    }

    set layout(val: RootLayout|undefined) {
        if (val === this._layout) return;

        if (val !== undefined) {
            if (val.type !== LayoutType.Root)
                throw new Error('invalid layout type for pane manager - must be a root layout');

            const simplified = val.simplifyDeep();

            if (simplified !== undefined) {
                if (simplified.type !== LayoutType.Root)
                    throw new Error('invalid simplification - root layout collapsed into child');

                val = simplified;
            }
        }

        this._layout = val;

        const oldPane = this.pane;

        // TODO: notify layout change start

        try {
            this.pane = val !== undefined
                            ? this.factory.placePane(this.renderer.viewContainer, val.childId())
                            : undefined;
        }
        finally {
            // TODO: notify layout change end
            if (oldPane !== undefined) oldPane.destroy();
        }
    }

    constructor(cfr: ComponentFactoryResolver) { this.factory = new PaneFactory(cfr); }

    registerLeafTemplate(name: string,
                         header: PaneHeaderStyle,
                         template: TemplateRef<LeafNodeContext>) {
        this.factory.registerLeafTemplate(name, header, template);
    }

    unregisterLeafTemplate(name: string) { this.factory.unregisterLeafTemplate(name); }
}
