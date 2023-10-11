/**********************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-tab-row.component.ts)
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

import { Component, ElementRef, ViewChild } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

import { ClosablePaneComponent } from '../closable';
import { NgPaneHeaderComponent } from '../ng-pane-header/ng-pane-header.component';
import { NgPaneRendererDirective } from '../ng-pane-renderer.directive';
import { RenderedHeaderStyle } from '../pane-factory';
import { PaneHeaderMode } from '../pane-template';

/**
 * Extra information for a mock tab row with a single tab.
 */
interface SimpleExtra<X> {
    /** The tab owned by this tab row */
    tab: NgPaneHeaderComponent<X, PaneHeaderMode.AlwaysTab>;
}

/**
 * Extra information for a real tab row with multiple tabs.
 */
interface TabbedExtra<X> {
    /** Disallows `tab` as a property name.  Used for type checking. */
    tab?: never;
    /** The style information for this pane */
    style: RenderedHeaderStyle<X, PaneHeaderMode.AlwaysTab> | undefined;
    /** Subscription for current tab changes */
    subscription: Subscription | undefined;
    /** The tabs rendered into this tab row */
    tabs: NgPaneHeaderComponent<X>[];
    /** The tab currently rendered as selected */
    current: number | undefined;
}

/**
 * A row of tabs, corresponding to either a pane with a header mode of
 * `AlwaysTab` or the children of a tabbed branch pane.
 */
@Component({
    selector: 'lib-ng-pane-tab-row',
    template: `<ng-container libNgPaneRenderer></ng-container>
        <div class="lib-ng-pane-tab-row-spacer"></div>`,
})
export class NgPaneTabRowComponent<X> extends ClosablePaneComponent<X> {
    /** Extra information.  See `SimpleExtra` and `TabbedExtra` */
    private extra!: SimpleExtra<X> | TabbedExtra<X> | undefined;

    /** Provides a view container to render into */
    @ViewChild(NgPaneRendererDirective, { static: true })
    public readonly renderer!: NgPaneRendererDirective;

    /**
     * The header style information for this tab row.\
     * For a mock tab row, this information is passed on to the contained tab.
     */
    public get style(): RenderedHeaderStyle<X, PaneHeaderMode.AlwaysTab> {
        if (this.extra === undefined) {
            throw new Error('tab row in invalid state');
        }

        if (this.extra.tab !== undefined) {
            return this.extra.tab.style;
        }

        if (this.extra.style === undefined) {
            throw new Error('tab row in invalid state');
        }

        return this.extra.style;
    }

    public set style(style: RenderedHeaderStyle<X, PaneHeaderMode.AlwaysTab>) {
        if (this.extra === undefined) {
            this.setupTabbedExtra();
        } else if (this.extra.tab !== undefined) {
            this.extra.tab.style = style;
        } else {
            this.extra.style = style;
        }
    }

    /** Convert this to a mock tab row using the given tab. */
    public set tab(tab: NgPaneHeaderComponent<X, PaneHeaderMode.AlwaysTab>) {
        const style = this.extra !== undefined ? this.style : undefined;

        this.extra = { tab };
        if (style !== undefined) {
            this.style = style;
        }
    }

    /** If this is a real tab row, return the child tabs. */
    public get tabs(): NgPaneHeaderComponent<X>[] {
        const extra = this.setupTabbedExtra();
        if (extra === undefined) {
            throw new Error('tab row in invalid state');
        }

        return extra.tabs;
    }

    /**
     * If this is a real tab row, binds and event handler to the given stream of
     * current tab events.
     */
    public set $currentTab(val: Observable<number>) {
        const extra = this.setupTabbedExtra();
        if (extra === undefined) {
            throw new Error('tab row in invalid state');
        }

        if (extra.subscription !== undefined) {
            extra.subscription.unsubscribe();
        }

        extra.subscription = val.subscribe(tab => {
            if (extra.current !== undefined) {
                extra.tabs[extra.current].tabActive = false;
            }

            extra.current = tab;

            extra.tabs[tab].tabActive = true;
        });
    }

    /**
     * Construct a new tab row.
     * @param el injected for use in computing drag-and-drop hit targets
     */
    public constructor(public readonly el: ElementRef<HTMLElement>) {
        super();
    }

    /**
     * Set up default information for a real tab row.
     */
    private setupTabbedExtra(): TabbedExtra<X> | undefined {
        if (this.extra === undefined) {
            this.extra = {
                style: undefined,
                subscription: undefined,
                tabs: [],
                current: undefined,
            };

            return this.extra;
        }

        return this.extra.tab !== undefined ? undefined : this.extra;
    }
}
