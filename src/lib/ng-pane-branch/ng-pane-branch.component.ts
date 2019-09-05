/*********************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-branch.component.ts)
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

import {
    Component,
    ElementRef,
    HostBinding,
    Input,
    OnDestroy,
    ViewChild,
    ViewRef,
} from '@angular/core';
import {Subscription} from 'rxjs';

import {LayoutNodeFactory} from '../layout-node-factory';
import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';
import {NgPaneSlotComponent} from '../ng-pane-slot/ng-pane-slot.component';
import {BranchChildId, BranchLayout, LayoutType} from '../pane-layout';

@Component({
    selector: 'lib-ng-pane-branch',
    template: '<ng-container libNgPaneRenderer></ng-container>',
    styleUrls: ['./ng-pane-branch.component.scss'],
})
export class NgPaneBranchComponent implements OnDestroy {
    @ViewChild(NgPaneRendererDirective, {static: true})
    private readonly renderer!: NgPaneRendererDirective;

    private _layout: BranchLayout|undefined;
    private layoutSub: Subscription|undefined;
    @Input() factory!: LayoutNodeFactory;
    @Input() childId: BranchChildId|undefined;

    @HostBinding('class.horiz')
    get horiz() {
        return this._layout !== undefined && this._layout.type === LayoutType.Horiz;
    }

    @HostBinding('class.vert')
    get vert() {
        return this._layout !== undefined && this._layout.type === LayoutType.Vert;
    }

    @HostBinding('class.tab')
    get tab() {
        return this._layout !== undefined && this._layout.type === LayoutType.Tabbed;
    }

    @Input()
    set layout(val: BranchLayout|undefined) {
        if (this._layout === val) return;

        if (this.layoutSub !== undefined) {
            this.layoutSub.unsubscribe();
            this.layoutSub = undefined;
        }

        this._layout = val;

        const oldViews: ViewRef[] = [];
        while (true) {
            const view = this.renderer.viewContainer.detach();
            if (view === null) break;
            oldViews.push(view);
        }

        if (this._layout !== undefined) {
            const layout                       = this._layout;
            const slots: NgPaneSlotComponent[] = [];

            if (layout.type === LayoutType.Tabbed) {
                // I'm disappointed type inference didn't figure this one out, it's
                // done some impressive things before...
                this.factory.placeTabRow(this.renderer.viewContainer,
                                         layout as BranchLayout & {type: LayoutType.Tabbed},
                                         this.childId);
            }

            layout.children.forEach((child, index) => {
                if (index !== 0 && layout.type !== LayoutType.Tabbed)
                    this.factory.placeBranchThumb(this.renderer.viewContainer,
                                                  this.el,
                                                  index - 1,
                                                  layout);

                slots.push(this.factory.placeSlotForLayout(this.renderer.viewContainer,
                                                           {branch: layout, index}));
            });

            if (layout.type === LayoutType.Tabbed) {
                let lastIdx = layout.currentTabIndex === undefined ? -1 : layout.currentTabIndex;

                this.layoutSub = layout.$currentTabIndex !== undefined
                                     ? layout.$currentTabIndex.subscribe(idx => {
                                           if (idx === lastIdx) return;

                                           slots[lastIdx].isHidden = true;
                                           slots[idx].isHidden     = false;

                                           lastIdx = idx;
                                       })
                                     : undefined;
            }
            else {
                this.layoutSub = layout.resizeEvents !== undefined
                                     ? layout.resizeEvents.subscribe(
                                           evt => slots[evt.idx].ratio = evt.ratio)
                                     : undefined;
            }
        }

        oldViews.forEach(e => e.destroy());
    }

    get layout(): BranchLayout|undefined { return this._layout; }

    constructor(public el: ElementRef<HTMLElement>) {}

    ngOnDestroy() { this.layout = undefined; }
}
