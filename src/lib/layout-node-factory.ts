/****************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (layout-node-factory.ts)
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
 ***************************************************************************************/

import {
    ComponentFactory,
    ComponentFactoryResolver,
    ComponentRef,
    ElementRef,
    TemplateRef,
    ViewContainerRef,
} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';

import {DropTarget, DropTargetType} from './drag-n-drop';
import {NgPaneBranchThumbComponent} from './ng-pane-branch-thumb/ng-pane-branch-thumb.component';
import {NgPaneBranchComponent} from './ng-pane-branch/ng-pane-branch.component';
import {
    NgPaneDropHighlightComponent,
} from './ng-pane-drop-highlight/ng-pane-drop-highlight.component';
import {NgPaneHeaderComponent} from './ng-pane-header/ng-pane-header.component';
import {NgPaneLeafComponent} from './ng-pane-leaf/ng-pane-leaf.component';
import {NgPaneManagerComponent} from './ng-pane-manager.component';
import {NgPaneSlotComponent} from './ng-pane-slot/ng-pane-slot.component';
import {NgPaneTabRowComponent} from './ng-pane-tab-row/ng-pane-tab-row.component';
import {NgPaneTabComponent} from './ng-pane-tab/ng-pane-tab.component';
import {BranchChildId, BranchLayout, LayoutType, LeafLayout, PaneLayout} from './pane-layout';

// TODO: add the ability to prevent tabifying panes (e.g. headerless toolbars)
// TODO: add constraints/disable resizing?
export const enum PaneHeaderMode {
    Hidden,
    Visible,
    AlwaysTab,
}

export type StringHeaderMode = 'hidden'|'visible'|'alwaysTab';

// TODO: make closable actually do something
export interface PaneProperties {
    headerMode: PaneHeaderMode;
    title: Observable<string>;
    icon: Observable<string|undefined>;
    closable: boolean;
}

export function paneProps(headerMode: StringHeaderMode|PaneHeaderMode,
                          title: string|Observable<string>,
                          icon: string|Observable<string|undefined>|undefined,
                          closable: boolean): PaneProperties {
    if (typeof headerMode === 'string') {
        switch (headerMode) {
        case 'hidden': headerMode = PaneHeaderMode.Hidden; break;
        case 'visible': headerMode = PaneHeaderMode.Visible; break;
        case 'alwaysTab': headerMode = PaneHeaderMode.AlwaysTab; break;
        }
    }

    return {
        headerMode,
        title: typeof                      title === 'string' ? new BehaviorSubject(title) : title,
        icon: icon === undefined || typeof icon === 'string' ? new BehaviorSubject(icon) : icon,
        closable,
    };
}

// TODO: add support for passing parameters into the templates from the layout
export interface LeafNodeContext {
    $implicit: PaneProperties;
}

interface ComponentInst<C> {
    component: ComponentRef<C>;
    container: ViewContainerRef;
    index: number;
}

export type LeafTemplate = [TemplateRef<LeafNodeContext>, LeafNodeContext];

export class LayoutNodeFactory {
    private readonly branchFactory: ComponentFactory<any>;
    private readonly leafFactory: ComponentFactory<any>;
    private readonly headerFactory: ComponentFactory<any>;
    private readonly slotFactory: ComponentFactory<any>;
    private readonly branchThumbFactory: ComponentFactory<any>;
    private readonly tabRowFactory: ComponentFactory<any>;
    private readonly tabFactory: ComponentFactory<any>;
    private readonly dropHighlightFactory: ComponentFactory<any>;

    // TODO: move the template dictionary into a global service
    // TODO: run stress tests to check for possible leaks of undisposed resources
    //       (e.g. leaves and leafHeaders)

    private readonly leaves: Map<string, ComponentInst<NgPaneLeafComponent>> = new Map();
    private readonly leafHeaders:
        Map<string,
            ComponentRef<NgPaneHeaderComponent>|ComponentRef<NgPaneTabComponent>> = new Map();
    private readonly templates: Map<string, LeafTemplate>                         = new Map();
    private dropTargets!: Map<ElementRef<Element>, DropTarget>;

