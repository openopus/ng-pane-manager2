import {
    ComponentFactory,
    ComponentFactoryResolver,
    ComponentRef,
    TemplateRef,
    ViewContainerRef,
} from '@angular/core';
import {BehaviorSubject} from 'rxjs';

import {NgPaneHeaderComponent} from './ng-pane-header/ng-pane-header.component';
import {NgPaneLeafComponent} from './ng-pane-leaf/ng-pane-leaf.component';
import {NgPaneSplitComponent} from './ng-pane-split/ng-pane-split.component';
import {NgPaneTabRowComponent} from './ng-pane-tab-row/ng-pane-tab-row.component';
import {NgPaneTabComponent} from './ng-pane-tab/ng-pane-tab.component';
import {NgPaneTitleComponent} from './ng-pane-title/ng-pane-title.component';
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
import {LeafNodeContext, PaneHeaderMode, PaneHeaderStyle} from './pane-template';

interface LeafTemplateInfo {
    template: TemplateRef<LeafNodeContext>;
    header: PaneHeaderStyle;
}

interface ComponentInst<C> {
    component: ComponentRef<C>;
    container: ViewContainerRef;
    index: number;
}

export class PaneFactory {
    private readonly headerFactory: ComponentFactory<NgPaneHeaderComponent>;
    private readonly leafFactory: ComponentFactory<NgPaneLeafComponent>;
    private readonly paneFactory: ComponentFactory<NgPaneComponent>;
    private readonly splitFactory: ComponentFactory<NgPaneSplitComponent>;
    private readonly tabFactory: ComponentFactory<NgPaneTabComponent>;
    private readonly tabRowFactory: ComponentFactory<NgPaneTabRowComponent>;
    private readonly titleFactory: ComponentFactory<NgPaneTitleComponent>;

    private readonly templates: Map<string, LeafTemplateInfo>                       = new Map();
    private readonly leaves: Map<string, ComponentInst<NgPaneLeafComponent>>        = new Map();
    private readonly headers: Map<ChildLayout, ComponentRef<NgPaneHeaderComponent>> = new Map();

    constructor(cfr: ComponentFactoryResolver) {
        this.headerFactory = cfr.resolveComponentFactory(NgPaneHeaderComponent);
        this.leafFactory   = cfr.resolveComponentFactory(NgPaneLeafComponent);
        this.paneFactory   = cfr.resolveComponentFactory(NgPaneComponent);
        this.splitFactory  = cfr.resolveComponentFactory(NgPaneSplitComponent);
        this.tabFactory    = cfr.resolveComponentFactory(NgPaneTabComponent);
        this.tabRowFactory = cfr.resolveComponentFactory(NgPaneTabRowComponent);
        this.titleFactory  = cfr.resolveComponentFactory(NgPaneTitleComponent);
    }

    private headerStyleForLayout(layout: ChildLayout) {
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

            // TODO: allow header overriding for specific leaf nodes
            return template.header;
        }

        // TODO: correctly calculate branch header style
        return {
            headerMode: PaneHeaderMode.Visible,
            title: new BehaviorSubject('BRANCH'),
            icon: new BehaviorSubject(undefined),
            closable: false,
        };
    }

    private placeLeaf(container: ViewContainerRef, layout: LeafLayout) {
        const leaf = this.leaves.get(layout.id);

        let component: ComponentRef<NgPaneLeafComponent>;

        if (leaf !== undefined) {
            const view     = leaf.container.detach(leaf.index);
            const newIndex = container.length;

            if (view !== null) container.insert(view);

            leaf.container = container;
            leaf.index     = newIndex;

            // TODO: if view === null, then is inst.component valid?
            component = leaf.component;
        }
        else {
            const index = container.length;

            component = container.createComponent(this.leafFactory);

            this.leaves.set(layout.id, {component, container, index});
        }

        return component;
    }

    private placeSplit(container: ViewContainerRef, layout: SplitLayout) {
        const component = container.createComponent(this.splitFactory);

        return component;
    }

    private placeTabs(container: ViewContainerRef, layout: TabbedLayout): never {
        throw new Error('Not yet implemented');

        // const component = container.createComponent(this.tabbedFactory);

        // return component;
    }

    private placePaneContent(container: ViewContainerRef, layout: ChildLayout) {
        switch (layout.type) {
        case LayoutType.Leaf: return this.placeLeaf(container, layout);
        case LayoutType.Horiz:
        case LayoutType.Vert: return this.placeSplit(container, layout);
        case LayoutType.Tabbed: return this.placeTabs(container, layout);
        }
    }

    private placeHeader(container: ViewContainerRef, child: ChildWithId) {
        const component = container.createComponent(this.headerFactory);
        const inst      = component.instance;

        inst.factory = this;
        inst.childId = child.id;
        inst.style   = this.headerStyleForLayout(child.child);

        this.headers.set(child.child, component);

        return component;
    }

    private updatePaneHeader(header: NgPaneHeaderComponent) {
        header.style = this.headerStyleForLayout(childFromId(header.childId));
    }

    private updateLeavesWithTemplate(name: string) {
        const template = this.templates.get(name);

        for (const leaf of this.leaves.values()) {
            const inst = leaf.component.instance;

            // TODO
            if (inst.layout.template === name) {
                inst.template = template !== undefined
                                    ? [template.template, {header: template.header}]
                                    : undefined;

                const header = this.headers.get(inst.layout);

                if (header !== undefined) this.updatePaneHeader(header.instance);
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

    placeTitle(container: ViewContainerRef, child: ChildWithId) {
        const component = container.createComponent(this.titleFactory);

        return component;
    }

    placeTabRow(container: ViewContainerRef,
                child: ChildWithId): ComponentRef<NgPaneTabRowComponent> {
        const component = container.createComponent(this.tabRowFactory);

        return component;
    }

    placePane(container: ViewContainerRef, childId: ChildLayoutId): ComponentRef<NgPaneComponent> {
        const component = container.createComponent(this.paneFactory);

        const inst   = component.instance;
        const child  = childFromId(childId);
        const withId = {child, id: childId};

        inst.header = child.type === LayoutType.Tabbed
                          ? this.placeTabRow(inst.renderer.viewContainer, withId)
                          : this.placeHeader(inst.renderer.viewContainer, withId);

        inst.content = this.placePaneContent(inst.renderer.viewContainer, child);

        return component;
    }
}
