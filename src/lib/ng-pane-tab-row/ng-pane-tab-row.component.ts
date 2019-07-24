/******************************************************************************************
 *
 * ng-pane-manager2 - a port of ng-pane-manager to Angular 2+ (ng-pane-tab-row.component.ts)
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
 *****************************************************************************************/

import {Component, Input, TemplateRef, ViewChild} from '@angular/core';
import {Observable} from 'rxjs';

import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';
import {BranchLayout, LayoutType} from '../pane-layout';

interface TabContext {
    idx: number;
    curr: Observable<number>;
}

@Component({
    selector: 'lib-ng-pane-tab-row',
    template: `<ng-template #tab let-idx="idx" let-curr="curr">
    <div class="tab" [class.active]="(curr | async) === idx" (click)="selectTab(idx)">tab</div>
</ng-template>
<ng-container libNgPaneRenderer></ng-container>`,
    styleUrls: ['./ng-pane-tab-row.component.scss']
})
export class NgPaneTabRowComponent {
    @ViewChild('tab', {static: true}) private tabTemplate: TemplateRef<any>;
    @ViewChild(NgPaneRendererDirective, {static: true}) private renderer: NgPaneRendererDirective;

    private _layout: BranchLayout&{type: LayoutType.Tabbed};

    @Input()
    set layout(val: BranchLayout&{type: LayoutType.Tabbed}) {
        if (this._layout === val) return;

        this._layout = val;

        if (!this._layout) return;

        this._layout.children.forEach((child, idx) => {
            this.renderer.viewContainer.createEmbeddedView(
                this.tabTemplate, {idx, curr: this._layout.$currentTabIndex});
        });
    }

    private selectTab(idx: number) { this._layout.currentTabIndex = idx; }
}
