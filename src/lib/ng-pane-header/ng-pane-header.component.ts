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

import {Component, HostListener} from '@angular/core';

import {ChildLayoutId} from '../pane-layout/module';
import {PaneHeaderMode, PaneHeaderStyle} from '../pane-template';

@Component({
    selector: 'lib-ng-pane-header',
    template: `
    <ng-container *ngIf="style">
        <ng-container *ngIf="style.icon | async as icon">
            <img class="lib-ng-pane-header-icon" [src]="icon">
        </ng-container>
        <span class="lib-ng-pane-header-title">{{style.title | async}}</span>
    </ng-container>`,
    styleUrls: ['./ng-pane-header.component.scss'],
})
export class NgPaneHeaderComponent {
    childId!: ChildLayoutId;
    style!: PaneHeaderStyle&{headerMode: PaneHeaderMode.Visible};

    @HostListener('mousedown', ['$event'])
    protected onMouseDown(evt: MouseEvent) {
        if (evt.buttons !== 1) return;

        // TODO: dragon drop
    }
}
