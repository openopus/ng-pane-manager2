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
    ViewRef,
} from '@angular/core';
import {BehaviorSubject} from 'rxjs';

import {DropTarget, DropTargetType} from './drag-and-drop';
import {
    NgPaneDropHighlightComponent,
} from './ng-pane-drop-highlight/ng-pane-drop-highlight.component';
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

/**
 * A leaf template and any extra information associated with it.
 */
interface LeafTemplateInfo<X> {
    /** The content of the leaf template */
    template: TemplateRef<LeafNodeContext<X>>;
    /** The default header information for the leaf template */
    header: PaneHeaderStyle;
}

/**
 * Used to identify different values of `NgPaneComponent.header`
 */
export const enum PaneHeaderType {
    /** No header is currently rendered */
    None,
    /** No header is currently rendered, nor should ever be rendered */
    Skip,
    /** A simple header is currently rendered */
    Header,
    /** A (real or mock) tab row is currently rendered */
    TabRow,
    /**
     * A tab from another tab row is associated with this pane\
     * **NOTE:** This indicates no additional header should be rendered.
     */
    Tab,
}

// NOTE: using {type: PaneHeaderType.None|PaneHeaderType.Skip} breaks the
//       refinement type system.
/**
 * The header attached to a pane component.
 * See `PaneHeaderType` for additional information.
 */
export type PaneHeader<X> = {
    /** The pane is headerless */
    type: PaneHeaderType.None;
}|{
    /** The pane should not attempt to render a header */
    type: PaneHeaderType.Skip;
}
|{
    /** The pane has a simple header */
    type: PaneHeaderType.Header;
    /** The header of the pane */
    header: ComponentInst<NgPaneHeaderComponent<X>>;
}
|{
    /** The pane has a (real or mock) tab row header */
    type: PaneHeaderType.TabRow;
    /** The tab row of the pane */
    header: ComponentInst<NgPaneTabRowComponent<X>>;
}
|{
    /** The pane is associated with a tab from another pane */
    type: PaneHeaderType.Tab;
    /** The tab associated with this pane */
    header: ComponentInst<NgPaneTabComponent<X>>;
};

/**
 * Converts `PaneHeaderMode` values to a corresponding `PaneHeaderType`.
 * @param mode a pane header mode
 */
function headerTypeForMode(mode: PaneHeaderMode): PaneHeaderType {
    switch (mode) {
    case PaneHeaderMode.Hidden: return PaneHeaderType.None;
    case PaneHeaderMode.Visible: return PaneHeaderType.Header;
    case PaneHeaderMode.AlwaysTab: return PaneHeaderType.TabRow;
    }
}

/**
 * A component and the container it resides in.
 */
export interface ComponentInst<C> {
    /** The component */
    component: ComponentRef<C>;
    /** The container holding it */
    container: ViewContainerRef;
    /**
     * The host view of the component.\
     * This is provided here because for some reason ComponentRef.hostView does
     * not always work with ViewContainerRef.indexOf.
     */
    hostView: ViewRef;
}

// TODO: try to recycle as many components as possible, rather than just leaves
/**
 * Business logic for constructing and tracking components used to render the
 * layout of a pane manager.
 */
export class PaneFactory<X> {
    /** Factory for pane drop highlights */
    private readonly dropHighlightFactory: ComponentFactory<NgPaneDropHighlightComponent>;
    /** Factory for pane headers */
    private readonly headerFactory: ComponentFactory<NgPaneHeaderComponent<X>>;
    /** Factory for leaf panes */
    private readonly leafFactory: ComponentFactory<NgPaneLeafComponent<X>>;
    /** Factory for pane containers */
    private readonly paneFactory: ComponentFactory<NgPaneComponent<X>>;
    /** Factory for split branch panes */
    private readonly splitFactory: ComponentFactory<NgPaneSplitComponent<X>>;
    /** Factory for split branch thumbs */
    private readonly splitThumbFactory: ComponentFactory<NgPaneSplitThumbComponent<X>>;
    /** Factory for pane tabs */
    private readonly tabFactory: ComponentFactory<NgPaneTabComponent<X>>;
    /** Factory for pane tab rows */
    private readonly tabRowFactory: ComponentFactory<NgPaneTabRowComponent<X>>;
    /** Factory for tabbed branch panes */
    private readonly tabbedFactory: ComponentFactory<NgPaneTabbedComponent<X>>;

