/*********************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-tabbed.component.ts)
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

import {Component, ElementRef, ViewChild} from '@angular/core';
import {Observable, Subscription} from 'rxjs';

import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';
import {NgPaneComponent} from '../ng-pane/ng-pane.component';

@Component({
    selector: 'lib-ng-pane-tabbed',
    template: '<ng-container libNgPaneRenderer></ng-container>',
    styleUrls: ['./ng-pane-tabbed.component.scss'],
})
export class NgPaneTabbedComponent {
    @ViewChild(NgPaneRendererDirective, {static: true}) readonly renderer!: NgPaneRendererDirective;

    private subscription: Subscription|undefined;
    private current: number|undefined;
    children: NgPaneComponent[] = [];

    set $currentTab(val: Observable<number>) {
        if (this.subscription !== undefined) this.subscription.unsubscribe();

        this.subscription = val.subscribe(tab => {
            if (this.current !== undefined) this.children[this.current].hidden = true;

            this.current = tab;

            this.children[tab].hidden = false;
        });
    }

    constructor(readonly el: ElementRef<HTMLElement>) {}
}
