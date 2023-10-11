/*****************************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-drop-highlight.component.ts)
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
 ****************************************************************************************************/

import { Component, HostBinding } from '@angular/core';

/**
 * An overlay indicating where a floating pane currently being dragged will end
 * up being dropped.
 */
@Component({
    selector: 'lib-ng-pane-drop-highlight',
    template: '',
    styleUrls: ['./ng-pane-drop-highlight.component.scss'],
})
export class NgPaneDropHighlightComponent {
    /** Whether this drop highlight is currently visible */
    @HostBinding('class.lib-ng-pane-drop-highlight-visible') public visible: boolean = false;
    /** The X position of this drop highlight */
    @HostBinding('style.left.px') public left: number = 0;
    /** The Y position of this drop highlight */
    @HostBinding('style.top.px') public top: number = 0;
    /** The width of this drop highlight */
    @HostBinding('style.width.px') public width: number = 0;
    /** The height of this drop highlight */
    @HostBinding('style.height.px') public height: number = 0;
    /** Whether to emphasize a particular edge of the highlight */
    @HostBinding('attr.data-lib-ng-pane-drop-emphasize')
    public emphasize: 'left' | 'right' | undefined;
}
