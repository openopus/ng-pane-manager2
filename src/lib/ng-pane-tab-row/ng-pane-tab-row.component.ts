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

import {Component, ElementRef, ViewChild} from '@angular/core';
import {Observable, Subscription} from 'rxjs';

import {DraggablePaneComponent} from '../drag-and-drop';
import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';
import {NgPaneTabComponent} from '../ng-pane-tab/ng-pane-tab.component';
import {PaneHeaderMode, PaneHeaderStyle} from '../pane-template';

interface SimpleExtra {
    tab: NgPaneTabComponent&{style: {headerMode: PaneHeaderMode.AlwaysTab}};
}

interface TabbedExtra {
    tab?: undefined;
    style: PaneHeaderStyle&{headerMode: PaneHeaderMode.AlwaysTab}|undefined;
    subscription: Subscription|undefined;
    tabs: NgPaneTabComponent[];
    current: number|undefined;
}

@Component({
    selector: 'lib-ng-pane-tab-row',
    template: '<ng-container libNgPaneRenderer></ng-container>',
    styleUrls: ['./ng-pane-tab-row.component.scss'],
})
export class NgPaneTabRowComponent extends DraggablePaneComponent {
    @ViewChild(NgPaneRendererDirective, {static: true}) readonly renderer!: NgPaneRendererDirective;

    private extra!: SimpleExtra|TabbedExtra|undefined;

    get style(): PaneHeaderStyle&{headerMode: PaneHeaderMode.AlwaysTab} {
        if (this.extra === undefined) throw new Error('tab row in invalid state');

        if (this.extra.tab !== undefined) return this.extra.tab.style;

        if (this.extra.style === undefined) throw new Error('tab row in invalid state');

        return this.extra.style;
    }

    set style(style: PaneHeaderStyle&{headerMode: PaneHeaderMode.AlwaysTab}) {
        if (this.extra === undefined)
            this.setupTabbedExtra();
        else if (this.extra.tab !== undefined)
            this.extra.tab.style = style;
        else
            this.extra.style = style;
    }

    set tab(tab: NgPaneTabComponent&{style: {headerMode: PaneHeaderMode.AlwaysTab}}) {
        const style = this.extra !== undefined ? this.style : undefined;

        this.extra = {tab};
        if (style !== undefined) this.style = style;
    }

    get tabs(): NgPaneTabComponent[] {
        const extra = this.setupTabbedExtra();
        if (extra === undefined) throw new Error('tab row in invalid state');

        return extra.tabs;
    }

    set $currentTab(val: Observable<number>) {
        const extra = this.setupTabbedExtra();
        if (extra === undefined) throw new Error('tab row in invalid state');

        if (extra.subscription !== undefined) extra.subscription.unsubscribe();

        extra.subscription = val.subscribe(tab => {
            if (extra.current !== undefined) extra.tabs[extra.current].active = false;

            extra.current = tab;

            extra.tabs[tab].active = true;
        });
    }

    constructor(readonly el: ElementRef<HTMLElement>) { super(); }

    private setupTabbedExtra(): TabbedExtra|undefined {
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
