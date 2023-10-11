/********************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-split.component.ts)
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
 *******************************************************************************************/

import { Component, ElementRef, HostBinding, ViewChild } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

import { NgPaneRendererDirective } from '../ng-pane-renderer.directive';
import { NgPaneComponent } from '../ng-pane/ng-pane.component';
import { ResizeEvent } from '../pane-layout/module';

/**
 * A split branch pane, stacking its elements either horizontally or vertically.
 */
@Component({
    selector: 'lib-ng-pane-split',
    template: '<ng-container libNgPaneRenderer></ng-container>',
    styleUrls: ['./ng-pane-split.component.scss'],
})
export class NgPaneSplitComponent<X> {
    /** Subscription for child resize events */
    private subscription: Subscription | undefined;

    /** Provides a view container to render into */
    @ViewChild(NgPaneRendererDirective, { static: true })
    public readonly renderer!: NgPaneRendererDirective;

    /** The child panes rendered into this one */
    public children: NgPaneComponent<X>[] = [];

    /** Indicates this pane renders as a vertical split */
    @HostBinding('class.lib-ng-pane-vert') public vert: boolean = false;

    /** Indicates this pane renders as a horizontal split */
    @HostBinding('class.lib-ng-pane-horiz')
    public get horiz(): boolean {
        return !this.vert;
    }

    /** Binds an event handler to the given stream of child resize events */
    public set resizeEvents(val: Observable<ResizeEvent>) {
        if (this.subscription !== undefined) {
            this.subscription.unsubscribe();
        }

        this.subscription = val.subscribe(({ index, ratio }) => {
            this.children[index].ratio = ratio;
        });
    }

    /**
     * Construct a new split pane.
     * @param el injected for use in computing drag-and-drop hit targets and
     *           child resizing
     */
    public constructor(public readonly el: ElementRef<HTMLElement>) {}
}
