/********************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (pane-layout.ts)
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
 *******************************************************************************/

import {BehaviorSubject, Observable, Subject} from 'rxjs';

export type PaneLayout = BranchLayout|LeafLayout;

export interface BranchChildId {
    readonly branch: BranchLayout;
    readonly index: number;
}

export const enum LayoutType {
    Horiz,
    Vert,
    Tabbed,
    Leaf,
}

export const enum LayoutGravity {
    Center,
    Left,
    Right,
    Top,
    Bottom,
}

export abstract class LayoutBase {
    constructor(readonly gravity?: LayoutGravity, readonly group?: string) {}

    // NB: this function returns undefined if nothing changed
    abstract transposeDeep(node: PaneLayout, replace: PaneLayout): PaneLayout|undefined;

    // NB: this function returns undefined if nothing changed
    abstract simplifyDeep(): PaneLayout|undefined;
}

export interface ResizeEvent {
    readonly idx: number;
    readonly ratio: number;
}

export class BranchLayout extends LayoutBase {
    private readonly _resizeEvents: Subject<ResizeEvent>|undefined;
    private readonly _$currentTabIndex: BehaviorSubject<number>|undefined;
    private _ratioSum: number|undefined;

    get children(): readonly PaneLayout[] { return this._children; }
    get ratios(): readonly number[]|undefined { return this._ratios; }
    get ratioSum(): number|undefined { return this._ratioSum; }

    get resizeEvents(): Observable<ResizeEvent>|undefined { return this._resizeEvents; }
    get $currentTabIndex(): Observable<number>|undefined { return this._$currentTabIndex; }

    get currentTabIndex(): number|undefined { return this._currentTabIndex; }