    // TODO: move the template dictionary into a global service
    /** Registered leaf templates, stored by name */
    private readonly templates: Map<string, LeafTemplateInfo<X>> = new Map();

    // TODO: stress test layout changes to make sure all old data is cleaned out
    /** All currently rendered leaves, stored by leaf pane id (_not_ template) */
    private readonly leaves: Map<string, ComponentInst<NgPaneLeafComponent<X>>> = new Map();
    /**
     * All currently rendered panes, stored by their associated layout node.
     * **NOTE:** Object map keys are _only_ comparable by reference!
     */
    private readonly panes: Map<ChildLayout<X>, ComponentRef<NgPaneComponent<X>>> = new Map();
    /** All hit testing information for the currently rendered components */
    private dropTargets!: Map<ElementRef<Element>, DropTarget<X>>;

    /**
     * Construct a new pane factory.
     * @param manager the pane manager this renderer was created for
     * @param cfr needed to resolve inner component factories
     */
    public constructor(private readonly manager: NgPaneManagerComponent<X>,
                       cfr: ComponentFactoryResolver) {
        this.dropHighlightFactory = cfr.resolveComponentFactory(NgPaneDropHighlightComponent);
        this.headerFactory        = cfr.resolveComponentFactory(NgPaneHeaderComponent) as
                             ComponentFactory<NgPaneHeaderComponent<X>>;
        this.leafFactory = cfr.resolveComponentFactory(NgPaneLeafComponent) as
                           ComponentFactory<NgPaneLeafComponent<X>>;
        this.paneFactory = cfr.resolveComponentFactory(NgPaneComponent) as
                           ComponentFactory<NgPaneComponent<X>>;
        this.splitFactory = cfr.resolveComponentFactory(NgPaneSplitComponent) as
                            ComponentFactory<NgPaneSplitComponent<X>>;
        this.splitThumbFactory = cfr.resolveComponentFactory(NgPaneSplitThumbComponent) as
                                 ComponentFactory<NgPaneSplitThumbComponent<X>>;
        this.tabFactory = cfr.resolveComponentFactory(NgPaneTabComponent) as
                          ComponentFactory<NgPaneTabComponent<X>>;
        this.tabRowFactory = cfr.resolveComponentFactory(NgPaneTabRowComponent) as
                             ComponentFactory<NgPaneTabRowComponent<X>>;
        this.tabbedFactory = cfr.resolveComponentFactory(NgPaneTabbedComponent) as
                             ComponentFactory<NgPaneTabbedComponent<X>>;
    }

    // TODO: allow passing in extra data from layout nodes
    /**
     * Collect all the necessary information to render the contents of a leaf
     * pane.
     * @param layout the name of the template to produce
     */
    private renderLeafTemplate(layout: LeafLayout<X>): LeafNodeTemplate<X>|undefined {
        const info = this.templates.get(layout.template);

        if (info === undefined) { return undefined; }

        const {template, header} = info;

        return [template, {header, extra: layout.extra}];
    }

