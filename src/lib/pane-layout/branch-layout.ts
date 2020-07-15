/**********************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (branch-layout.ts)
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
 *********************************************************************************/

import {BehaviorSubject, Observable, Subject} from 'rxjs';

import {LayoutBase} from './layout-base';
import {
    ChildLayout,
    ChildLayoutId,
    LayoutGravity,
    LayoutType,
    PaneLayout,
    RootLayout,
} from './layout-core';

/**
 * Base class for all branch layouts
 */
export abstract class BranchLayoutBase<T extends PaneLayout> extends LayoutBase {
    /**
     * Construct a new branch layout node.
     * @param children the children of this layout node
     * @param gravity the gravity of this layout node
     * @param group the group of this layout node
     */
    public constructor(public readonly children: readonly ChildLayout[],
                       gravity: LayoutGravity|undefined,
                       group: string|undefined) {
        super(gravity, group);
    }

    /**
     * Construct a clone of the current node with a new list of children
     * @param newChildren the children to construct the clone with
     */
    protected abstract withChildren(newChildren: ChildLayout[]): T;

    /**
     * Map the children of the current node to a new node using the given
     * function.
     * @param func function to map each child with
     */
    public mapChildren(func: (value: ChildLayout, index: number) => ChildLayout): T {
        return this.withChildren(this.children.map(func));
    }

    /**
     * Map a single child of the current node to a new node using the given
     * function.
     * @param index index of the child to map
     * @param func function to map the child with
     */
    public mapChild(index: number, func: (value: ChildLayout) => ChildLayout): T {
        return this.mapChildren((e, i) => i === index ? func(e) : e);
    }

    /**
     * Find any occurrences (by reference) of a node in the current tree and
     * replace them with another node.
     * @param find the node to search for
     * @param replace the note to replace the search node with
     */
    public transposeDeep(find: PaneLayout, replace: PaneLayout): PaneLayout|undefined {
        if (this as any === find) { return replace; }

        let newChildren: ChildLayout[]|undefined;

        this.children.forEach((child, idx) => {
            const newChild = child.transposeDeep(find, replace);

            if (newChild === undefined) { return; }

            if (newChild.type === LayoutType.Root) {
                throw new Error('invalid transposition - child attempted to become root');
            }

            if (newChildren === undefined) { newChildren = this.children.slice(); }

            newChildren[idx] = newChild;
        });

        return newChildren !== undefined ? this.withChildren(newChildren) : undefined;
    }
}

/** A `ChildLayout` that can contain children */
export type BranchLayout = SplitLayout|TabbedLayout;

// TODO: there's some pretty heavy code duplication between the two
//       implementations below, but I can't think of a clean way to abstract the
//       repeated part.

/** A resize event for a split branch node. */
export interface ResizeEvent {
    /** The index of the resized child */
    readonly index: number;
    /** The ratio of the resized child */
    readonly ratio: number;
}

/**
 * A layout with its children stacked horizontally or vertically
 */
export class SplitLayout extends BranchLayoutBase<SplitLayout> {
    /** See `resizeEvents` */
    private readonly _resizeEvents: Subject<ResizeEvent> = new Subject();
    /** See `ratioSum` */
    private _ratioSum: number;

    /** The ratios of the widths of the child nodes */
    public get ratios(): readonly number[] { return this._ratios; }
    /** The sum of all child width ratios */
    public get ratioSum(): number { return this._ratioSum; }

    /** A stream of resize events, notifying when the ratio of a child changes */
    public get resizeEvents(): Observable<ResizeEvent> { return this._resizeEvents; }

    // NOTE: TypeScript hates this, edit with caution.
    /**
     * Flatten an array non-recursively.  Used below.
     * @param arr the array to flatten
     */
    private static flatten<T>(arr: (T|readonly T[]|undefined)[]): T[] {
        return arr.filter(e => e !== undefined)
                   .reduce((l, r) => (l as T[]).concat(r as T | readonly T[]), []) as T[];
    }

