/*********************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (pane-factory.ts)
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
 ********************************************************************************/

import {
    ComponentFactory,
    ComponentFactoryResolver,
    ComponentRef,
    ElementRef,
    TemplateRef,
    ViewContainerRef,
} from '@angular/core';
import {BehaviorSubject} from 'rxjs';

import {DropTarget, DropTargetType} from './drag-and-drop';
import {NgPaneHeaderComponent} from './ng-pane-header/ng-pane-header.component';
import {NgPaneLeafComponent} from './ng-pane-leaf/ng-pane-leaf.component';
import {NgPaneManagerComponent} from './ng-pane-manager/ng-pane-manager.component';
import {NgPaneSplitThumbComponent} from './ng-pane-split-thumb/ng-pane-split-thumb.component';
import {NgPaneSplitComponent} from './ng-pane-split/ng-pane-split.component';
import {NgPaneTabRowComponent} from './ng-pane-tab-row/ng-pane-tab-row.component';
import {NgPaneTabComponent} from './ng-pane-tab/ng-pane-tab.component';
import {NgPaneTabbedComponent} from './ng-pane-tabbed/ng-pane-tabbed.component';
import {NgPaneComponent} from './ng-pane/ng-pane.component';
import {
    childFromId,
    ChildLayout,
    ChildLayoutId,
    ChildWithId,
    LayoutType,
    LeafLayout,
    SplitLayout,
    TabbedLayout,
} from './pane-layout/module';
import {LeafNodeContext, LeafNodeTemplate, PaneHeaderMode, PaneHeaderStyle} from './pane-template';

interface LeafTemplateInfo {
    template: TemplateRef<LeafNodeContext>;
    header: PaneHeaderStyle;
}

// Used to identify different values of NgPaneComponent.header
export const enum PaneHeaderType {
    None,
    Skip,
    Header,
    TabRow,
    Tab,
}

// NOTE: using {type: PaneHeaderType.None|PaneHeaderType.Skip} breaks the
//       refinement type system.
export type PaneHeader = {
    type: PaneHeaderType.None;
}|{
    type: PaneHeaderType.Skip;
}
|{
    type: PaneHeaderType.Header;
    header: ComponentInst<NgPaneHeaderComponent>;
}
|{
    type: PaneHeaderType.TabRow;
    header: ComponentInst<NgPaneTabRowComponent>;
}
|{
    type: PaneHeaderType.Tab;
    header: ComponentInst<NgPaneTabComponent>;
};

function headerTypeForMode(mode: PaneHeaderMode) {
    switch (mode) {
    case PaneHeaderMode.Hidden: return PaneHeaderType.None;
    case PaneHeaderMode.Visible: return PaneHeaderType.Header;
    case PaneHeaderMode.AlwaysTab: return PaneHeaderType.TabRow;
    }
}

export interface ComponentInst<C> {
    component: ComponentRef<C>;
    container: ViewContainerRef;
}

// TODO: try to recycle as many components as possible, rather than just leaves
// TODO: add close buttons to the headers and tabs
export class PaneFactory {
    private readonly headerFactory: ComponentFactory<NgPaneHeaderComponent>;
    private readonly leafFactory: ComponentFactory<NgPaneLeafComponent>;
    private readonly paneFactory: ComponentFactory<NgPaneComponent>;
    private readonly splitFactory: ComponentFactory<NgPaneSplitComponent>;
    private readonly splitThumbFactory: ComponentFactory<NgPaneSplitThumbComponent>;
    private readonly tabFactory: ComponentFactory<NgPaneTabComponent>;
    private readonly tabRowFactory: ComponentFactory<NgPaneTabRowComponent>;
    private readonly tabbedFactory: ComponentFactory<NgPaneTabbedComponent>;

