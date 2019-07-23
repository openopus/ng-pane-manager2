/************************************************************************************
 *
 * ng-pane-manager2 - a port of ng-pane-manager to Angular 2+ (layout-node-factory.ts)
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
 ***********************************************************************************/

import {
    ComponentFactory,
    ComponentFactoryResolver,
    ComponentRef,
    TemplateRef,
    ViewContainerRef
} from '@angular/core';

import {NgPaneBranchChildComponent} from './ng-pane-branch-child/ng-pane-branch-child.component';
import {NgPaneBranchComponent} from './ng-pane-branch/ng-pane-branch.component';
import {NgPaneLeafComponent} from './ng-pane-leaf/ng-pane-leaf.component';
import {BranchLayout, LayoutType, LeafLayout, PaneLayout} from './pane-layout';

export interface LeafNodeContext {}

interface ComponentInst<C> {
    component: ComponentRef<C>, container: ViewContainerRef, index: number,
}

export class LayoutNodeFactory {
    private branchFactory: ComponentFactory<any>;
    private leafFactory: ComponentFactory<any>;
    private childFactory: ComponentFactory<any>;

    // TODO: leaves are never unregistered...this is Not Good
    private leaves: Map<string, ComponentInst<NgPaneLeafComponent>> = new Map();

    private templates: Map<string, TemplateRef<LeafNodeContext>> = new Map();

    constructor(private cfr: ComponentFactoryResolver) {
        this.branchFactory = cfr.resolveComponentFactory(NgPaneBranchComponent);
        this.leafFactory   = cfr.resolveComponentFactory(NgPaneLeafComponent);
        this.childFactory  = cfr.resolveComponentFactory(NgPaneBranchChildComponent);
    }

    private placeLeafForLayout(container: ViewContainerRef, layout: LeafLayout) {
        let leaf = this.leaves.get(layout.id);

        if (leaf) {
            const view     = leaf.container.detach(leaf.index);
            const newIndex = container.length;

            container.insert(view);

            leaf.container = container;
            leaf.index     = newIndex;
        }
        else {
            const index = container.length;

            const component = container.createComponent(this.leafFactory);

            this.leaves.set(layout.id, leaf = {component, container, index});
        }

        const inst = leaf.component.instance;

        inst.template = this.templates.get(layout.template);
        inst.layout   = layout;
    }

    private placeBranchForLayout(container: ViewContainerRef, layout: BranchLayout) {
        const component = container.createComponent(this.branchFactory) as
                          ComponentRef<NgPaneBranchComponent>;

        const inst = component.instance;

        inst.factory = this;
        inst.layout  = layout;
    }

    public placeComponentForLayout(container: ViewContainerRef, layout: PaneLayout) {
        switch (layout.type) {
        case LayoutType.Horiz:
        case LayoutType.Vert:
        case LayoutType.Tabbed: this.placeBranchForLayout(container, layout); break;
        case LayoutType.Leaf: this.placeLeafForLayout(container, layout); break;
        }
    }

    public placeBranchChildForLayout(container: ViewContainerRef,
                                     layout: PaneLayout,
                                     internalHeader: boolean) {
        const component = container.createComponent(this.childFactory) as
                          ComponentRef<NgPaneBranchChildComponent>;

        const inst = component.instance;

        inst.internalHeader = internalHeader;

        return this.placeComponentForLayout(inst.renderer.viewContainer, layout);
    }

    private updateLeaveWithTemplate(name: string) {
        const template = this.templates.get(name);

        for (let leaf of this.leaves.values()) {
            const inst = leaf.component.instance;

            if (inst.layout.template === name) inst.template = template;
        }
    }

    public registerTemplate(name: string, template: TemplateRef<LeafNodeContext>) {
        if (this.templates.has(name))
            throw new Error(`panel template '${name}' already registered`);

        this.templates.set(name, template);

        this.updateLeaveWithTemplate(name);
    }

    public unregisterTemplate(name: string) {
        if (this.templates.delete(name)) this.updateLeaveWithTemplate(name);
    }
}