    /**
     * Compute header information for a given layout.
     * @param layout the layout the header is intended for
     */
    private headerStyleForLayout(layout: ChildLayout<X>): PaneHeaderStyle {
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

    /**
     * Attempt to fetch an existing rendered leaf node from the component tree.
     * @param id the ID of the leaf node
     */
    private tryDetachLeaf(id: string): [ViewRef, ComponentInst<NgPaneLeafComponent<X>>]|undefined {
        const leaf = this.leaves.get(id);

        if (leaf === undefined) { return undefined; }

        if (leaf.hostView.destroyed) {
            console.warn(`leaf ${id} destroyed during layout change`);

            return undefined;
        }

        const index = leaf.container.indexOf(leaf.hostView);

        if (index < 0) { throw new Error(`leaf '${id}' not found in container`); }

        const view = leaf.container.detach(index);

        if (view === null) {
            console.warn(`failed to detach view for leaf '${id}'`);

            return undefined;
        }

        return [view, leaf];
    }

    /**
     * Render a leaf pane.
     * @param container the container to render the leaf in
     * @param withId the layout node corresponding to the leaf
     * @param pane the pane container containing the leaf
     */
    private placeLeaf(container: ViewContainerRef,
                      withId: ChildWithId<X, LeafLayout<X>>,
                      pane: NgPaneComponent<X>): ComponentRef<NgPaneLeafComponent<X>> {
        const {child: layout, id} = withId;
        let component: ComponentRef<NgPaneLeafComponent<X>>|undefined;
        let hostView: ViewRef|undefined;

        const detached = this.tryDetachLeaf(layout.id);

        if (detached !== undefined) {
            const [view, leaf] = detached;

            container.insert(view);
            component = leaf.component;
            hostView  = view;
        }

        if (component === undefined) {
            component = container.createComponent(this.leafFactory);
            hostView  = component.hostView;
        }

        if (hostView === undefined) {
            throw new Error('host view is undefined - this should never happen');
        }

        this.leaves.set(layout.id, {component, container, hostView});

        const inst = component.instance;

        inst.pane     = pane;
        inst.layout   = layout;
        inst.template = this.renderLeafTemplate(layout);

        this.dropTargets.set(inst.el, {type: DropTargetType.Pane, id});

        return component;
    }

    /**
     * Render a split branch thumb.
     * @param container the container to render the thumb in
     * @param splitEl the element associated with the parent split branch node
     * @param childId the layout node ID corresponding to the neighboring child
     */
    private placeSplitThumb(container: ViewContainerRef,
                            splitEl: ElementRef<HTMLElement>,
                            childId: ChildLayoutId<X, SplitLayout<X>>):
        ComponentRef<NgPaneSplitThumbComponent<X>> {
        const component = container.createComponent(this.splitThumbFactory);
        const inst      = component.instance;

        inst.splitEl = splitEl;
        inst.childId = childId;
        inst.vert    = childId.stem.type === LayoutType.Vert;

        return component;
    }

    /**
     * Render a split branch pane.
     * @param container the container to render the split branch in
     * @param withId the layout node corresponding to the split branch
     */
    private placeSplit(container: ViewContainerRef, withId: ChildWithId<X, SplitLayout<X>>):
        ComponentRef<NgPaneSplitComponent<X>> {
        const {child: layout, id} = withId;
        const component           = container.createComponent(this.splitFactory);
        const inst                = component.instance;

        inst.vert = layout.type === LayoutType.Vert;

        for (let i = 0; i < layout.children.length; i += 1) {
            if (i !== 0) {
                this.placeSplitThumb(inst.renderer.viewContainer,
                                     inst.el,
                                     {stem: layout, index: i - 1});
            }

            const pane = this.placePane(inst.renderer.viewContainer, layout.childId(i));

            pane.instance.ratio = layout.ratios[i];

            inst.children.push(pane.instance);
        }

        inst.resizeEvents = layout.resizeEvents;

        this.dropTargets.set(inst.el, {type: DropTargetType.Pane, id});

        return component;
    }

    /**
     * Render a tabbed branch pane.
     * @param container the container to render the tabbed branch in
     * @param withId the layout node associated with the tabbed branch
     */
    private placeTabbed(container: ViewContainerRef, withId: ChildWithId<X, TabbedLayout<X>>):
        ComponentRef<NgPaneTabbedComponent<X>> {
        const {child: layout, id} = withId;
        const component           = container.createComponent(this.tabbedFactory);
        const inst                = component.instance;

        for (let i = 0; i < layout.children.length; i += 1) {
            const pane = this.placePane(inst.renderer.viewContainer, layout.childId(i), true);

            pane.instance.hidden = true;

            inst.children.push(pane.instance);
        }

        inst.$currentTab = layout.$currentTab;

        this.dropTargets.set(inst.el, {type: DropTargetType.Pane, id});

        return component;
    }

    /**
     * Render a pane header.
     * @param container the container to render the header in
     * @param withId the layout node corresponding to the header
     * @param style the style information for the header
     */
    private placeHeader(
        container: ViewContainerRef,
        withId: ChildWithId<X>,
        style: PaneHeaderStyle<PaneHeaderMode.Visible>,
        ): ComponentInst<NgPaneHeaderComponent<X>> {
        const component = container.createComponent(this.headerFactory, 0);
        const inst      = component.instance;

        inst.manager = this.manager;
        inst.childId = withId.id;
        inst.style   = style;

        this.dropTargets.set(inst.el, {type: DropTargetType.Header, id: withId.id});

        return {component, container, hostView: component.hostView};
    }

    /**
     * Render a pane tab.
     *
     * **NOTE:** this does _not_ set `NgPaneTabComponent.style`, which is marked
     *           with a non-null assertion on its declaration. `.style` _must_
     *           be set by the caller.
     * @param container the container to render the tab in
     * @param withId the layout node corresponding to the tab
     */
    private placeTab(container: ViewContainerRef,
                     withId: ChildWithId<X>): ComponentInst<NgPaneTabComponent<X>> {
        const component = container.createComponent(this.tabFactory);
        const inst      = component.instance;

        inst.manager = this.manager;
        inst.childId = withId.id;

        this.dropTargets.set(inst.el, {type: DropTargetType.Tab, id: withId.id});

        return {component, container, hostView: component.hostView};
    }

    /**
     * Render a pane tab row.\
     * This will automatically render the necessary tabs.
     * @param container the container to render the tab row in
     * @param withId the layout node corresponding to the tab row
     * @param style the header style information for the tab row
     */
    private placeTabRow(
        container: ViewContainerRef,
        withId: ChildWithId<X>,
        style: PaneHeaderStyle<PaneHeaderMode.AlwaysTab>,
        ): ComponentInst<NgPaneTabRowComponent<X>> {
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

                if (pane === undefined) { throw new Error('no pane found to match tab'); }

                pane.instance.header = {type: PaneHeaderType.Tab, header: tab};

                this.updatePaneHeader(pane.instance);

                inst.tabs.push(tab.component.instance);
            });

