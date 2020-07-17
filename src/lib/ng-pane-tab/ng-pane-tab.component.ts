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

import {ClosablePaneComponent} from '../closable';
import {LayoutType} from '../pane-layout/module';
import {PaneHeaderMode, PaneHeaderStyle} from '../pane-template';

/**
 * A tab, representing a pane that either has an `AlwaysTab` header mode or
 * belongs to a tabbed branch pane.
 */
@Component({
    selector: 'lib-ng-pane-tab',
    template: `
    <ng-container *ngIf="style">
        <ng-container *ngIf="style.icon | async as icon">
            <img class="lib-ng-pane-tab-icon" [src]="icon">
        </ng-container>
        <span class="lib-ng-pane-tab-title">{{style.title | async}}</span>
        <ng-container *ngIf="style.closable">
            <div class="lib-ng-pane-tab-spacer"></div>
            <button class="lib-ng-pane-tab-close"
                    (mousedown)="$event.stopPropagation()"
                    (click)="close()"></button>
        </ng-container>
    </ng-container>`,
    styleUrls: ['./ng-pane-tab.component.scss'],
})
export class NgPaneTabComponent<T extends PaneHeaderMode = PaneHeaderMode> extends
    ClosablePaneComponent<T> {
    /** The style information for this tab */
    public style!: PaneHeaderStyle<T>;

    /** Indicates the current tab is selected and its pane is visible */
    @HostBinding('class.lib-ng-pane-tab-active') public active: boolean = false;

    /**
     * Construct a new tab.
     * @param el injected for use in computing drag-and-drop hit targets
     */
    public constructor(public readonly el: ElementRef<HTMLElement>) { super(); }

    /**
     * Selects the current tab and initiates a drag of the associated pane.
     */
    protected onMouseDown(evt: MouseEvent): void {
        super.onMouseDown(evt);

        if (evt.buttons === 1 && this.childId.stem.type === LayoutType.Tabbed) {
            this.childId.stem.currentTab = this.childId.index;
        }
    }
}