    /**
     * Construct a new split branch node.
     * @param type the type of the split
     * @param children the children of the node
     * @param _ratios the ratio of each child node
     * @param gravity the gravity of the split node
     * @param group the group of the split node
     */
    public constructor(public readonly    type: LayoutType.Horiz|LayoutType.Vert,
                       children: readonly ChildLayout[],
                       private readonly   _ratios: number[],
                       gravity?: LayoutGravity,
                       group?: string) {
        super(children, gravity, group);

        if (_ratios.length !== children.length) {
            throw new Error(`mismatched child and split ratio counts (${children.length} vs ${
                _ratios.length})`);
        }

        for (const ratio of _ratios) {
            if (!isFinite(ratio)) { throw new Error(`invalid ratio ${ratio}`); }
        }

        this._ratioSum = _ratios.reduce((s, e) => s + e, 0);

        // This fixes a quirk with the flex layout system where a sum weight
        // less than 1.0 causes elements not to fill all available space.
        if (this._ratioSum < 1) {
            const sum      = this._ratioSum;
            this._ratios   = _ratios.map(r => r / sum);
            this._ratioSum = 1;
        }
    }

    /** See `BranchLayoutBase.withChildren` */
    protected withChildren(newChildren: ChildLayout[]): SplitLayout {
        return new SplitLayout(this.type, newChildren, this._ratios, this.gravity, this.group);
    }

    /**
     * Construct a child ID referencing a child of this node.
     * @param index the index of the child ID
     */
    public childId(index: number): ChildLayoutId { return {stem: this, index}; }

    /**
     * Convert this node into a root node.
     */
    public intoRoot(): RootLayout { return new RootLayout(this); }

    /**
     * Change the ratio of a single child.
     * @param index the index of the child to resize
     * @param ratio the ratio to resize the child to
     */
    public resizeChild(index: number, ratio: number): void {
        if (index >= this._ratios.length) {
            throw new Error(`index must be less than ${this._ratios.length}`);
        }

        const oldRatio      = this._ratios[index];
        this._ratios[index] = ratio;

        this._ratioSum += ratio - oldRatio;

        // TODO: should an event be sent to all other children, since changing
        //       the sum ratio implicitly changes the size of all children?

        this._resizeEvents.next({index, ratio});
    }

    /**
     * Move the split between two children, adjusting both their ratios
     * accordingly.
     * @param firstIdx the index of the first child neighborind this split
     * @param amount the quantity to shift the child ratios by
     */
    public moveSplit(firstIdx: number, amount: number): void {
        const secondIdx = firstIdx + 1;


        if (secondIdx >= this._ratios.length) {
            throw new Error(`firstIdx must be less than ${this._ratios.length - 1}`);
        }

        const clampedAmount = Math.max(-this._ratios[firstIdx],
                                       Math.min(this._ratios[secondIdx], amount));

        this._ratios[firstIdx] += clampedAmount;
        this._ratios[secondIdx] -= clampedAmount;

        this._resizeEvents.next({index: firstIdx, ratio: this._ratios[firstIdx]});
        this._resizeEvents.next({index: secondIdx, ratio: this._ratios[secondIdx]});
    }

    /**
     * Splice the list of children.  See `Array.prototype.splice` for more
     * information.
     * @param start the index to begin at, or `undefined` for the end of the list
     * @param remove the number of children to remove
     * @param addChildren the list of children to add
     * @param addRatios the list of ratios to add
     */
    public spliceChildren(start: number|undefined,
                          remove: number,
                          addChildren?: readonly ChildLayout[],
                          addRatios?: readonly   number[]): {
        /** The resulting layout */
        layout: SplitLayout;
        /** The removed children */
        removed: ChildLayout[];
        /** The ratios of the removed children */
        removedRatios: number[];
    } {
        const idx = start === undefined ? this.children.length : start;

        const newChildren = this.children.slice();
        const removed = addChildren !== undefined ? newChildren.splice(idx, remove, ...addChildren)
                                                  : newChildren.splice(idx, remove);

        if ((addRatios !== undefined ? addRatios.length : 0) !==
            (addChildren !== undefined ? addChildren.length : 0)) {
            throw new Error('mismatched lengths of addChildren and addRatios');
        }

        const newRatios     = this._ratios.slice();
        const removedRatios = addRatios !== undefined ? newRatios.splice(idx, remove, ...addRatios)
                                                      : newRatios.splice(idx, remove);

        return {
            layout: new SplitLayout(this.type, newChildren, newRatios, this.gravity, this.group),
            removed,
            removedRatios,
        };
    }