    set currentTabIndex(val: number|undefined) {
        if (this._currentTabIndex === val) return;

        if (val === undefined || val < 0 || val >= Math.max(1, this._children.length))
            throw new Error('current tab index is out of range');

        this._currentTabIndex = val;
        if (this._$currentTabIndex !== undefined) this._$currentTabIndex.next(val);
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

    private constructor(readonly         type: LayoutType.Horiz|LayoutType.Vert|LayoutType.Tabbed,
                        private readonly _children: PaneLayout[],
                        private readonly _ratios?: number[],
                        private _currentTabIndex?: number,
                        gravity?: LayoutGravity,
                        group?: string) {
        super(gravity, group);

        if (_ratios !== undefined) {
            if (_ratios.length !== _children.length)
                throw new Error('mismatched child and split ratio counts');

            if (type !== LayoutType.Tabbed && _children.length > 1) {
                for (const ratio of _ratios) {
                    if (!isFinite(ratio)) throw new Error(`invalid ratio ${ratio}`);
                }
            }

            this._resizeEvents = new Subject();
            this._ratioSum     = _ratios.reduce((s, e) => s + e, 0);

            // Apparently if the sum of a flex element's children's flex-grow
            // properties is less than 1, they just don't span the entire
            // element anymore...
            if (this._ratioSum < 1.0) {
                const sum      = this._ratioSum;
                this._ratios   = _ratios.map(r => r / sum);
                this._ratioSum = 1.0;
            }
        }

        if (_currentTabIndex !== undefined) {
            if (_currentTabIndex < 0 || _currentTabIndex >= Math.max(1, this._children.length))
                throw new Error('current tab index is out of range');

            this._$currentTabIndex = new BehaviorSubject(_currentTabIndex);
        }
    }

    resizeChild(idx: number, ratio: number) {
        if (this._ratios === undefined || this._resizeEvents === undefined)
            throw new Error('branch is not resizable');

        this._ratios[idx] = ratio;

        this._ratioSum = this._ratios.reduce((s, e) => s + e, 0);

        // TODO: send an event if ratioSum changes significantly

        this._resizeEvents.next({idx, ratio});
    }

    moveSplit(firstIdx: number, amount: number) {
        if (this._ratios === undefined || this._resizeEvents === undefined)
            throw new Error('branch is not resizable');

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
    spliceChildren(start: number|undefined,
                   remove: number,
                   addChildren?: readonly PaneLayout[],
                   addRatios?: readonly   number[],
                   changeTabTo?: number):
        {layout: PaneLayout; removed: PaneLayout[]; removedRatios?: number[]} {
        if (start === undefined) start = this._children.length;

        const newChildren = this._children.slice();
        const removed     = addChildren !== undefined
                            ? newChildren.splice(start, remove, ...addChildren)
                            : newChildren.splice(start, remove);

        let newRatios: number[]|undefined;
        let removedRatios: number[]|undefined;
        let newCurrentTabIndex = this._currentTabIndex;

        if (this._ratios !== undefined) {
            if ((addRatios !== undefined ? addRatios.length : 0) !==
                (addChildren !== undefined ? addChildren.length : 0))
                throw new Error('incorrect number of split ratios to add');

            newRatios     = this._ratios.slice();
            removedRatios = addRatios !== undefined ? newRatios.splice(start, remove, ...addRatios)
                                                    : newRatios.splice(start, remove);
        }

        if (newCurrentTabIndex !== undefined) {
            if (changeTabTo !== undefined) {
                if (changeTabTo < 0 ||
                    (addChildren === undefined || changeTabTo >= addChildren.length))
                    throw new Error('invalid value for changeTabTo');

                newCurrentTabIndex = start + changeTabTo;
            }
            else {
                newCurrentTabIndex = newCurrentTabIndex -
                                     Math.max(0, Math.min(remove, newCurrentTabIndex - start + 1));

                if (newCurrentTabIndex >= start && addChildren !== undefined)
                    newCurrentTabIndex += addChildren.length;

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

    withoutChild(index: number): {layout: PaneLayout; removed: PaneLayout; removedRatio?: number} {
        const {layout, removed, removedRatios} = this.spliceChildren(index, 1);

        return {
            layout,
            removed: removed[0],
            removedRatio: removedRatios !== undefined ? removedRatios[0] : undefined,
        };
    }

    withChild(child: PaneLayout, index?: number, ratio?: number, changeTabTo?: boolean):
        PaneLayout {
        const {
            layout,
        } = this.spliceChildren(index,
                                0,
                                [child],
                                ratio !== undefined ? [ratio] : undefined,
                                changeTabTo === true ? 0 : undefined);
        // Look, before you laugh, changeTabTo can be undefined.

        return layout;
    }

    transposeDeep(node: PaneLayout, replace: PaneLayout): PaneLayout|undefined {
        if (this === node) return replace;

        let newChildren: PaneLayout[]|undefined;

        this._children.forEach((el, idx) => {
            const transposed = el.transposeDeep(node, replace);

            if (transposed === undefined) return;
            if (newChildren === undefined) newChildren = this._children.slice();

            newChildren[idx] = transposed;
        });

        return newChildren !== undefined ? new BranchLayout(this.type,
                                                            newChildren,
                                                            this._ratios,
                                                            this._currentTabIndex,
                                                            this.gravity,
                                                            this.group)
                                         : undefined;
    }

    simplifyDeep(): PaneLayout|undefined {
        if (this._children.length === 1) {
            const child      = this._children[0];
            const simplified = child.simplifyDeep();

            return simplified !== undefined ? simplified : child;
        }

        let newChildren: (PaneLayout|PaneLayout[]|undefined)[]|undefined;
        let newRatios: (number|number[]|undefined)[]|undefined;

        this._children.forEach((el, idx) => {
            let newChild: PaneLayout|PaneLayout[]|undefined;
            let newRatio: number|number[]|undefined;

            // Let branches with 0 children remain undefined - they will be pruned
            if (el.type === LayoutType.Leaf || el._children.length !== 0) {
                const simplified = el.simplifyDeep();
                const child = newChild = simplified !== undefined ? simplified : el;

                if (this.type !== LayoutType.Tabbed) {
                    if (child.type === this.type) {
                        newChild = child._children;

                        const sum    = child.ratioSum;
                        const ratios = this._ratios;
                        // TODO: this calculation is slightly incorrect due to the
                        //       fact that the gutters between panes throw off the
                        //       actual widths ever so slightly
                        newRatio = child._ratios !== undefined && sum !== undefined &&
                                           ratios !== undefined
                                       ? child._ratios.map(r => (r / sum) * ratios[idx])
                                       : undefined;
                    }
                    else {
                        newRatio = this._ratios !== undefined ? this._ratios[idx] : undefined;
                    }
                }
            }

            if (newChild !== el) {
                if (newChildren === undefined) newChildren = this._children.slice();

                newChildren[idx] = newChild;

                if (this._ratios !== undefined) {
                    if (newRatios === undefined) newRatios = this._ratios.slice();

                    newRatios[idx] = newRatio;
                }
            }
        });

        if (newChildren !== undefined) {
            newChildren.filter(e => e !== undefined);

            let ratios = this._ratios;

            if (newRatios !== undefined) {
                newRatios.filter(e => e !== undefined);
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
    // TODO?: possibly add overrides for template pane properties

    constructor(readonly id: string,
                readonly template: string,
                gravity?: LayoutGravity,
                group?: string) {
        super(gravity, group);
    }

    transposeDeep(node: PaneLayout, replace: PaneLayout): PaneLayout|undefined {
        return this === node ? replace : undefined;
    }

    simplifyDeep(): PaneLayout|undefined { return undefined; }
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
    let gravity: LayoutGravity|undefined;

    if (template.gravity !== undefined) {
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
        default: throw new Error(`invalid split type '${branch.split}'`);
        }

        let ratios: number[]|undefined;

        switch (typeof branch.ratio) {
        case 'undefined': ratios = undefined; break;
        case 'number': ratios = [branch.ratio]; break;
        case 'object': ratios = branch.ratio; break;
        default:
            throw new Error(
                `invalid type '${typeof branch.ratio}': expected number, array, or nothing`);
        }

        switch (type) {
        case LayoutType.Horiz:
        case LayoutType.Vert:
            if (ratios === undefined)
                throw new Error(`missing ratios for '${branch.split}' branch`);

            return BranchLayout.split(
                type, branch.children.map(loadLayout), ratios, gravity, branch.group);
        case LayoutType.Tabbed:
            if (branch.currentTab === undefined)
                throw new Error(`missing currentTab for '${branch.split}' branch`);

            return BranchLayout.tabbed(branch.children.map(loadLayout),
                                       branch.currentTab,
                                       gravity,
                                       branch.group);
        default: throw new Error('unexpected branch layout type');
        }
    }
    else {
        const leaf = template as LeafLayoutTemplate;

        return new LeafLayout(leaf.id, leaf.template, gravity, leaf.group);
    }
}

export function saveLayout(layout: PaneLayout): LayoutTemplate {
    let gravity: 'center'|'left'|'right'|'top'|'bottom'|undefined;

    if (layout.gravity !== undefined) {
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
        default: throw new Error('unexpected layout type');
        }

        return {
            split,
            ratio: layout.ratios !== undefined ? layout.ratios.slice() : undefined,
            currentTab: layout.currentTabIndex,
            children: layout.children.map(saveLayout),
            gravity,
            group: layout.group,
        };
    }
    case LayoutType.Leaf:
        return {
            id: layout.id,
            template: layout.template,
            gravity,
            group: layout.group,
        };
    }
}