            inst.style       = style;
            inst.$currentTab = layout.$currentTab;
        }
        else {
            const tab  = this.placeTab(component.instance.renderer.viewContainer, withId);
            inst.tab   = tab.component.instance as NgPaneTabComponent<X, PaneHeaderMode.AlwaysTab>;
            inst.style = style;

            tab.component.instance.active = true;
        }

        this.dropTargets.set(inst.el, {type: DropTargetType.TabRow, id: withId.id});

        return {component, container, hostView: component.hostView};
    }

    /**
     * Update the header of a pane, re-rendering it if necessary.
     * @param pane the pane to update the header for
     */
    private updatePaneHeader(pane: NgPaneComponent<X>): void {
        if (pane.header.type === PaneHeaderType.Skip) { return; }

        const withId = ChildWithId.fromId(pane.childId);
        const style  = this.headerStyleForLayout(withId.child);

        const newType = pane.header.type === PaneHeaderType.Tab
                            ? PaneHeaderType.Tab
                            : headerTypeForMode(style.headerMode);

        if (pane.header.type !== newType) {
            if (pane.header.type !== PaneHeaderType.None) {
                const {container, hostView} = pane.header.header;

                container.remove(container.indexOf(hostView));
            }

            switch (newType) {
            case PaneHeaderType.None: pane.header = {type: PaneHeaderType.None}; break;
            case PaneHeaderType.Header:
                pane.header = {
                    type: PaneHeaderType.Header,
                    header: this.placeHeader(pane.renderer.viewContainer,
                                             withId,
                                             style as PaneHeaderStyle<PaneHeaderMode.Visible>),
                };
                break;
            case PaneHeaderType.TabRow:
                pane.header = {
                    type: PaneHeaderType.TabRow,
                    header: this.placeTabRow(pane.renderer.viewContainer,
                                             withId,
                                             style as PaneHeaderStyle<PaneHeaderMode.AlwaysTab>),
                };
                break;
            case PaneHeaderType.Tab: throw new Error('unreachable');
            }
        }
        else if (pane.header.type !== PaneHeaderType.None) {
            pane.header.header.component.instance.style = style;
        }
    }

    /**
     * Update all leaf panes using a given template, re-rendering their contents
     * and refreshing their style information.
     * @param name the name of the leaf template
     */
    private updateLeavesWithTemplate(name: string): void {
        for (const leaf of this.leaves.values()) {
            const inst = leaf.component.instance;

            if (inst.layout.template === name) {
                inst.template = this.renderLeafTemplate(inst.layout);
                this.updatePaneHeader(inst.pane);
            }
        }
    }

    /**
     * Get the client rectangles for a pane.
     * @param layout the layout corresponding to the pane
     */
    public getPaneRects(layout: ChildLayout<X>): DOMRectList|undefined {
        const pane = this.panes.get(layout);

        if (pane === undefined) { return undefined; }

        return (pane.location.nativeElement as Element).getClientRects();
    }

    /**
     * Registers a leaf template with the given name and information.
     * @param name the name of the template
     * @param header the header style information for the template
     * @param template the content to render for the template
     * @param force set to true to override an existing template with this name
     */
    public registerLeafTemplate(name: string,
                                header: PaneHeaderStyle,
                                template: TemplateRef<LeafNodeContext<X>>,
                                force?: boolean): void {
        if (this.templates.has(name) && force !== true) {
            throw new Error(`pane template '${name}' already registered`);
        }

        this.templates.set(name, {template, header});

        this.updateLeavesWithTemplate(name);
    }

    /**
     * Removes the leaf template with the given name
     * @param name the name of the template to remove
     */
    public unregisterLeafTemplate(name: string): void {
        if (this.templates.delete(name)) { this.updateLeavesWithTemplate(name); }
    }

    /**
     * Initialize the pane factory for rendering a layout.
     * @param dropTargets empty map of drag-and-drop hit targets to populate
     */
    public notifyLayoutChangeStart(dropTargets: Map<ElementRef<HTMLElement>, DropTarget<X>>): void {
        this.dropTargets = dropTargets;

        this.panes.clear();
    }

    /**
     * Finalize layout rendering, cleaning up any extra resources.
     */
    public notifyLayoutChangeEnd(): void {
        {
            const remove = [];

            for (const [key, val] of this.leaves.entries()) {
                if (val.hostView.destroyed) {
                    val.component.destroy();
                    remove.push(key);
                }
            }

            remove.forEach(k => this.leaves.delete(k));
        }
    }

    /**
     * Render a pane container.
     * @param container the container to render the pane in
     * @param childId the layout node ID corresponding to the pane
     * @param skipHeader disable rendering the header of this pane
     */
    public placePane(container: ViewContainerRef, childId: ChildLayoutId<X>, skipHeader?: boolean):
        ComponentRef<NgPaneComponent<X>> {
        const component = container.createComponent(this.paneFactory);


        const inst  = component.instance;
        const child = childFromId(childId);

        this.panes.set(child, component);

        inst.childId = childId;

        if (skipHeader === true) { inst.header = {type: PaneHeaderType.Skip}; }

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

    /**
     * Render a drop highlight visual.
     * @param container the container to render the drop highlight in
     */
    public placeDropHighlight(container: ViewContainerRef):
        ComponentRef<NgPaneDropHighlightComponent> {
        const component = container.createComponent(this.dropHighlightFactory);

        return component;
    }
}