    // TODO: clean out old data from these maps on layout changes
    private readonly templates: Map<string, LeafTemplateInfo>                = new Map();
    private readonly leaves: Map<string, ComponentInst<NgPaneLeafComponent>> = new Map();
    private readonly panes: Map<ChildLayout, ComponentRef<NgPaneComponent>>  = new Map();
    private dropTargets!: Map<ElementRef<Element>, DropTarget>;

    constructor(private readonly manager: NgPaneManagerComponent, cfr: ComponentFactoryResolver) {
        this.headerFactory     = cfr.resolveComponentFactory(NgPaneHeaderComponent);
        this.leafFactory       = cfr.resolveComponentFactory(NgPaneLeafComponent);
        this.paneFactory       = cfr.resolveComponentFactory(NgPaneComponent);
        this.splitFactory      = cfr.resolveComponentFactory(NgPaneSplitComponent);
        this.splitThumbFactory = cfr.resolveComponentFactory(NgPaneSplitThumbComponent);
        this.tabFactory        = cfr.resolveComponentFactory(NgPaneTabComponent);
        this.tabRowFactory     = cfr.resolveComponentFactory(NgPaneTabRowComponent);
        this.tabbedFactory     = cfr.resolveComponentFactory(NgPaneTabbedComponent);
    }

    private renderLeafTemplate(name: string): LeafNodeTemplate|undefined {
        const info = this.templates.get(name);

        if (info === undefined) return undefined;

        const {template, header} = info;

        return [template, {header}];
    }

    private headerStyleForLayout(layout: ChildLayout) {
        // TODO: correctly calculate branch header style
        switch (layout.type) {
        case LayoutType.Leaf:
            const template = this.templates.get(layout.template);

            if (template === undefined) {
                return {
                    headerMode: PaneHeaderMode.Visible,
                    title: new BehaviorSubject('???'),
                    icon: new BehaviorSubject(undefined),
                    closable: true,
                };
            }

            // TODO: allow header overriding for specific leaf nodes
            return template.header;
        case LayoutType.Horiz:
        case LayoutType.Vert:
            return {
                headerMode: PaneHeaderMode.Hidden,
                title: new BehaviorSubject('SPLIT'),
                icon: new BehaviorSubject(undefined),
                closable: false,
            };
        case LayoutType.Tabbed:
            return {
                headerMode: PaneHeaderMode.AlwaysTab,
                title: new BehaviorSubject('TABBED'),
                icon: new BehaviorSubject(undefined),
                closable: false,
            };
        }
    }

    private placeLeaf(container: ViewContainerRef,
                      withId: ChildWithId<LeafLayout>,
                      pane: NgPaneComponent) {
        const {child: layout, id} = withId;
        const leaf                = this.leaves.get(layout.id);

        let component: ComponentRef<NgPaneLeafComponent>|undefined;

        if (leaf !== undefined) {
            if (!leaf.component.hostView.destroyed) {
                const view = leaf.container.detach(leaf.container.indexOf(leaf.component.hostView));

                if (view !== null) {
                    container.insert(view);

                    component = leaf.component;
                }
                else {
                    console.warn(`failed to detach view for leaf '${layout.id}'`);
                }
            }
            else {
                console.warn(`leaf '${layout.id}' destroyed during layout change`);
            }
        }

        if (component === undefined) component = container.createComponent(this.leafFactory);

        this.leaves.set(layout.id, {component, container});

        const inst = component.instance;

        inst.pane     = pane;
        inst.layout   = layout;
        inst.template = this.renderLeafTemplate(layout.template);

        this.dropTargets.set(inst.el, {type: DropTargetType.Leaf, id});

        return component;
    }

    private placeSplitThumb(container: ViewContainerRef,
                            splitEl: ElementRef<HTMLElement>,
                            childId: ChildLayoutId&{stem: SplitLayout}) {
        const component = container.createComponent(this.splitThumbFactory);
        const inst      = component.instance;

        inst.splitEl = splitEl;
        inst.childId = childId;
        inst.vert    = childId.stem.type === LayoutType.Vert;

        return component;
    }

