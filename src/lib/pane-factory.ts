import {
    ComponentFactory,
    ComponentFactoryResolver,
    ComponentRef,
    ViewContainerRef,
} from '@angular/core';

import {NgPaneHeaderComponent} from './ng-pane-header/ng-pane-header.component';
import {NgPaneLeafComponent} from './ng-pane-leaf/ng-pane-leaf.component';
import {NgPaneSplitComponent} from './ng-pane-split/ng-pane-split.component';
import {NgPaneTabRowComponent} from './ng-pane-tab-row/ng-pane-tab-row.component';
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

interface ComponentInst<C> {
    component: ComponentRef<C>;
    container: ViewContainerRef;
    index: number;
}

export class PaneFactory {
    private readonly headerFactory: ComponentFactory<any>;
    private readonly leafFactory: ComponentFactory<any>;
    private readonly paneFactory: ComponentFactory<any>;
    private readonly splitFactory: ComponentFactory<any>;
    private readonly tabRowFactory: ComponentFactory<any>;

    private readonly leaves: Map<string, ComponentInst<NgPaneLeafComponent>> = new Map();

    constructor(cfr: ComponentFactoryResolver) {
        this.headerFactory = cfr.resolveComponentFactory(NgPaneHeaderComponent);
        this.leafFactory   = cfr.resolveComponentFactory(NgPaneLeafComponent);
        this.paneFactory   = cfr.resolveComponentFactory(NgPaneComponent);
        this.splitFactory  = cfr.resolveComponentFactory(NgPaneSplitComponent);
        this.tabRowFactory = cfr.resolveComponentFactory(NgPaneTabRowComponent);
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
    }

    private placePaneContent(container: ViewContainerRef, layout: ChildLayout) {
        switch (layout.type) {
        case LayoutType.Leaf: return this.placeLeaf(container, layout);
        case LayoutType.Horiz:
        case LayoutType.Vert: return this.placeSplit(container, layout);
        case LayoutType.Tabbed: return this.placeTabs(container, layout);
        }
    }

    private placeTitle(container: ViewContainerRef, child: ChildWithId): never {
        throw new Error('Not yet implemented');
    }

    private placeTabRow(container: ViewContainerRef,
                        child: ChildWithId): ComponentRef<NgPaneTabRowComponent> {
        const component = container.createComponent(this.tabRowFactory);

        return component;
    }

    private placeHeader(container: ViewContainerRef, child: ChildWithId) {
        const component = container.createComponent(this.headerFactory);

        return component;
    }

    placePane(container: ViewContainerRef, childId: ChildLayoutId): ComponentRef<NgPaneComponent> {
        const component:
            ComponentRef<NgPaneComponent> = container.createComponent(this.paneFactory);

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
