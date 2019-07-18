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
    AfterViewInit,
    Component,
    ComponentFactory,
    ComponentFactoryResolver,
    TemplateRef,
    ViewContainerRef
} from '@angular/core';

import {NgPaneLeafComponent} from './ng-pane-leaf.component';

export class NgPaneManagerContext {
    constructor() {}
}

@Component({selector: 'ng-pane-manager', template: '', styles: []})
export class NgPaneManagerComponent implements AfterViewInit {
    panelTemplates: Map<string, TemplateRef<NgPaneManagerContext>> = new Map();
    leaves: Map<string, NgPaneLeafComponent[]> = new Map(); // Template ID -> leaves
    leafFactory: ComponentFactory<any>;

    constructor(cfr: ComponentFactoryResolver, private viewContainer: ViewContainerRef) {
        this.leafFactory = cfr.resolveComponentFactory(NgPaneLeafComponent);
    }

    ngAfterViewInit() {
        this.viewContainer.clear();
        var comp = this.viewContainer.createComponent(this.leafFactory);

        this.addLeaf('test1', comp.instance);
    }

    private updateTemplate(name: string) {
        const leaves = this.leaves.get(name);

        if (!leaves) return;

        const template = this.panelTemplates.get(name);
        leaves.forEach(leaf => leaf.template = template);
    }

    public registerPanelTemplate(name: string, template: TemplateRef<NgPaneManagerContext>) {
        if (this.panelTemplates.has(name))
            throw new Error(`panel template '${name}' already registered`);

        this.panelTemplates.set(name, template);

        this.updateTemplate(name);
    }

    public unregisterPanelTemplate(name: string) {
        this.panelTemplates.delete(name);

        this.updateTemplate(name);
    }

    public addLeaf(template: string, leaf: NgPaneLeafComponent) {
        if (this.leaves.has(template))
            this.leaves.get(template).push(leaf);
        else
            this.leaves.set(template, [leaf]);

        leaf.template = this.panelTemplates.get(template);
    }
}