    private placeSplit(container: ViewContainerRef, withId: ChildWithId<SplitLayout>) {
        const {child: layout, id} = withId;
        const component           = container.createComponent(this.splitFactory);
        const inst                = component.instance;

        inst.vert = layout.type === LayoutType.Vert;

        for (let i = 0; i < layout.children.length; ++i) {
            if (i !== 0)
                this.placeSplitThumb(inst.renderer.viewContainer,
                                     inst.el,
                                     {stem: layout, index: i - 1});

            const pane = this.placePane(inst.renderer.viewContainer, layout.childId(i));

            pane.instance.ratio = layout.ratios[i];

            inst.children.push(pane.instance);
        }

        inst.resizeEvents = layout.resizeEvents;

        this.dropTargets.set(inst.el, {type: DropTargetType.Split, id});

        return component;
    }

    private placeTabbed(container: ViewContainerRef, withId: ChildWithId<TabbedLayout>) {
        const {child: layout, id} = withId;
        const component           = container.createComponent(this.tabbedFactory);
        const inst                = component.instance;

        for (let i = 0; i < layout.children.length; ++i) {
            const pane = this.placePane(inst.renderer.viewContainer, layout.childId(i), true);

            pane.instance.hidden = true;

            inst.children.push(pane.instance);
        }

        inst.$currentTab = layout.$currentTab;

        this.dropTargets.set(inst.el, {type: DropTargetType.Tabbed, id});

        return component;
    }

    private placeHeader(container: ViewContainerRef,
                        withId: ChildWithId,
                        style: PaneHeaderStyle&{headerMode: PaneHeaderMode.Visible}) {
        const component = container.createComponent(this.headerFactory, 0);
        const inst      = component.instance;

        inst.manager = this.manager;
        inst.childId = withId.id;
        inst.style   = style;

        this.dropTargets.set(inst.el, {type: DropTargetType.Header, id: withId.id});

        return {component, container};
    }

    // NOTE: does not set inst.style, which is assumed to be defined. inst.style
    //       must be set by the caller.
    private placeTab(container: ViewContainerRef, withId: ChildWithId) {
        const component = container.createComponent(this.tabFactory);
        const inst      = component.instance;

        inst.manager = this.manager;
        inst.childId = withId.id;

        this.dropTargets.set(inst.el, {type: DropTargetType.Tab, id: withId.id});

        return {component, container};
    }

    private placeTabRow(container: ViewContainerRef,
                        withId: ChildWithId,
                        style: PaneHeaderStyle&{headerMode: PaneHeaderMode.AlwaysTab}) {
        const component = container.createComponent(this.tabRowFactory, 0);
        const inst      = component.instance;

        inst.manager = this.manager;
        inst.childId = withId.id;

        const layout = withId.child;

        if (layout.type === LayoutType.Tabbed) {
            layout.children.forEach((subchild, childIndex) => {
                const tab  = this.placeTab(inst.renderer.viewContainer,
                                          {child: subchild, id: layout.childId(childIndex)});
                const pane = this.panes.get(subchild);

                if (pane === undefined) throw new Error('no pane found to match tab');

                pane.instance.header = {type: PaneHeaderType.Tab, header: tab};

                this.updatePaneHeader(pane.instance);

                inst.tabs.push(tab.component.instance);
            });

            inst.style       = style;
            inst.$currentTab = layout.$currentTab;
        }
        else {
            const tab = this.placeTab(component.instance.renderer.viewContainer, withId);
            inst.tab  = tab.component.instance as NgPaneTabComponent &
                       {style: {headerMode: PaneHeaderMode.AlwaysTab}};
            inst.style = style;

            tab.component.instance.active = true;
        }

        this.dropTargets.set(inst.el, {type: DropTargetType.TabRow, id: withId.id});

        return {component, container};
    }