    constructor(private readonly manager: NgPaneManagerComponent, cfr: ComponentFactoryResolver) {
        this.branchFactory        = cfr.resolveComponentFactory(NgPaneBranchComponent);
        this.leafFactory          = cfr.resolveComponentFactory(NgPaneLeafComponent);
        this.headerFactory        = cfr.resolveComponentFactory(NgPaneHeaderComponent);
        this.slotFactory          = cfr.resolveComponentFactory(NgPaneSlotComponent);
        this.branchThumbFactory   = cfr.resolveComponentFactory(NgPaneBranchThumbComponent);
        this.tabRowFactory        = cfr.resolveComponentFactory(NgPaneTabRowComponent);
        this.tabFactory           = cfr.resolveComponentFactory(NgPaneTabComponent);
        this.dropHighlightFactory = cfr.resolveComponentFactory(NgPaneDropHighlightComponent);
    }

    notifyLayoutChangeStart(dropTargets: Map<ElementRef<Element>, DropTarget>) {
        this.dropTargets = dropTargets;
    }

    notifyLayoutChangeEnd() {
        {
            const remove = [];

            for (const [key, val] of this.leaves.entries()) {
                if (val.component.hostView.destroyed) remove.push(key);
            }

            remove.forEach(k => this.leaves.delete(k));
        }

        {
            const remove = [];

            for (const [key, val] of this.leafHeaders.entries()) {
                if (val.hostView.destroyed) remove.push(key);
            }

            remove.forEach(k => this.leaves.delete(k));
        }
    }

    private panePropsForLayout(layout: PaneLayout): PaneProperties {
        if (layout.type === LayoutType.Leaf) {
            const template = this.templates.get(layout.template);

            if (template === undefined) {
                return {
                    headerMode: PaneHeaderMode.Visible,
                    title: new BehaviorSubject('???'),
                    icon: new BehaviorSubject(undefined),
                    closable: true,
                };
            }

            return template[1].$implicit;
        }

        // TODO: calculate pane properties for branches
        return {
            headerMode: PaneHeaderMode.Visible,
            title: new BehaviorSubject('BRANCH'),
            icon: new BehaviorSubject(undefined),
            closable: false,
        };
    }

    private updatePaneHeader(inst: NgPaneHeaderComponent|NgPaneTabComponent, layout: PaneLayout) {
        inst.paneProps = this.panePropsForLayout(layout);
    }

