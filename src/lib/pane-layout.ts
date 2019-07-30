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

export abstract class LayoutBase {
    constructor(public readonly gravity?: LayoutGravity, public readonly group?: string) {}

    // NB: this function returns undefined if nothing changed
    abstract transposeDeep(node: PaneLayout, replace: PaneLayout): PaneLayout;

    // NB: this function returns undefined if nothing changed
    abstract simplifyDeep(): PaneLayout;
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

        if (val < 0 || val >= Math.max(1, this._children.length))
            throw new Error('current tab index is out of range');

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

        if (_ratios != undefined) {
            if (_ratios.length != _children.length)
                throw new Error('mismatched child and split ratio counts');

            this._resizeEvents = new Subject();
            this._ratioSum     = _ratios.reduce((s, e) => s + e, 0);

            // Apparently if the sum of a flex element's children's flex-grow
            // properties is less than 1, they just don't span the entire
            // element anymore...
            if (this._ratioSum < 1.0) {
                this._ratios   = _ratios.map(r => r / this._ratioSum);
                this._ratioSum = 1.0;
            }
        }

        if (_currentTabIndex != undefined) {
            if (_currentTabIndex < 0 || _currentTabIndex >= Math.max(1, this._children.length))
                throw new Error('current tab index is out of range');

            this._$currentTabIndex = new BehaviorSubject(_currentTabIndex);
        }
    }

    resizeChild(idx: number, ratio: number) {
        this._ratios[idx] = ratio;

        this._ratioSum = this._ratios.reduce((s, e) => s + e, 0);

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

    mapChildren(func: (value: PaneLayout, index: number) => PaneLayout): BranchLayout {
        return new BranchLayout(this.type,
                                this._children.map(func),
                                this._ratios,
                                this._currentTabIndex,
                                this.gravity,
                                this.group);
    }

    mapChild(idx: number, func: (value: PaneLayout) => PaneLayout): BranchLayout {
        // We need to make a shallow copy of the array anyway, so it's not much
        // slower to just do this.
        return this.mapChildren((e, i) => i === idx ? func(e) : e);
    }

    // NB: changeTabTo should be an index within addChildren
    spliceChildren(start: number,
                   remove: number,
                   addChildren?: readonly PaneLayout[],
                   addRatios?: readonly   number[],
                   changeTabTo?: number):
        {layout: PaneLayout, removed: PaneLayout[], removedRatios?: number[]} {
        if (start == undefined) start = this._children.length;

        const newChildren = this._children.slice();
        const removed     = addChildren ? newChildren.splice(start, remove, ...addChildren)
                                    : newChildren.splice(start, remove);

        let newRatios: number[]     = undefined;
        let removedRatios: number[] = undefined;
        let newCurrentTabIndex      = this._currentTabIndex;

        if (this._ratios) {
            if ((addRatios ? addRatios.length : 0) !== (addChildren ? addChildren.length : 0))
                throw new Error('incorrect number of split ratios to add');

            newRatios     = this._ratios.slice();
            removedRatios = addRatios ? newRatios.splice(start, remove, ...addRatios)
                                      : newRatios.splice(start, remove);
        }

        if (newCurrentTabIndex != undefined) {
            if (changeTabTo != undefined) {
                if (changeTabTo < 0 || changeTabTo >= addChildren.length)
                    throw new Error('invalid value for changeTabTo');

                newCurrentTabIndex = start + changeTabTo;
            }
            else {
                newCurrentTabIndex = newCurrentTabIndex -
                                     Math.max(0, Math.min(remove, newCurrentTabIndex - start + 1));

                if (newCurrentTabIndex >= start) newCurrentTabIndex += addChildren.length;

                newCurrentTabIndex = Math.max(0,
                                              Math.min(newChildren.length - 1, newCurrentTabIndex));
            }
        }

        return {
            layout: new BranchLayout(
                this.type, newChildren, newRatios, newCurrentTabIndex, this.gravity, this.group),
            removed,
            removedRatios,
        };
    }

    withoutChild(index: number): {layout: PaneLayout, removed: PaneLayout, removedRatio?: number} {
        const {layout, removed, removedRatios} = this.spliceChildren(index, 1);

        return {layout, removed: removed[0], removedRatio: removedRatios && removedRatios[0]};
    }

    withChild(child: PaneLayout, index?: number, ratio?: number, changeTabTo?: boolean):
        PaneLayout {
        const {
            layout,
        } = this.spliceChildren(index,
                                0,
                                [child],
                                ratio != undefined ? [ratio] : undefined,
                                changeTabTo ? 0 : undefined);

        return layout;
    }

    transposeDeep(node: PaneLayout, replace: PaneLayout): PaneLayout {
        if (this === node) return replace;

        let newChildren: PaneLayout[];

        this._children.forEach((el, idx) => {
            const transposed = el.transposeDeep(node, replace);

            if (!transposed) return;
            if (!newChildren) newChildren = this._children.slice();

            newChildren[idx] = transposed;
        });

        return newChildren ? new BranchLayout(this.type,
                                              newChildren,
                                              this._ratios,
                                              this._currentTabIndex,
                                              this.gravity,
                                              this.group)
                           : undefined;
    }

    simplifyDeep(): PaneLayout {
        if (this._children.length === 1) {
            const child = this._children[0];

            return child.simplifyDeep() || child;
        }

        let newChildren: (PaneLayout|PaneLayout[])[];
        let newRatios: (number|number[])[];

        this._children.forEach((el, idx) => {
            let newChild: PaneLayout|PaneLayout[] = undefined;
            let newRatio: number|number[]         = undefined;

            if (el.type !== LayoutType.Leaf && el._children.length === 0)
                newChild = undefined;
            else {
                newChild = el.simplifyDeep();

                const child = newChild || el;

                if (this.type !== LayoutType.Tabbed && child.type === this.type) {
                    newChild = child._children;
                    // TODO: this calculation is slightly incorrect due to the
                    //       fact that the gutters between panes throw off the
                    //       actual widths ever so slightly
                    newRatio = child._ratios.map(r => (r / child.ratioSum) * this._ratios[idx]);
                }
            }

            if (newChild !== undefined) {
                if (!newChildren) newChildren = this._children.slice();

                newChildren[idx] = newChild;
            }

            if (newRatio !== undefined) {
                if (!newRatios) newRatios = this._ratios.slice();

                newRatios[idx] = newRatio;
            }
        });

        if (newChildren) {
            newChildren.filter(e => e);

            let ratios = this._ratios;

            if (newRatios) {
                newRatios.filter(e => e != undefined);
                ratios = (newRatios as any).flat();
            }

            return new BranchLayout(this.type,
                                    (newChildren as any).flat(),
                                    ratios,
                                    this._currentTabIndex,
                                    this.gravity,
                                    this.group);
        }

        return undefined;
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

    transposeDeep(node: PaneLayout, replace: PaneLayout): PaneLayout {
        return this === node ? replace : undefined;
    }

    simplifyDeep(): PaneLayout { return undefined; }
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
            ratios = undefined;

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

    if (layout.gravity != undefined) {
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
