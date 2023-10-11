/*********************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-header.component.ts)
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
 ********************************************************************************************/

import {
    Component,
    ComponentFactory,
    ComponentFactoryResolver,
    ElementRef,
    HostBinding,
    ViewChild,
} from '@angular/core';

import { ClosablePaneComponent } from '../closable';
import { NgPaneRendererDirective } from '../ng-pane-renderer.directive';
import { NgPaneTitleComponent } from '../ng-pane-title/ng-pane-title.component';
import { RenderedHeaderStyle } from '../pane-factory';
import { LayoutType } from '../pane-layout/module';
import { HeaderWidgetContext, PaneHeaderMode, sameHeaderStyle } from '../pane-template';

/**
 * A pane header or pane tab.
 */
@Component({
    selector: 'lib-ng-pane-header',
    template: `<span>
            <ng-container libNgPaneRenderer #title></ng-container>
        </span>
        <span class="lib-ng-pane-header-spacer"></span>
        <span>
            <ng-container libNgPaneRenderer #controls></ng-container>
        </span>
        <ng-container *ngIf="style && style.closable">
            <button
                class="lib-ng-pane-header-close"
                (mousedown)="$event.stopPropagation()"
                (touchstart)="$event.stopPropagation()"
                (click)="close()"
            ></button>
        </ng-container>`,
})
export class NgPaneHeaderComponent<
    X,
    T extends PaneHeaderMode.Visible | PaneHeaderMode.AlwaysTab =
        | PaneHeaderMode.Visible
        | PaneHeaderMode.AlwaysTab,
> extends ClosablePaneComponent<X, T> {
    /** Provides a view container to render the title widget into */
    @ViewChild('title', { read: NgPaneRendererDirective, static: true })
    private readonly title!: NgPaneRendererDirective;

    /** Provides a view container to render the controls widget into */
    @ViewChild('controls', { read: NgPaneRendererDirective, static: true })
    private readonly controls!: NgPaneRendererDirective;

    /** Factory for the default pane title component */
    private readonly titleFactory: ComponentFactory<NgPaneTitleComponent>;

    /** See `style`. */
    private _style!: RenderedHeaderStyle<X, T>;

    /** Indicates the current header is a selected tab and its pane is visible */
    @HostBinding('class.lib-ng-pane-tab-active') public tabActive: boolean = false;

    /** The header style to render */
    public get style(): RenderedHeaderStyle<X, T> {
        return this._style;
    }

    public set style(val: RenderedHeaderStyle<X, T>) {
        if (sameHeaderStyle(val, this._style)) {
            return;
        }

        this._style = val;

        this.title.viewContainer.clear();
        this.controls.viewContainer.clear();

        if (val.title === undefined) {
            if (val.widgets !== undefined) {
                this.title.viewContainer.createEmbeddedView<HeaderWidgetContext<X>>(
                    val.widgets.title,
                    val.widgets.context,
                );

                if (val.widgets.controls !== undefined) {
                    this.controls.viewContainer.createEmbeddedView<HeaderWidgetContext<X>>(
                        val.widgets.controls,
                        val.widgets.context,
                    );
                }
            }
        } else {
            const component = this.title.viewContainer.createComponent(this.titleFactory);

            component.instance.style = val;
        }
    }

    /**
     * Construct a new pane header.
     * @param el injected for use in computing drag-and-drop hit targets
     */
    public constructor(
        public readonly el: ElementRef<HTMLElement>,
        cfr: ComponentFactoryResolver,
    ) {
        super();
        this.titleFactory = cfr.resolveComponentFactory(NgPaneTitleComponent);
    }

    /**
     * Selects the current tab and initiates a drag of the associated pane.
     */
    public onMouseDown(evt: MouseEvent): void {
        if (evt.buttons === 1 && this.childId.stem.type === LayoutType.Tabbed) {
            this.childId.stem.currentTab = this.childId.index;
        }

        super.onMouseDown(evt);
    }

    /**
     * Selects the current tab and initiates a drag of the associated pane.
     */
    public onTouchStart(evt: TouchEvent): void {
        if (evt.touches.length === 1 && this.childId.stem.type === LayoutType.Tabbed) {
            this.childId.stem.currentTab = this.childId.index;
        }

        super.onTouchStart(evt);
    }
}
