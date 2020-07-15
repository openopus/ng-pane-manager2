/**********************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-manager.component.ts)
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
 *********************************************************************************************/

import {
    Component,
    ComponentFactoryResolver,
    ComponentRef,
    ElementRef,
    Input,
    TemplateRef,
    ViewChild,
} from '@angular/core';

import {DropTarget} from '../drag-and-drop';
import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';
import {NgPaneComponent} from '../ng-pane/ng-pane.component';
import {PaneFactory} from '../pane-factory';
import {LayoutType, RootLayout} from '../pane-layout/module';
import {LeafNodeContext, PaneHeaderStyle} from '../pane-template';

/**
 * The root component for `angular-pane-manager`, providing a tree-like
 * hierarchical layout for child components with support for adjusting and
 * rearranging panes.
 */
@Component({
    // tslint:disable-next-line component-selector
    selector: 'ng-pane-manager',
    template: '<ng-container libNgPaneRenderer></ng-container>',
    styleUrls: ['./ng-pane-manager.component.scss'],
})
export class NgPaneManagerComponent {
    /** See `layout` */
    private _layout: RootLayout                                = new RootLayout(undefined);
    /** See `dropTargets` */
    private _dropTargets: Map<ElementRef<Element>, DropTarget> = new Map();
    /** The root component of the current layout */
    private pane: ComponentRef<NgPaneComponent>|undefined;
    /** The pane factory used for rendering all inner components */
    private readonly factory: PaneFactory;

    /** Provides a view container to render into */
    @ViewChild(NgPaneRendererDirective, {static: true})
    public readonly renderer!: NgPaneRendererDirective;

    /**
     * The current layout being rendered.  This can be changed using the
     * accessor, and is automatically updated when the layout is changed by the
     * user.
     */
    @Input()
    public get layout(): RootLayout {
        return this._layout;
    }

    public set layout(val: RootLayout) {
        if (val === this._layout) { return; }

        if (val.type !== LayoutType.Root) {
            throw new Error('invalid layout type for pane manager - must be a root layout');
        }

        let newLayout = val.simplifyDeep();

        if (newLayout !== undefined) {
            if (newLayout.type !== LayoutType.Root) {
                throw new Error('invalid simplification - root layout collapsed into child');
            }
        }
        else {
            newLayout = val;
        }

        this._layout = newLayout;

        const oldPane = this.pane;

        this.factory.notifyLayoutChangeStart(this._dropTargets = new Map());

        try {
            this.pane = this.factory.placePane(this.renderer.viewContainer, newLayout.childId());
        }
        finally {
            this.factory.notifyLayoutChangeEnd();

            if (oldPane !== undefined) { oldPane.destroy(); }
        }
    }

    /**
     * Drag-and-drop information created by the pane renderer. Used for
     * hit testing during drag-and-drop.
     */
    public get dropTargets(): Readonly<Map<ElementRef<Element>, DropTarget>> {
        return this._dropTargets;
    }

    /**
     * Construct a new pane manager.
     * @param cfr injected for use by the pane factory
     */
    public constructor(cfr: ComponentFactoryResolver) { this.factory = new PaneFactory(this, cfr); }

    /**
     * Registers a given `TemplateRef` for leaves with the corresponding
     * template ID string.
     * @param name the name of the template, corresponding with the `template`
     *             property of leaf nodes
     * @param header the default style information for this template
     * @param template the content to render in leaves with this template
     */
    public registerLeafTemplate(name: string,
                                header: PaneHeaderStyle,
                                template: TemplateRef<LeafNodeContext>): void {
        this.factory.registerLeafTemplate(name, header, template);
    }

    /**
     * Removes the leaf template corresponding to the given name.
     * @param name the name of the template to remove
     */
    public unregisterLeafTemplate(name: string): void { this.factory.unregisterLeafTemplate(name); }

    /**
     * Constructs a map from native elements to drag-and-drop information.  Used
     * for hit testing during drag-and-drop.
     */
    public collectNativeDropTargets(): Map<Element, DropTarget> {
        const ret = new Map();

        for (const [key, val] of this._dropTargets) { ret.set(key.nativeElement, val); }

        return ret;
    }
}
