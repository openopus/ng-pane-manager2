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
    ElementRef,
    Input,
    TemplateRef,
    ViewChild,
} from '@angular/core';

import {DropTarget} from './drag-n-drop';
import {LayoutNodeFactory, LeafNodeContext, PaneProperties} from './layout-node-factory';
import {NgPaneRendererDirective} from './ng-pane-renderer.directive';
import {NgPaneSlotComponent} from './ng-pane-slot/ng-pane-slot.component';
import {PaneLayout} from './pane-layout';

@Component({
    selector: 'ng-pane-manager',
    template: '<ng-container libNgPaneRenderer></ng-container>',
    styleUrls: ['./ng-pane-manager.component.scss'],
})
export class NgPaneManagerComponent {
    @ViewChild(NgPaneRendererDirective, {static: true}) readonly renderer!: NgPaneRendererDirective;

    private _layout!: PaneLayout;
    private _hitTargets: Map<ElementRef<Element>, DropTarget> = new Map();
    private rootSlot: ComponentRef<NgPaneSlotComponent>|undefined;
    readonly factory: LayoutNodeFactory;

    @Input()
    set layout(val: PaneLayout) {
        if (val === this._layout) return;

        this.factory.notifyLayoutChangeStart(this._hitTargets = new Map());

        const simplified = val.simplifyDeep();

        if (simplified !== undefined) val = simplified;

        this._layout = val;

        const oldRoot = this.rootSlot;

        this.rootSlot = this.factory.placeSlotForRootLayout(this.renderer.viewContainer,
                                                            this._layout);

        if (oldRoot !== undefined) oldRoot.destroy();

        this.factory.notifyLayoutChangeEnd();
    }

    get layout(): PaneLayout { return this._layout; }

    get hitTargets(): Readonly<Map<ElementRef<Element>, DropTarget>> { return this._hitTargets; }

    constructor(cfr: ComponentFactoryResolver, public el: ElementRef<HTMLElement>) {
        this.factory = new LayoutNodeFactory(this, cfr);
    }

    registerPanelTemplate(name: string,
                          paneProps: PaneProperties,
                          template: TemplateRef<LeafNodeContext>) {
        this.factory.registerTemplate(name, template, {$implicit: paneProps});
    }

    unregisterPanelTemplate(name: string) { this.factory.unregisterTemplate(name); }

    // Not a property because it's an O(n) operation
    getNativeHitTargets(): Map<Element, DropTarget> {
        const ret = new Map();

        for (const [key, val] of this._hitTargets) ret.set(key.nativeElement, val);

        return ret;
    }
}
