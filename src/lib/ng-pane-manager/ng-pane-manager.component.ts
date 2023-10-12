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
    ComponentRef,
    ElementRef,
    EventEmitter,
    Input,
    OnDestroy,
    Output,
    ViewChild,
} from '@angular/core';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { map, switchAll } from 'rxjs/operators';

import { DropTarget } from '../drag-and-drop';
import { NgPaneHeaderTemplateService } from '../ng-pane-header-templates.service';
import { NgPaneLeafTemplateService } from '../ng-pane-leaf-templates.service';
import { NgPaneRendererDirective } from '../ng-pane-renderer.directive';
import { NgPaneComponent } from '../ng-pane/ng-pane.component';
import { PaneFactory } from '../pane-factory';
import { LayoutType, RootLayout } from '../pane-layout/module';

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
export class NgPaneManagerComponent<X> implements OnDestroy {
    /** Provides a view container to render into */
    @ViewChild(NgPaneRendererDirective, { static: true })
    private readonly renderer!: NgPaneRendererDirective;

    /** See `layout` */
    private _layout: RootLayout<X> = new RootLayout(undefined);
    /** See `dropTargets` */
    private _dropTargets: Map<ElementRef<HTMLElement>, DropTarget<X>> = new Map();
    /** See `layoutUpdate` */
    private readonly _layoutUpdate: BehaviorSubject<Observable<RootLayout<X>>> =
        new BehaviorSubject(of() as Observable<RootLayout<X>>);
    /** A stream of resize events to send to all panes */
    private readonly onResize: Subject<undefined> = new Subject();
    /** The root component of the current layout */
    private pane: ComponentRef<NgPaneComponent<X>> | undefined;
    /** The pane factory used for rendering all inner components */
    private readonly factory: PaneFactory<X>;

    /** Event emitter for when the rendered layout is changed. */
    @Output() public readonly layoutChange: EventEmitter<RootLayout<X>> = new EventEmitter();

    /**
     * Event emitter for when minor updates to the layout occur, such as tab
     * changes or resized.
     *
     * The value passed is always the current layout, which will be equal to the
     * value of the last `layoutChange` event.
     */
    @Output()
    public readonly layoutUpdate: Observable<RootLayout<X>> = this._layoutUpdate.pipe(switchAll());

    /**
     * The current layout being rendered.  This can be changed using the
     * accessor, and is automatically updated when the layout is changed by the
     * user.
     */
    @Input()
    public get layout(): RootLayout<X> {
        return this._layout;
    }

    public set layout(val: RootLayout<X>) {
        this.transactLayoutChange(_ => val);
    }

    /**
     * Drag-and-drop information created by the pane renderer. Used for
     * hit testing during drag-and-drop.
     */
    public get dropTargets(): Readonly<Map<ElementRef<Element>, DropTarget<X>>> {
        return this._dropTargets;
    }

    /**
     * Construct a new pane manager.
     * @param cfr injected for use by the pane factory
     */
    public constructor(
        public el: ElementRef<Element>,
        leafTemplateService: NgPaneLeafTemplateService<X>,
        headerTemplateService: NgPaneHeaderTemplateService<X>,
    ) {
        this.factory = new PaneFactory(this, leafTemplateService, headerTemplateService);
    }

    /**
     * Clean up all resources used by this pane manager.
     */
    public ngOnDestroy(): void {
        this.onResize.complete();
    }

    /**
     * Constructs a map from native elements to drag-and-drop information.  Used
     * for hit testing during drag-and-drop.
     */
    public collectNativeDropTargets(): Map<Element, DropTarget<X>> {
        const ret = new Map();

        for (const [key, val] of this._dropTargets) {
            ret.set(key.nativeElement, val);
        }

        return ret;
    }

    /**
     * Notify all child panes that a resize of the host pane manager occurred.
     */
    public notifyResize(): void {
        this.onResize.next(undefined);
    }

    /**
     * Apply one or more changes to the rendered layout as a single operation.
     * @param fn callback returning a new layout given the current one
     * @param after hook to run just before all unused leaf nodes are destroyed.
     *              Returns whether a layout change event should be emitted.
     */
    public transactLayoutChange(
        fn: (layout: RootLayout<X>, factory: PaneFactory<X>) => RootLayout<X>,
        after?: (factory: PaneFactory<X>, renderer: NgPaneRendererDirective) => boolean,
    ): void {
        let newLayout = fn(this._layout, this.factory);

        const simplified = newLayout.simplifyDeep();

        if (simplified !== undefined) {
            if (simplified.type !== LayoutType.Root) {
                throw new Error('invalid simplification - root layout collapsed into child');
            }

            newLayout = simplified;
        }

        this._layout = newLayout;

        const oldPane = this.pane;

        const { targets, layoutUpdate } = this.factory.notifyLayoutChangeStart();
        this._dropTargets = targets;

        try {
            this.pane = this.factory.placePane(
                this.renderer.viewContainer,
                newLayout.childId(),
                this.onResize,
            );

            let emitChange = true;

            if (after !== undefined) {
                emitChange = after(this.factory, this.renderer);
            }

            if (emitChange) {
                this.layoutChange.emit(this._layout);

                // Freeze the value of the events so that the layout passed does
                // not update until the next time layoutChange.emit is called
                const layout = this._layout;
                this._layoutUpdate.next(layoutUpdate.pipe(map(_ => layout)));
            }
        } finally {
            if (oldPane !== undefined) {
                oldPane.destroy();
            }

            this.factory.notifyLayoutChangeEnd();
        }
    }
}
