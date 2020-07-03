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

import {Component, ElementRef, HostListener, Input} from '@angular/core';
import {Observable} from 'rxjs';

import {DraggablePaneComponent} from '../drag-n-drop';

@Component({
    selector: 'lib-ng-pane-header',
    template: `
    <ng-container *ngIf="icon | async as icon">
        <img class="lib-ng-pane-header-icon" [src]="icon">
    </ng-container>
    <span class="lib-ng-pane-header-title">{{title | async}}</span>`,
    styleUrls: ['./ng-pane-header.component.scss'],
})
export class NgPaneHeaderComponent extends DraggablePaneComponent {
    @Input() title: Observable<string>|undefined;
    @Input() icon: Observable<string|undefined>|undefined;

    constructor(public el: ElementRef<HTMLElement>) { super(); }

    @HostListener('mousedown', ['$event'])
    protected onMouseDown(evt: MouseEvent) {
        super.onMouseDown(evt);
    }
}
