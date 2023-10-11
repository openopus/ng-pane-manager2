/********************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-title.component.ts)
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

import { Component } from '@angular/core';

import { BasicPaneHeaderStyle, PaneHeaderMode } from '../pane-template';

/**
 * The title and icon of a pane header or tab.
 */
@Component({
    selector: 'lib-ng-pane-title',
    template: `<ng-container *ngIf="style">
        <ng-container *ngIf="style.icon | async as icon">
            <img class="lib-ng-pane-icon" [src]="icon" />
        </ng-container>
        <span class="lib-ng-pane-title">{{ style.title | async }}</span>
    </ng-container>`,
})
export class NgPaneTitleComponent {
    /** The header style information for this title */
    public style!: BasicPaneHeaderStyle<PaneHeaderMode.Visible | PaneHeaderMode.AlwaysTab>;
}
