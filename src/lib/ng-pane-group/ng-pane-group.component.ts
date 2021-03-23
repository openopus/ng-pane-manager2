/********************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-group.component.ts)
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

import {Component, ElementRef, ViewChild} from '@angular/core';
import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';
import {NgPaneComponent} from '../ng-pane/ng-pane.component';

/**
 * A grouped split pane, adding header controls to a contained split pane.
 */
@Component({
    selector: 'lib-ng-pane-group',
    template: `<ng-container libNgPaneRenderer></ng-container>`,
    styleUrls: ['./ng-pane-group.component.scss'],
})
export class NgPaneGroupComponent<X> {
    /** Provides a view container to render into */
    @ViewChild(NgPaneRendererDirective, {static: true})
    public readonly renderer!: NgPaneRendererDirective;

    /** The child split pane rendered into this one */
    public split: NgPaneComponent<X>|undefined;

    /**
     * Construct a new grouped split pane.
     * @param el injected for use in computing drag-and-drop hit targets
     */
    public constructor(public readonly el: ElementRef<HTMLElement>) {}
}
