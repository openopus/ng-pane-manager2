/*****************************************************************************************
 *
 * ng-pane-manager2 - a port of ng-pane-manager to Angular 2+ (ng-pane-branch.component.ts)
 * Copyright (C) 2019 Opus Logica
 *
 * ng-pane-manager2 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * ng-pane-manager2 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with ng-pane-manager2.  If not, see <https://www.gnu.org/licenses/>.
 *
 ****************************************************************************************/

import {Component, HostBinding, Input, ViewChild} from '@angular/core';

import {LayoutNodeFactory} from '../layout-node-factory';
import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';
import {BranchLayout, LayoutType} from '../pane-layout';

@Component({
    selector: 'lib-ng-pane-branch',
    template: '<ng-container libNgPaneRenderer></ng-container>',
    styleUrls: ['./ng-pane-branch.component.scss'],
})
export class NgPaneBranchComponent {
    @ViewChild(NgPaneRendererDirective, {static: true}) private renderer: NgPaneRendererDirective;

    private _layout?: BranchLayout;
    @Input() factory: LayoutNodeFactory;

    @HostBinding('class.horiz')
    get horiz() {
        return this._layout && this._layout.type === LayoutType.Horiz;
    }

    @HostBinding('class.vert')
    get vert() {
        return this._layout && this._layout.type === LayoutType.Vert;
    }

    @HostBinding('class.tab')
    get tab() {
        return this._layout && this._layout.type === LayoutType.Tabbed;
    }

    @Input()
    set layout(val: BranchLayout) {
        if (this._layout === val) return;

        this._layout = val;

        if (!this._layout) return;

        let internalHeader = this._layout.type !== LayoutType.Tabbed;

        for (let child of this._layout.getChildren()) {
            this.factory.placeBranchChildForLayout(this.renderer.viewContainer,
                                                   child,
                                                   internalHeader &&
                                                       child.type === LayoutType.Leaf);
        }
    }

    get layout(): BranchLayout { return this._layout; }

    constructor() {}
}
