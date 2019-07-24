/****************************************************************************
 *
 * ng-pane-manager2 - a port of ng-pane-manager to Angular 2+ (pane-layout.ts)
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
 ***************************************************************************/

import {BehaviorSubject, Observable, Subject} from 'rxjs';

export type PaneLayout = BranchLayout|LeafLayout;

export enum LayoutType {
    Horiz,
    Vert,
    Tabbed,
    Leaf,
}

export enum LayoutGravity {
    Center,
    Left,
    Right,
    Top,
    Bottom,
}

export class LayoutBase {
    constructor(public readonly gravity?: LayoutGravity, public readonly group?: string) {}
}

export interface ResizeEvent {
    readonly idx: number;
    readonly ratio: number;
}

export class BranchLayout extends LayoutBase {
    private _resizeEvents: Subject<ResizeEvent>;
    private _$currentTabIndex: BehaviorSubject<number>;
    private _ratioSum: number;

    get children(): Readonly<PaneLayout[]> { return this._children; }
    get ratios(): Readonly<number[]> { return this._ratios; }
    get currentTabIndex(): number { return this._currentTabIndex; }
    get ratioSum(): number { return this._ratioSum; }

    get resizeEvents(): Observable<ResizeEvent> { return this._resizeEvents; }
    get $currentTabIndex(): Observable<number> { return this._$currentTabIndex; }

    set currentTabIndex(val: number) {
        if (this._currentTabIndex === val) return;

        this._currentTabIndex = val;
        this._$currentTabIndex.next(val);
    }

    static split(type: LayoutType.Horiz|LayoutType.Vert,
                 children: PaneLayout[],
                 ratios: number[],
                 gravity?: LayoutGravity,
                 group?: string) {
        return new BranchLayout(type, children, ratios, undefined, gravity, group);
    }

    static tabbed(children: PaneLayout[],
                  currentIndex: number,
                  gravity?: LayoutGravity,
                  group?: string) {
        return new BranchLayout(
            LayoutType.Tabbed, children, undefined, currentIndex, gravity, group);
    }

    private constructor(public readonly type: LayoutType.Horiz|LayoutType.Vert|LayoutType.Tabbed,
                        private _children: PaneLayout[],
                        private _ratios?: number[],
                        private _currentTabIndex?: number,
                        gravity?: LayoutGravity,
                        group?: string) {
        super(gravity, group);

        if (_ratios != null) {
            this._resizeEvents = new Subject();
            this._ratioSum     = _ratios.reduce((s, e) => s + e);
        }

        if (_currentTabIndex != null)
            this._$currentTabIndex = new BehaviorSubject(_currentTabIndex);
    }

    resizeChild(idx: number, ratio: number) {
        this._ratios[idx] = ratio;

        this._ratioSum = this._ratios.reduce((s, e) => s + e);

        // TODO: send an event if ratioSum changes significantly

        this._resizeEvents.next({idx, ratio});
    }

    moveSplit(firstIdx: number, amount: number) {
        const secondIdx = firstIdx + 1;

        if (secondIdx >= this._ratios.length)
            throw new Error(`firstIdx must be less than ${this._ratios.length - 1}`);

        const clampedAmount = Math.max(-this._ratios[firstIdx],
                                       Math.min(this._ratios[secondIdx], amount));

        this._ratios[firstIdx] += clampedAmount;
        this._ratios[secondIdx] -= clampedAmount;

        this._resizeEvents.next({idx: firstIdx, ratio: this._ratios[firstIdx]});
        this._resizeEvents.next({idx: secondIdx, ratio: this._ratios[secondIdx]});
    }
}

export class LeafLayout extends LayoutBase {
    readonly type: LayoutType.Leaf = LayoutType.Leaf;
    // TODO: each pane should have control of title, icon, closeable, and alwaysTab

    constructor(public readonly id: string,
                public readonly template: string,
                gravity?: LayoutGravity,
                group?: string) {
        super(gravity, group);
    }
}

export type LayoutTemplate = BranchLayoutTemplate|LeafLayoutTemplate;

export interface LayoutTemplateBase {
    gravity?: 'center'|'left'|'right'|'top'|'bottom';
    group?: string;
}

export interface BranchLayoutTemplate extends LayoutTemplateBase {
    split: 'horiz'|'vert'|'tab';
    ratio?: number[];
    currentTab?: number;
    children: LayoutTemplate[];
}

export interface LeafLayoutTemplate extends LayoutTemplateBase {
    id: string;
    template: string;
}

export function loadLayout(template: LayoutTemplate): PaneLayout {
    let gravity: LayoutGravity;

    if (template.gravity) {
        switch (template.gravity) {
        case 'center': gravity = LayoutGravity.Center; break;
        case 'left': gravity = LayoutGravity.Left; break;
        case 'right': gravity = LayoutGravity.Right; break;
        case 'top': gravity = LayoutGravity.Top; break;
        case 'bottom': gravity = LayoutGravity.Bottom; break;
        }
    }

    if ((template as any).split) {
        const branch = template as BranchLayoutTemplate;

        let type: LayoutType.Horiz|LayoutType.Vert|LayoutType.Tabbed;

        switch (branch.split) {
        case 'horiz': type = LayoutType.Horiz; break;
        case 'vert': type = LayoutType.Vert; break;
        case 'tab': type = LayoutType.Tabbed; break;
        }

        let ratios: number[];

        if (branch.ratio) {
            switch (typeof branch.ratio) {
            case 'number': ratios = [branch.ratio]; break;
            case 'object': ratios = branch.ratio; break;
            }
        }
        else
            ratios = null;

        switch (type) {
        case LayoutType.Horiz:
        case LayoutType.Vert:
            return BranchLayout.split(type,
                                      branch.children.map(child => loadLayout(child)),
                                      ratios,
                                      gravity,
                                      branch.group);
        case LayoutType.Tabbed:
            return BranchLayout.tabbed(branch.children.map(child => loadLayout(child)),
                                       branch.currentTab,
                                       gravity,
                                       branch.group);
        }
    }
    else {
        const leaf = template as LeafLayoutTemplate;

        return new LeafLayout(leaf.id, leaf.template, gravity, leaf.group);
    }
}

export function saveLayout(layout: PaneLayout): any {
    let gravity: 'center'|'left'|'right'|'top'|'bottom';

    if (layout.gravity != null) {
        switch (layout.gravity) {
        case LayoutGravity.Center: gravity = 'center'; break;
        case LayoutGravity.Left: gravity = 'left'; break;
        case LayoutGravity.Right: gravity = 'right'; break;
        case LayoutGravity.Top: gravity = 'top'; break;
        case LayoutGravity.Bottom: gravity = 'bottom'; break;
        }
    }

    switch (layout.type) {
    case LayoutType.Horiz:
    case LayoutType.Vert:
    case LayoutType.Tabbed: {
        let split: 'horiz'|'vert'|'tab';

        switch (layout.type) {
        case LayoutType.Horiz: split = 'horiz'; break;
        case LayoutType.Vert: split = 'vert'; break;
        case LayoutType.Tabbed: split = 'tab'; break;
        }

        return <BranchLayoutTemplate>{
            split,
            ratio: layout.ratios,
            currentTab: layout.currentTabIndex,
            children: layout.children.map(child => saveLayout(child)),
            gravity,
            group: layout.group,
        };

        break;
    }
    case LayoutType.Leaf:
        return <LeafLayoutTemplate>{
            id: layout.id,
            template: layout.template,
            gravity,
            group: layout.group,
        };

        break;
    }
}