    /**
     * Remove the child at the given index from the list of children.
     * @param index the index of the child to remove, or `undefined` for the end
     *              of the list
     */
    public withoutChild(index: number|undefined): {
        /** The resulting layout */
        layout: SplitLayout;
        /** The removed child */
        removed: ChildLayout;
        /** The ratio of the removed child */
        removedRatio: number;
    } {
        const {layout, removed, removedRatios} = this.spliceChildren(index, 1);

        return {layout, removed: removed[0], removedRatio: removedRatios[0]};
    }

    /**
     * Insert a child at the given index.
     * @param index the index to insert the child at, or `undefined` for the end
     *              of the list
     * @param child the child to add
     * @param ratio the ratio of the child
     */
    public withChild(index: number|undefined, child: ChildLayout, ratio: number): SplitLayout {
        const {layout} = this.spliceChildren(index, 0, [child], [ratio]);

        return layout;
    }

    /**
     * Recursively simplify this node tree.
     */
    public simplifyDeep(): PaneLayout|undefined {
        if (this.children.length === 1) {
            const child      = this.children[0];
            const simplified = child.simplifyDeep();

            return simplified !== undefined ? simplified : child;
        }

        let newChildren: (ChildLayout|readonly ChildLayout[]|undefined)[]|undefined;
        let newRatios: (number|readonly number[]|undefined)[]|undefined;

        this.children.forEach((child, idx) => {
            let newChild: ChildLayout|readonly ChildLayout[]|undefined;
            let newRatio: number|readonly number[]|undefined;

            // Branches with no children will skip this block, leaving newChild
            // to be undefined.
            if (child.type === LayoutType.Leaf || child.children.length !== 0) {
                const simplified = child.simplifyDeep();

                if (simplified !== undefined && simplified.type === LayoutType.Root) {
                    throw new Error('invalid simplification - child attempted to become root');
                }

                const next = newChild = simplified !== undefined ? simplified : child;

                if (next.type === this.type) {
                    newChild = next.children;

                    const sum    = next._ratioSum;
                    const ratios = this._ratios;

                    newRatio = next._ratios.map(r => (r / sum) * ratios[idx]);
                }
                else {
                    newRatio = this._ratios[idx];
                }
            }

            if (newChild !== child) {
                if (newChildren === undefined) { newChildren = this.children.slice(); }
                if (newRatios === undefined) { newRatios = this._ratios.slice(); }

                newChildren[idx] = newChild;
                newRatios[idx]   = newRatio;
            }
        });

        return newChildren !== undefined
                   ? new SplitLayout(this.type,
                                     SplitLayout.flatten(newChildren),
                                     newRatios !== undefined ? SplitLayout.flatten(newRatios)
                                                             : this._ratios,
                                     this.gravity,
                                     this.group)
                   : undefined;
    }
}

/**
 * A layout with its children placed in tabs
 */
export class TabbedLayout extends BranchLayoutBase<TabbedLayout> {
    /** See `$currentTab` */
    private readonly _$currentTab: BehaviorSubject<number> = new BehaviorSubject(-1);

    /** The type of the layout.  Used for type checking. */
    public readonly type: LayoutType.Tabbed = LayoutType.Tabbed;

    /** A stream of current tab events, notifying when the selected tab changes */
    public get $currentTab(): Observable<number> { return this._$currentTab; }
    /** The current value of `$currentTab` */
    public get currentTab(): number { return this._$currentTab.value; }

    /** Change the current tab, sending an update event */
    public set currentTab(val: number) {
        if (this._$currentTab.value === val) { return; }

        if (val < 0 || val >= Math.max(1, this.children.length)) {
            throw new Error(`currentTab index ${val} is out of range`);
        }

        this._$currentTab.next(val);
    }

    /**
     * Construct a new tabbed branch node.
     * @param children the children of the node
     * @param currentTab the currently selected child
     * @param gravity the gravity of the tabbed node
     * @param group the group of the tabbed node
     */
    public constructor(children: readonly ChildLayout[],
                       currentTab: number,
                       gravity?: LayoutGravity,
                       group?: string) {
        super(children, gravity, group);

        this.currentTab = currentTab;
    }


