/******************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-tab.component.ts)
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
 *****************************************************************************************/

import {Component, ElementRef, HostBinding} from '@angular/core';

import {DraggablePaneComponent} from '../drag-and-drop';
import {LayoutType} from '../pane-layout/module';
import {PaneHeaderStyle} from '../pane-template';

@Component({
    selector: 'lib-ng-pane-tab',
    template: `
    <ng-container *ngIf="style">
        <ng-container *ngIf="style.icon | async as icon">
            <img class="lib-ng-pane-tab-icon" [src]="icon">
        </ng-container>
        <span class="lib-ng-pane-tab-title">{{style.title | async}}</span>
    </ng-container>`,
    styleUrls: ['./ng-pane-tab.component.scss'],
})
export class NgPaneTabComponent extends DraggablePaneComponent {
    style!: PaneHeaderStyle;

    @HostBinding('class.lib-ng-pane-tab-active') active = false;

    constructor(readonly el: ElementRef<HTMLElement>) { super(); }

    protected onMouseDown(evt: MouseEvent) {
        super.onMouseDown(evt);

        if (evt.buttons === 1 && this.childId.stem.type === LayoutType.Tabbed)
            this.childId.stem.currentTab = this.childId.index;
    }
}
