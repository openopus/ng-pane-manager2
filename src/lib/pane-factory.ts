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
    ViewContainerRef,
    ViewRef,
} from '@angular/core';
import {BehaviorSubject, merge, Observable, of, Subject, Subscription} from 'rxjs';
import {filter, map, switchAll, switchMap} from 'rxjs/operators';

import {DropTarget, DropTargetType} from './drag-and-drop';
import {
    NgPaneDropHighlightComponent,
} from './ng-pane-drop-highlight/ng-pane-drop-highlight.component';
import {NgPaneGroupComponent} from './ng-pane-group/ng-pane-group.component';
import {NgPaneHeaderComponent} from './ng-pane-header/ng-pane-header.component';
import {NgPaneLeafTemplateService} from './ng-pane-leaf-templates.service';
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
    childIdValid,
    ChildLayout,
    ChildLayoutId,
    ChildWithId,
    GroupLayout,
    LayoutType,
    LeafLayout,
    SplitLayout,
    TabbedLayout,
} from './pane-layout/module';
import {LeafNodeTemplate, PaneHeaderMode, PaneHeaderStyle} from './pane-template';

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
    /** Factory for group panes */
    private readonly groupFactory: ComponentFactory<NgPaneGroupComponent<X>>;
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

    // TODO: stress test layout changes to make sure all old data is cleaned out
    /** All currently rendered leaves, stored by leaf pane ID (_not_ template) */
    private readonly leaves: Map<string, ComponentInst<NgPaneLeafComponent<X>>> = new Map();
    /**
     * All currently rendered panes, stored by their associated layout node.
     * **NOTE:** Object map keys are _only_ comparable by reference!
     */
    private readonly panes: Map<ChildLayout<X>, ComponentRef<NgPaneComponent<X>>> = new Map();
    /**
     * The headers of all currently rendered leaf nodes, stored by leaf pane ID.
     *
     * A value of `undefined` indicates to use the default template header.
     */
    private readonly leafHeaders:
        Map<string, BehaviorSubject<PaneHeaderStyle|undefined>> = new Map();
    /**
     * The resize event streams of all currently rendered leaf nodes, stored by
     * leaf pane ID.
     *
     * Intended for use with `getLeafResizeStream`, which pipes the stream
     * through `switchAll`.
     */
    private readonly leafResizeStreams:
        Map<string, BehaviorSubject<Observable<undefined>>> = new Map();
    /** All RxJS subscriptions associated with the current layout */
    private readonly layoutSubscriptions: Subscription[] = [];
    /** All hit testing information for the currently rendered components */
    private dropTargets!: Map<ElementRef<HTMLElement>, DropTarget<X>>;
    /** Single event stream for minor layout update events on all rendered panes */
    private layoutUpdate: Subject<undefined> = new Subject();

    /**
     * Construct a new pane factory.
     * @param manager the pane manager this renderer was created for
     * @param cfr needed to resolve inner component factories
     */
    public constructor(private readonly manager: NgPaneManagerComponent<X>,
                       private readonly templateService: NgPaneLeafTemplateService<X>,
                       cfr: ComponentFactoryResolver) {
        this.dropHighlightFactory = cfr.resolveComponentFactory(NgPaneDropHighlightComponent);
        this.headerFactory        = cfr.resolveComponentFactory(NgPaneHeaderComponent) as
                             ComponentFactory<NgPaneHeaderComponent<X>>;
        this.leafFactory = cfr.resolveComponentFactory(NgPaneLeafComponent) as
                           ComponentFactory<NgPaneLeafComponent<X>>;
        this.paneFactory = cfr.resolveComponentFactory(NgPaneComponent) as
                           ComponentFactory<NgPaneComponent<X>>;
        this.groupFactory = cfr.resolveComponentFactory(NgPaneGroupComponent) as
                            ComponentFactory<NgPaneGroupComponent<X>>;
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

    /**
     * Returns an observable reference to the header of a leaf node, or creates
     * a placeholder one if no header is currently registered.
     *
     * See `leafHeaders` for a description of the returned value.
     * @param id the ID of the leaf node (_not_ template) to retrieve the header
     *           for
     */
    private initLeafHeader(id: string): BehaviorSubject<PaneHeaderStyle|undefined> {
        let entry = this.leafHeaders.get(id);

        if (entry === undefined) {
            entry = new BehaviorSubject<PaneHeaderStyle|undefined>(undefined);
            this.leafHeaders.set(id, entry);
        }

        return entry;
    }

    /**
     * Returns an observable reference to the stream of pane resize events of a
     * leaf node, or creates a placeholder one if no stream is currently
     * registered.
     *
     * Note that values returned by this function are valid across layout
     * changes as long as the leaf with the specified ID was not removed during
     * the change.
     * @param id the ID of the leaf node (_not_ template) to retrieve the resize
     *           stream for
     * @param nextWith an inner stream of events to switch the current stream to
     */
    private getLeafResizeStream(id: string,
                                nextWith: Observable<undefined>): Observable<undefined> {
        let entry = this.leafResizeStreams.get(id);

        if (entry === undefined) {
            entry = new BehaviorSubject<Observable<undefined>>(nextWith);
            this.leafResizeStreams.set(id, entry);
        }
        else {
            // TODO: suppress this for panes when we know the size didn't change
            entry.next(of(undefined));
            entry.next(nextWith);
        }

        return entry.pipe(switchAll());
    }

    /**
     * Collect all the necessary information to render the contents of a leaf
     * pane.
     * @param layout the name of the template to produce
     * @param onResize a stream of resize events for the associated pane
     */
    private renderLeafTemplate(layout: LeafLayout<X>, onResize: Observable<undefined>):
        Observable<LeafNodeTemplate<X>|undefined> {
        const $info = this.templateService.get(layout.template);

        return $info.pipe(map(info => {
            if (info === undefined) { return undefined; }

            const {template, header: templateHeader} = info;

            const header = this.initLeafHeader(layout.id);

            const $implicit = {
                get header(): PaneHeaderStyle {
                    return header.value !== undefined ? header.value : templateHeader;
                },
                set header(val: PaneHeaderStyle) {
                    // TODO: possibly add a synchronous version of this, but I
                    //       think that wouldn't be usable without raising
                    //       ExpressionChangedAfterItHasBeenCheckedErrors
                    if (!Object.is(val, header.value)) {
                        requestAnimationFrame(_ => header.next(val));
                    }
                },
                onResize,
            };

            return [template, {$implicit, extra: layout.extra}];
        }));
    }

    /**
     * Compute header information for a given layout.
     * @param layout the layout the header is intended for
     */
    private headerStyleForLayout(layout: ChildLayout<X>): Observable<PaneHeaderStyle> {
        // TODO: correctly calculate branch header style
        switch (layout.type) {
        case LayoutType.Leaf:
            const $info = this.templateService.get(layout.template);

            return $info.pipe(switchMap(info => this.initLeafHeader(layout.id).pipe(map(header => {
                if (header !== undefined) { return header; }
                if (info !== undefined) { return info.header; }

                return {
                    headerMode: PaneHeaderMode.Visible,
                    title: new BehaviorSubject('???'),
                    icon: new BehaviorSubject(undefined),
                    closable: true,
                };
            }))));
        case LayoutType.Group:
            return new BehaviorSubject({
                headerMode: PaneHeaderMode.Visible,
                title: new BehaviorSubject('TODO Group Header'),
                icon: new BehaviorSubject(undefined),
                closable: false,
            });
        case LayoutType.Horiz:
        case LayoutType.Vert:
            return new BehaviorSubject({
                headerMode: PaneHeaderMode.Hidden,
                title: new BehaviorSubject('SPLIT'),
                icon: new BehaviorSubject(undefined),
                closable: false,
            });
        case LayoutType.Tabbed:
            return new BehaviorSubject({
                headerMode: PaneHeaderMode.AlwaysTab,
                title: new BehaviorSubject('TABBED'),
                icon: new BehaviorSubject(undefined),
                closable: false,
            });
        }
    }

    /**
     * Register the contents of a pane as a drop target.
     * @param id the ID of the pane
     * @param el the element containing the pane
     * @param style the header style of the pane
     */
    private setPaneDropTarget(id: ChildLayoutId<X>,
                              el: ElementRef<HTMLElement>,
                              style: PaneHeaderStyle): void {
        this.dropTargets.set(el, {
            type: style.headerMode === PaneHeaderMode.Hidden ? DropTargetType.PaneNoTab
                                                             : DropTargetType.Pane,
            id,
        });
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
     * @param onResize a stream of resize events for the pane
     * @param skipDropTarget set to true to disable registering a drop target
     */
    private placeLeaf(container: ViewContainerRef,
                      withId: ChildWithId<X, LeafLayout<X>>,
                      pane: NgPaneComponent<X>,
                      onResize: Observable<undefined>,
                      skipDropTarget: boolean): ComponentRef<NgPaneLeafComponent<X>> {
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

        inst.pane   = pane;
        inst.layout = layout;

        const stream = this.getLeafResizeStream(layout.id, onResize);

        this.layoutSubscriptions.push(
            this.renderLeafTemplate(layout, stream).subscribe(t => inst.template = t));

        if (!skipDropTarget) {
            this.layoutSubscriptions.push(this.headerStyleForLayout(layout).subscribe(
                s => this.setPaneDropTarget(id, inst.el, s)));
        }

        return component;
    }

    /**
     * Render a grouped split pane.
     * @param container the container to render the group in
     * @param withId the layout node corresponding to the group
     * @param onResize a stream of resize events for the pane
     * @param skipDropTarget set to true to disable registering a drop target
     */
    private placeGroup(container: ViewContainerRef,
                       withId: ChildWithId<X, GroupLayout<X>>,
                       onResize: Observable<undefined>,
                       skipDropTarget: boolean): ComponentRef<NgPaneGroupComponent<X>> {
        const {child: layout, id} = withId;
        const component           = container.createComponent(this.groupFactory);
        const inst                = component.instance;

        if (layout.split !== undefined) {
            const pane = this.placePane(
                inst.renderer.viewContainer, layout.childId(), onResize, undefined, skipDropTarget);

            inst.split = pane.instance;
        }

        if (!skipDropTarget) {
            this.layoutSubscriptions.push(this.headerStyleForLayout(layout).subscribe(
                s => this.setPaneDropTarget(id, inst.el, s)));
        }

        return component;
    }

    /**
     * Render a split branch thumb.
     * @param container the container to render the thumb in
     * @param childId the layout node ID corresponding to the neighboring child
     * @param skipDropTarget set to true to disable registering a drop target
     */
    private placeSplitThumb(container: ViewContainerRef,
                            childId: ChildLayoutId<X, SplitLayout<X>>,
                            skipDropTarget: boolean): ComponentRef<NgPaneSplitThumbComponent<X>> {
        const component = container.createComponent(this.splitThumbFactory);
        const inst      = component.instance;

        inst.factory = this;
        inst.childId = childId;
        inst.vert    = childId.stem.type === LayoutType.Vert;

        if (!skipDropTarget) {
            this.dropTargets.set(inst.el, {type: DropTargetType.SplitThumb, id: childId});
        }

        return component;
    }

    /**
     * Render a split branch pane.
     * @param container the container to render the split branch in
     * @param withId the layout node corresponding to the split branch
     * @param onResize a stream of resize events for the pane
     * @param skipDropTarget set to true to disable registering a drop target
     */
    private placeSplit(container: ViewContainerRef,
                       withId: ChildWithId<X, SplitLayout<X>>,
                       onResize: Observable<undefined>,
                       skipDropTarget: boolean): ComponentRef<NgPaneSplitComponent<X>> {
        const {child: layout, id} = withId;
        const component           = container.createComponent(this.splitFactory);
        const inst                = component.instance;

        inst.vert = layout.type === LayoutType.Vert;

        for (let i = 0; i < layout.children.length; i += 1) {
            if (i !== 0) {
                this.placeSplitThumb(inst.renderer.viewContainer,
                                     {stem: layout, index: i - 1},
                                     skipDropTarget);
            }

            const pane = this.placePane(inst.renderer.viewContainer,
                                        layout.childId(i),
                                        merge(onResize,
                                              layout.ratioSumChanged.pipe(map(_ => undefined)),
                                              layout.resizeEvents.pipe(filter(({index}) => index ===
                                                                                           i),
                                                                       map(_ => undefined))),
                                        undefined,
                                        skipDropTarget);

            pane.instance.ratio = layout.ratios[i];

            inst.children.push(pane.instance);
        }

        inst.resizeEvents = layout.resizeEvents;

        if (!skipDropTarget) {
            this.layoutSubscriptions.push(this.headerStyleForLayout(layout).subscribe(
                s => this.setPaneDropTarget(id, inst.el, s)));
        }

        merge(layout.resizeEvents, layout.ratioSumChanged)
            .subscribe(_ => this.layoutUpdate.next(undefined));

        return component;
    }

    /**
     * Render a tabbed branch pane.
     * @param container the container to render the tabbed branch in
     * @param withId the layout node associated with the tabbed branch
     * @param onResize a stream of resize events for the pane
     * @param skipDropTarget set to true to disable registering a drop target
     */
    private placeTabbed(container: ViewContainerRef,
                        withId: ChildWithId<X, TabbedLayout<X>>,
                        onResize: Observable<undefined>,
                        skipDropTarget: boolean): ComponentRef<NgPaneTabbedComponent<X>> {
        const {child: layout, id} = withId;
        const component           = container.createComponent(this.tabbedFactory);
        const inst                = component.instance;

        for (let i = 0; i < layout.children.length; i += 1) {
            const pane = this.placePane(inst.renderer.viewContainer,
                                        layout.childId(i),
                                        merge(onResize.pipe(filter(_ => layout.currentTab === i)),
                                              layout.$currentTab.pipe(filter(t => t === i),
                                                                      map(_ => undefined))),
                                        true,
                                        skipDropTarget);

            pane.instance.hidden = true;

            inst.children.push(pane.instance);
        }

        inst.$currentTab = layout.$currentTab;

        if (!skipDropTarget) {
            this.layoutSubscriptions.push(this.headerStyleForLayout(layout).subscribe(
                s => this.setPaneDropTarget(id, inst.el, s)));
        }

        layout.$currentTab.subscribe(_ => this.layoutUpdate.next(undefined));

        return component;
    }

    /**
     * Render a pane header.
     * @param container the container to render the header in
     * @param withId the layout node corresponding to the header
     * @param style the style information for the header
     * @param skipDropTarget set to true to disable registering a drop target
     */
    private placeHeader(container: ViewContainerRef,
                        withId: ChildWithId<X>,
                        style: PaneHeaderStyle<PaneHeaderMode.Visible>,
                        skipDropTarget: boolean): ComponentInst<NgPaneHeaderComponent<X>> {
        const component = container.createComponent(this.headerFactory, 0);
        const inst      = component.instance;

        inst.manager = this.manager;
        inst.childId = withId.id;
        inst.style   = style;

        if (!skipDropTarget) {
            this.dropTargets.set(inst.el, {type: DropTargetType.Header, id: withId.id});
        }

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
     * @param skipDropTarget set to true to disable registering a drop target
     */
    private placeTab(container: ViewContainerRef, withId: ChildWithId<X>, skipDropTarget: boolean):
        ComponentInst<NgPaneTabComponent<X>> {
        const component = container.createComponent(this.tabFactory);
        const inst      = component.instance;

        inst.manager = this.manager;
        inst.childId = withId.id;

        if (!skipDropTarget) {
            this.dropTargets.set(inst.el, {type: DropTargetType.Tab, id: withId.id});
        }

        return {component, container, hostView: component.hostView};
    }

    /**
     * Render a pane tab row.\
     * This will automatically render the necessary tabs.
     * @param container the container to render the tab row in
     * @param withId the layout node corresponding to the tab row
     * @param style the header style information for the tab row
     * @param skipDropTarget set to true to disable registering a drop target
     */
    private placeTabRow(container: ViewContainerRef,
                        withId: ChildWithId<X>,
                        style: PaneHeaderStyle<PaneHeaderMode.AlwaysTab>,
                        skipDropTarget: boolean): ComponentInst<NgPaneTabRowComponent<X>> {
        const component = container.createComponent(this.tabRowFactory, 0);
        const inst      = component.instance;

        inst.manager = this.manager;
        inst.childId = withId.id;

        const layout = withId.child;

        if (layout.type === LayoutType.Tabbed) {
            layout.children.forEach((subchild, childIndex) => {
                const tab  = this.placeTab(inst.renderer.viewContainer,
                                          {child: subchild, id: layout.childId(childIndex)},
                                          skipDropTarget);
                const pane = this.panes.get(subchild);

                if (pane === undefined) { throw new Error('no pane found to match tab'); }

                pane.instance.header = {type: PaneHeaderType.Tab, header: tab};

                this.updatePaneHeader(pane.instance, skipDropTarget);

                inst.tabs.push(tab.component.instance);
            });

            inst.style       = style;
            inst.$currentTab = layout.$currentTab;
        }
        else {
            const tab  = this.placeTab(component.instance.renderer.viewContainer,
                                      withId,
                                      skipDropTarget);
            inst.tab   = tab.component.instance as NgPaneTabComponent<X, PaneHeaderMode.AlwaysTab>;
            inst.style = style;

            tab.component.instance.active = true;
        }

        if (!skipDropTarget) {
            this.dropTargets.set(inst.el, {type: DropTargetType.TabRow, id: withId.id});
        }

        return {component, container, hostView: component.hostView};
    }

    /**
     * Update the header of a pane, re-rendering it if necessary.
     * @param pane the pane to update the header for
     * @param skipDropTarget set to true to disable registering a drop target
     */
    private updatePaneHeader(pane: NgPaneComponent<X>, skipDropTarget: boolean): void {
        if (pane.header.type === PaneHeaderType.Skip) { return; }

        const withId = ChildWithId.fromId(pane.childId);
        const $style = this.headerStyleForLayout(withId.child);

        this.layoutSubscriptions.push($style.subscribe(style => {
            if (pane.header.type === PaneHeaderType.Skip) { return; }

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
                                                 style as PaneHeaderStyle<PaneHeaderMode.Visible>,
                                                 skipDropTarget),
                    };
                    break;
                case PaneHeaderType.TabRow:
                    pane.header = {
                        type: PaneHeaderType.TabRow,
                        header: this.placeTabRow(pane.renderer.viewContainer,
                                                 withId,
                                                 style as PaneHeaderStyle<PaneHeaderMode.AlwaysTab>,
                                                 skipDropTarget),
                    };
                    break;
                case PaneHeaderType.Tab: throw new Error('unreachable');
                }
            }
            else if (pane.header.type !== PaneHeaderType.None) {
                pane.header.header.component.instance.style = style;
            }
        }));
    }

    /**
     * Get the bounding client rectangle for a pane.
     * @param layout the layout corresponding to the pane
     */
    public getPaneRect(layout: ChildLayout<X>): DOMRect|undefined {
        const pane = this.panes.get(layout);

        if (pane === undefined) { return undefined; }

        return (pane.location.nativeElement as Element).getBoundingClientRect();
    }

    /**
     * Initialize the pane factory for rendering a layout.
     * @param dropTargets empty map of drag-and-drop hit targets to populate
     */
    public notifyLayoutChangeStart(): {
        /** A map of drop targets to be populated by the pane factory */
        targets: Map<ElementRef<HTMLElement>, DropTarget<X>>;
        /** A stream of minor update events for the current layout */
        layoutUpdate: Observable<undefined>;
    } {
        this.layoutUpdate.complete();

        this.dropTargets  = new Map();
        this.layoutUpdate = new Subject();

        this.panes.clear();

        for (const sub of this.layoutSubscriptions) { sub.unsubscribe(); }

        this.layoutSubscriptions.splice(0, this.layoutSubscriptions.length);

        return {targets: this.dropTargets, layoutUpdate: this.layoutUpdate};
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
                    this.leafHeaders.delete(key);
                    this.leafResizeStreams.delete(key);
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
     * @param onResize a stream of resize events for the pane
     * @param skipHeader disable rendering the header of this pane
     * @param skipDropTarget set to true to disable registering a drop target
     */
    public placePane(container: ViewContainerRef,
                     childId: ChildLayoutId<X>,
                     onResize: Observable<undefined>,
                     skipHeader: boolean     = false,
                     skipDropTarget: boolean = false): ComponentRef<NgPaneComponent<X>> {
        const component = container.createComponent(this.paneFactory);

        const inst = component.instance;

        if (!childIdValid(childId)) { return component; }

        const child = childFromId(childId);

        this.panes.set(child, component);

        inst.childId = childId;

        if (skipHeader) { inst.header = {type: PaneHeaderType.Skip}; }

        switch (child.type) {
        case LayoutType.Leaf:
            inst.content = this.placeLeaf(
                inst.renderer.viewContainer, {child, id: childId}, inst, onResize, skipDropTarget);
            break;
        case LayoutType.Group:
            inst.content = this.placeGroup(inst.renderer.viewContainer,
                                           {child, id: childId},
                                           onResize,
                                           skipDropTarget);
            break;
        case LayoutType.Horiz:
        case LayoutType.Vert:
            inst.content = this.placeSplit(inst.renderer.viewContainer,
                                           {child, id: childId},
                                           onResize,
                                           skipDropTarget);
            break;
        case LayoutType.Tabbed:
            inst.content = this.placeTabbed(inst.renderer.viewContainer,
                                            {child, id: childId},
                                            onResize,
                                            skipDropTarget);
            break;
        }

        this.updatePaneHeader(inst, skipDropTarget);

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