    private updatePaneHeader(pane: NgPaneComponent) {
        if (pane.header.type === PaneHeaderType.Skip) return;

        const withId = ChildWithId.fromId(pane.childId);
        const style  = this.headerStyleForLayout(withId.child);

        const newType = pane.header.type === PaneHeaderType.Tab
                            ? PaneHeaderType.Tab
                            : headerTypeForMode(style.headerMode);

        if (pane.header.type !== newType) {
            if (pane.header.type !== PaneHeaderType.None) {
                const {component, container} = pane.header.header;

                container.remove(container.indexOf(component.hostView));
            }

            switch (newType) {
            case PaneHeaderType.None: pane.header = {type: PaneHeaderType.None}; break;
            case PaneHeaderType.Header:
                pane.header = {
                    type: PaneHeaderType.Header,
                    header: this.placeHeader(pane.renderer.viewContainer,
                                             withId,
                                             style as PaneHeaderStyle &
                                                 {headerMode: PaneHeaderMode.Visible}),
                };
                break;
            case PaneHeaderType.TabRow:
                pane.header = {
                    type: PaneHeaderType.TabRow,
                    header: this.placeTabRow(pane.renderer.viewContainer,
                                             withId,
                                             style as PaneHeaderStyle &
                                                 {headerMode: PaneHeaderMode.AlwaysTab}),
                };
                break;
            case PaneHeaderType.Tab: throw new Error('unreachable');
            }
        }
        else if (pane.header.type !== PaneHeaderType.None)
            pane.header.header.component.instance.style = style;
    }

    private updateLeavesWithTemplate(name: string) {
        for (const leaf of this.leaves.values()) {
            const inst = leaf.component.instance;

            if (inst.layout.template === name) {
                inst.template = this.renderLeafTemplate(name);
                this.updatePaneHeader(inst.pane);
            }
        }
    }

    registerLeafTemplate(name: string,
                         header: PaneHeaderStyle,
                         template: TemplateRef<LeafNodeContext>,
                         force?: boolean) {
        if (this.templates.has(name) && force !== true)
            throw new Error(`pane template '${name}' already registered`);

        this.templates.set(name, {template, header});

        this.updateLeavesWithTemplate(name);
    }

    unregisterLeafTemplate(name: string) {
        if (this.templates.delete(name)) this.updateLeavesWithTemplate(name);
    }

    notifyLayoutChangeStart(dropTargets: Map<ElementRef<HTMLElement>, DropTarget>) {
        this.dropTargets = dropTargets;

        this.panes.clear();
    }

    notifyLayoutChangeEnd() {
        {
            const remove = [];

            // TODO: pretty sure this isn't actually doing anything.
            for (const [key, val] of this.leaves.entries()) {
                if (val.component.hostView.destroyed) {
                    val.component.destroy();
                    remove.push(key);
                }
            }

            remove.forEach(k => this.leaves.delete(k));
        }
    }

    placePane(container: ViewContainerRef, childId: ChildLayoutId, skipHeader?: boolean):
        ComponentRef<NgPaneComponent> {
        const component = container.createComponent(this.paneFactory);


        const inst  = component.instance;
        const child = childFromId(childId);

        this.panes.set(child, component);

        inst.childId = childId;

        if (skipHeader === true) inst.header = {type: PaneHeaderType.Skip};

        switch (child.type) {
        case LayoutType.Leaf:
            inst.content = this.placeLeaf(inst.renderer.viewContainer, {child, id: childId}, inst);
            break;
        case LayoutType.Horiz:
        case LayoutType.Vert:
            inst.content = this.placeSplit(inst.renderer.viewContainer, {child, id: childId});
            break;
        case LayoutType.Tabbed:
            inst.content = this.placeTabbed(inst.renderer.viewContainer, {child, id: childId});
            break;
        }

        this.updatePaneHeader(inst);

        return component;
    }
}
