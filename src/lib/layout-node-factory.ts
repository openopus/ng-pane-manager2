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

import {DropTarget, DropTargetType} from './drag-n-drop';
import {NgPaneBranchThumbComponent} from './ng-pane-branch-thumb/ng-pane-branch-thumb.component';
import {NgPaneBranchComponent} from './ng-pane-branch/ng-pane-branch.component';
import {NgPaneHeaderComponent} from './ng-pane-header/ng-pane-header.component';
import {NgPaneLeafComponent} from './ng-pane-leaf/ng-pane-leaf.component';
import {NgPaneManagerComponent} from './ng-pane-manager.component';
import {NgPaneSlotComponent} from './ng-pane-slot/ng-pane-slot.component';
import {NgPaneTabRowComponent} from './ng-pane-tab-row/ng-pane-tab-row.component';
import {BranchLayout, LayoutType, LeafLayout, PaneLayout} from './pane-layout';

export interface LeafNodeContext {}

interface ComponentInst<C> {
    component: ComponentRef<C>, container: ViewContainerRef, index: number,
}

export class LayoutNodeFactory {
    private branchFactory: ComponentFactory<any>;
    private leafFactory: ComponentFactory<any>;
    private headerFactory: ComponentFactory<any>;
    private slotFactory: ComponentFactory<any>;
    private branchThumbFactory: ComponentFactory<any>;
    private tabRowFactory: ComponentFactory<any>;

    // TODO: move the template dictionary into a global service

    private leaves: Map<string, ComponentInst<NgPaneLeafComponent>> = new Map();
    private templates: Map<string, TemplateRef<LeafNodeContext>>    = new Map();
    private dropTargets: Map<ElementRef<Element>, DropTarget>;

    constructor(private manager: NgPaneManagerComponent, cfr: ComponentFactoryResolver) {
        this.branchFactory      = cfr.resolveComponentFactory(NgPaneBranchComponent);
        this.leafFactory        = cfr.resolveComponentFactory(NgPaneLeafComponent);
        this.headerFactory      = cfr.resolveComponentFactory(NgPaneHeaderComponent);
        this.slotFactory        = cfr.resolveComponentFactory(NgPaneSlotComponent);
        this.branchThumbFactory = cfr.resolveComponentFactory(NgPaneBranchThumbComponent);
        this.tabRowFactory      = cfr.resolveComponentFactory(NgPaneTabRowComponent);
    }

    notifyLayoutChangeStart(dropTargets: Map<ElementRef<Element>, DropTarget>) {
        this.dropTargets = dropTargets;
    }

    notifyLayoutChangeEnd() {
        let remove = [];

        for (let [key, val] of this.leaves.entries()) {
            if (val.component.hostView.destroyed) remove.push(key);
        }

        remove.forEach(k => this.leaves.delete(k));
    }

    // ONLY FOR USE INSIDE placeComponentForLayout, DO NOT USE ANYWHERE ELSE
    private placeLeafForLayout(container: ViewContainerRef,
                               layout: LeafLayout): ElementRef<HTMLElement> {
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

        return inst.el;
    }

    // ONLY FOR USE INSIDE placeComponentForLayout, DO NOT USE ANYWHERE ELSE
    private placeBranchForLayout(container: ViewContainerRef,
                                 layout: BranchLayout): ElementRef<HTMLElement> {
        const component = container.createComponent(this.branchFactory) as
                          ComponentRef<NgPaneBranchComponent>;

        const inst = component.instance;

        inst.factory = this;
        inst.layout  = layout;

        return inst.el;
    }

    placeComponentForLayout(container: ViewContainerRef, layout: PaneLayout) {
        let el: ElementRef<HTMLElement>;

        switch (layout.type) {
        case LayoutType.Horiz:
        case LayoutType.Vert:
        case LayoutType.Tabbed: el = this.placeBranchForLayout(container, layout); break;
        case LayoutType.Leaf: el = this.placeLeafForLayout(container, layout); break;
        }

        this.dropTargets.set(el, {type: DropTargetType.Pane, layout});
    }

    // ONLY FOR USE INSIDE placeHeaderFor*, DO NOT USE ANYWHERE ELSE
    private placeHeader(container: ViewContainerRef, branch: BranchLayout, index: number):
        ElementRef<HTMLElement> {
        const component = container.createComponent(this.headerFactory) as
                          ComponentRef<NgPaneHeaderComponent>;

        const inst = component.instance;

        inst.manager = this.manager;
        inst.branch  = branch;
        inst.index   = index;

        return inst.el;
    }

    private placeHeaderForLayout(container: ViewContainerRef,
                                 layout: PaneLayout,
                                 branch: BranchLayout,
                                 index: number) {
        const el = this.placeHeader(container, branch, index);

        this.dropTargets.set(el, {type: DropTargetType.Header, layout});
    }

    private placeSlot(container: ViewContainerRef,
                      internalHeader: boolean,
                      layout: PaneLayout,
                      branch?: BranchLayout,
                      index?: number): ComponentRef<NgPaneSlotComponent> {
        const component = container.createComponent(this.slotFactory) as
                          ComponentRef<NgPaneSlotComponent>;

        const inst = component.instance;

        if (internalHeader)
            this.placeHeaderForLayout(inst.renderer.viewContainer, layout, branch, index);

        this.placeComponentForLayout(inst.renderer.viewContainer, layout);

        return component;
    }

    placeSlotForLayout(container: ViewContainerRef, branch: BranchLayout, index: number):
        NgPaneSlotComponent {
        const component = this.placeSlot(container,
                                         branch.type !== LayoutType.Tabbed &&
                                             branch.children[index].type === LayoutType.Leaf,
                                         branch.children[index],
                                         branch,
                                         index);

        const inst = component.instance;

        if (branch.ratios) inst.ratio = branch.ratios[index];
        inst.isHidden = branch.type === LayoutType.Tabbed && branch.currentTabIndex !== index;

        return inst;
    }

    placeSlotForRootLayout(container: ViewContainerRef,
                           root: PaneLayout): ComponentRef<NgPaneSlotComponent> {
        const component = this.placeSlot(container, root.type === LayoutType.Leaf, root);

        const inst = component.instance;

        inst.isHidden = false;

        return component;
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

    private updateLeavesWithTemplate(name: string) {
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

        this.updateLeavesWithTemplate(name);
    }

    unregisterTemplate(name: string) {
        if (this.templates.delete(name)) this.updateLeavesWithTemplate(name);
    }
}