    // ONLY FOR USE INSIDE placeComponentForLayout, DO NOT USE ANYWHERE ELSE
    private placeLeafForLayout(container: ViewContainerRef,
                               layout: LeafLayout): ElementRef<HTMLElement> {
        let leaf = this.leaves.get(layout.id);

        if (leaf !== undefined) {
            const view     = leaf.container.detach(leaf.index);
            const newIndex = container.length;

            if (view !== null) container.insert(view);

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
                                 layout: BranchLayout,
                                 childId: BranchChildId|undefined): ElementRef<HTMLElement> {
        const component = container.createComponent(this.branchFactory) as
                          ComponentRef<NgPaneBranchComponent>;

        const inst = component.instance;

        inst.factory = this;
        inst.childId = childId;
        inst.layout  = layout;

        return inst.el;
    }

    placeComponentForLayout(container: ViewContainerRef,
                            layout: PaneLayout,
                            childId: BranchChildId|undefined) {
        let el: ElementRef<HTMLElement>;

        switch (layout.type) {
        case LayoutType.Horiz:
        case LayoutType.Vert:
        case LayoutType.Tabbed: el = this.placeBranchForLayout(container, layout, childId); break;
        case LayoutType.Leaf: el = this.placeLeafForLayout(container, layout); break;
        default: throw new Error('invalid layout type');
        }

        this.dropTargets.set(el, {type: DropTargetType.Pane, layout});
    }

    // ONLY FOR USE INSIDE placeHeaderFor*, DO NOT USE ANYWHERE ELSE
    private placeHeader(container: ViewContainerRef,
                        layout: PaneLayout,
                        childId: BranchChildId|undefined): ElementRef<HTMLElement> {
        const component = container.createComponent(this.headerFactory) as
                          ComponentRef<NgPaneHeaderComponent>;

        const inst = component.instance;

        inst.manager = this.manager;
        inst.childId = childId;

        if (layout.type === LayoutType.Leaf) this.leafHeaders.set(layout.id, component);

        this.updatePaneHeader(inst, layout);

        return inst.el;
    }

    // TODO: there's several instances of layout+childId as parameters.  This
    //       seems redundant, can this be fixed?
    private placeHeaderForLayout(container: ViewContainerRef,
                                 layout: PaneLayout,
                                 childId: BranchChildId|undefined) {
        const props = this.panePropsForLayout(layout);

        switch (props.headerMode) {
        case PaneHeaderMode.Hidden: break;
        case PaneHeaderMode.Visible:
            const el = this.placeHeader(container, layout, childId);
            this.dropTargets.set(el, {type: DropTargetType.Header, layout});
            break;
        case PaneHeaderMode.AlwaysTab: this.placeTabRow(container, layout, childId); break;
        }
    }

    private placeSlot(container: ViewContainerRef,
                      internalHeader: boolean,
                      layout: PaneLayout,
                      childId?: BranchChildId): ComponentRef<NgPaneSlotComponent> {
        const component = container.createComponent(this.slotFactory) as
                          ComponentRef<NgPaneSlotComponent>;

        const inst = component.instance;

        if (internalHeader) this.placeHeaderForLayout(inst.renderer.viewContainer, layout, childId);

        this.placeComponentForLayout(inst.renderer.viewContainer, layout, childId);

        return component;
    }

    placeSlotForLayout(container: ViewContainerRef, childId: BranchChildId): NgPaneSlotComponent {
        const {branch, index} = childId;
        const component       = this.placeSlot(container,
                                         branch.type !== LayoutType.Tabbed &&
                                             branch.children[index].type === LayoutType.Leaf,
                                         branch.children[index],
                                         childId);

        const inst = component.instance;

        if (branch.ratios !== undefined) inst.ratio = branch.ratios[index];
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

    placeTabRow(container: ViewContainerRef, layout: PaneLayout, childId: BranchChildId|undefined) {
        const component = container.createComponent(this.tabRowFactory) as
                          ComponentRef<NgPaneTabRowComponent>;

        const inst = component.instance;

        inst.manager = this.manager;
        inst.factory = this;
        inst.childId = childId;
        inst.layout  = layout;

        this.dropTargets.set(inst.el, {type: DropTargetType.Header, layout});
    }

    placeTab(container: ViewContainerRef, childId: BranchChildId) {
        const component = container.createComponent(this.tabFactory) as
                          ComponentRef<NgPaneTabComponent>;

        const inst = component.instance;

        inst.manager = this.manager;
        inst.childId = childId;

        this.dropTargets.set(inst.el, {type: DropTargetType.Tab, id: childId});

        const child = childId.branch.children[childId.index];

        if (child.type === LayoutType.Leaf) this.leafHeaders.set(child.id, component);

        this.updatePaneHeader(inst, child);

        return inst;
    }

    placeDropHighlight(container: ViewContainerRef): ComponentRef<NgPaneDropHighlightComponent> {
        const component = container.createComponent(this.dropHighlightFactory) as
                          ComponentRef<NgPaneDropHighlightComponent>;

        return component;
    }

    // TODO: re-render headers if the header display type changed
    private updateLeavesWithTemplate(name: string) {
        const template = this.templates.get(name);

        for (const leaf of this.leaves.values()) {
            const inst = leaf.component.instance;

            if (inst.layout.template === name) {
                inst.template = template;

                const header = this.leafHeaders.get(inst.layout.id);

                if (header !== undefined) this.updatePaneHeader(header.instance, inst.layout);
            }
        }
    }

    registerTemplate(name: string,
                     template: TemplateRef<LeafNodeContext>,
                     context: LeafNodeContext) {
        if (this.templates.has(name)) throw new Error(`pane template '${name}' already registered`);

        this.templates.set(name, [template, context]);

        this.updateLeavesWithTemplate(name);
    }

    unregisterTemplate(name: string) {
        if (this.templates.delete(name)) this.updateLeavesWithTemplate(name);
    }
}
