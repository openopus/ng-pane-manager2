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
    ElementRef,
    TemplateRef,
    ViewContainerRef
} from '@angular/core';

import {NgPaneBranchChildComponent} from './ng-pane-branch-child/ng-pane-branch-child.component';
import {NgPaneBranchThumbComponent} from './ng-pane-branch-thumb/ng-pane-branch-thumb.component';
import {NgPaneBranchComponent} from './ng-pane-branch/ng-pane-branch.component';
import {NgPaneLeafComponent} from './ng-pane-leaf/ng-pane-leaf.component';
import {NgPaneManagerComponent} from './ng-pane-manager.component';
import {NgPaneTabRowComponent} from './ng-pane-tab-row/ng-pane-tab-row.component';
import {BranchLayout, LayoutType, LeafLayout, PaneLayout} from './pane-layout';

export interface LeafNodeContext {}

interface ComponentInst<C> {
    component: ComponentRef<C>, container: ViewContainerRef, index: number,
}

export class LayoutNodeFactory {
    private branchFactory: ComponentFactory<any>;
    private leafFactory: ComponentFactory<any>;
    private childFactory: ComponentFactory<any>;
    private branchThumbFactory: ComponentFactory<any>;
    private tabRowFactory: ComponentFactory<any>;

    // TODO: leaves are never unregistered...this is Not Good
    private leaves: Map<string, ComponentInst<NgPaneLeafComponent>> = new Map();

    private templates: Map<string, TemplateRef<LeafNodeContext>> = new Map();

    constructor(private manager: NgPaneManagerComponent, private cfr: ComponentFactoryResolver) {
        this.branchFactory      = cfr.resolveComponentFactory(NgPaneBranchComponent);
        this.leafFactory        = cfr.resolveComponentFactory(NgPaneLeafComponent);
        this.childFactory       = cfr.resolveComponentFactory(NgPaneBranchChildComponent);
        this.branchThumbFactory = cfr.resolveComponentFactory(NgPaneBranchThumbComponent);
        this.tabRowFactory      = cfr.resolveComponentFactory(NgPaneTabRowComponent);
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

    placeComponentForLayout(container: ViewContainerRef, layout: PaneLayout) {
        switch (layout.type) {
        case LayoutType.Horiz:
        case LayoutType.Vert:
        case LayoutType.Tabbed: this.placeBranchForLayout(container, layout); break;
        case LayoutType.Leaf: this.placeLeafForLayout(container, layout); break;
        }
    }

    placeBranchChildForLayout(container: ViewContainerRef,
                              branch: BranchLayout,
                              index: number,
                              ratio: number,
                              isHidden: boolean,
                              internalHeader: boolean): NgPaneBranchChildComponent {
        const component = container.createComponent(this.childFactory) as
                          ComponentRef<NgPaneBranchChildComponent>;

        const inst = component.instance;

        inst.ratio          = ratio;
        inst.isHidden       = isHidden;
        inst.internalHeader = internalHeader;
        inst.manager        = this.manager;
        inst.branch         = branch;
        inst.index          = index;

        this.placeComponentForLayout(inst.renderer.viewContainer, branch.children[index]);

        return inst;
    }

    placeBranchThumb(container: ViewContainerRef,
                     branchEl: ElementRef<HTMLElement>,
                     index: number,
                     layout: BranchLayout) {
        const component = container.createComponent(this.branchThumbFactory) as
                          ComponentRef<NgPaneBranchThumbComponent>;

        const inst = component.instance;

        inst.branchEl = branchEl;
        inst.index    = index;
        inst.layout   = layout;
    }

    placeTabRow(container: ViewContainerRef, layout: BranchLayout&{type: LayoutType.Tabbed}) {
        const component = container.createComponent(this.tabRowFactory) as
                          ComponentRef<NgPaneTabRowComponent>;

        const inst = component.instance;

        inst.manager = this.manager;
        inst.layout  = layout;
    }

    private updateLeaveWithTemplate(name: string) {
        const template = this.templates.get(name);

        for (let leaf of this.leaves.values()) {
            const inst = leaf.component.instance;

            if (inst.layout.template === name) inst.template = template;
        }
    }

    registerTemplate(name: string, template: TemplateRef<LeafNodeContext>) {
        if (this.templates.has(name))
            throw new Error(`panel template '${name}' already registered`);

        this.templates.set(name, template);

        this.updateLeaveWithTemplate(name);
    }

    unregisterTemplate(name: string) {
        if (this.templates.delete(name)) this.updateLeaveWithTemplate(name);
    }
}