    /** See `BranchLayoutBase.withChildren` */
    protected withChildren(newChildren: ChildLayout[]): TabbedLayout {
        return new TabbedLayout(newChildren, this.currentTab, this.gravity, this.group);
    }

    /**
     * Construct a child ID referencing a child of this node.
     * @param index the index of the child ID
     */
    public childId(index: number): ChildLayoutId { return {stem: this, index}; }

    /**
     * convert this node into a root node.
     */
    public intoRoot(): RootLayout { return new RootLayout(this); }

    /**
     * Splice the list of children.  See `Array.prototype.splice` for more
     * information.
     * @param start the index to begin at, or `undefined` for the end of the list
     * @param remove the number of children to remove
     * @param addChildren the list of children to add
     * @param changeTabTo the index of an added child to switch to
     */
    public spliceChildren(start: number|undefined,
                          remove: number,
                          addChildren?: readonly ChildLayout[],
                          changeTabTo?: number): {
        /** The resulting layout */
        layout: TabbedLayout;
        /** The removed children */
        removed: ChildLayout[];
    } {
        const idx = start === undefined ? this.children.length : start;

        const newChildren = this.children.slice();
        const removed = addChildren !== undefined ? newChildren.splice(idx, remove, ...addChildren)
                                                  : newChildren.splice(idx, remove);

        let newCurrentTab = this.currentTab;

        if (changeTabTo !== undefined) {
            if (changeTabTo < 0 ||
                (addChildren === undefined || changeTabTo >= addChildren.length)) {
                throw new Error('invalid value for changeTabTo');
            }

            newCurrentTab = idx + changeTabTo;
        }
        else {
            newCurrentTab -= Math.max(0, Math.min(remove, newCurrentTab - idx + 1));

            if (newCurrentTab >= idx && addChildren !== undefined) {
                newCurrentTab += addChildren.length;
            }
        }

        return {
            layout: new TabbedLayout(newChildren, newCurrentTab, this.gravity, this.group),
            removed,
        };
    }

    /**
     * Remove the child at the given index from the list of children.
     * @param index the index of the child to remove, or `undefined` for the end
     *              of the list
     */
    public withoutChild(index: number|undefined): {
        /** The resulting layout */
        layout: TabbedLayout;
        /** The removed child */
        removed: ChildLayout;
    } {
        const {layout, removed} = this.spliceChildren(index, 1);

        return {
            layout,
            removed: removed[0],
        };
    }

    /**
     * Insert a child at the given index.
     * @param index the index to insert the child at, or `undefined` for the end
     *              of the list
     * @param child the child to add
     * @param changeTabTo change the current tab to the added child
     */
    public withChild(index: number|undefined, child: ChildLayout, changeTabTo: boolean):
        TabbedLayout {
        const {layout} = this.spliceChildren(index, 0, [child], changeTabTo ? 0 : undefined);

        return layout;
    }

    /**
     * Recursively simplify this node tree.
     */
    public simplifyDeep(): PaneLayout|undefined {
        if (this.children.length === 1) {
            const child      = this.children[0];
            const simplified = child.simplifyDeep();

            return simplified !== undefined ? simplified : child;
        }

        let newChildren: (ChildLayout|undefined)[]|undefined;

        this.children.forEach((child, idx) => {
            let newChild;

            // Branches with no children will skip this block, leaving newChild
            // to be undefined.
            if (child.type === LayoutType.Leaf || child.children.length !== 0) {
                const simplified = child.simplifyDeep();

                if (simplified !== undefined && simplified.type === LayoutType.Root) {
                    throw new Error('invalid simplification - child attempted to become root');
                }

                newChild = simplified !== undefined ? simplified : child;
            }

            if (newChild !== child) {
                if (newChildren === undefined) { newChildren = this.children.slice(); }

                newChildren[idx] = newChild;
            }
        });

        return newChildren !== undefined
                   ? new TabbedLayout(newChildren.filter(c => c !== undefined) as ChildLayout[],
                                      this.currentTab,
                                      this.gravity,
                                      this.group)
                   : undefined;
    }
}
