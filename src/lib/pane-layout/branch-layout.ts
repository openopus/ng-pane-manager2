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

import {EPSILON} from '../util';

import {ChildLayoutBase, LayoutGravity, LayoutType} from './layout-base';
import {
    ChildLayout,
    PaneLayout,
    RootLayout,
} from './layout-core';
import {ChildLayoutId} from './layout-util';

/**
 * Base class for all branch layouts
 */
export abstract class BranchLayoutBase<X, S extends PaneLayout<X>> extends ChildLayoutBase<X> {
    /**
     * Construct a new branch layout node.
     * @param children the children of this layout node
     * @param gravity the gravity of this layout node
     * @param group the group of this layout node
     */
    public constructor(public readonly children: readonly ChildLayout<X>[],
                       gravity: LayoutGravity|undefined,
                       group: string|undefined) {
        super(gravity, group);
    }

    /**
     * If this represents an empty container, place the given child into it.
     * @param child the child to place
     */
    protected tryEmplaceEmpty(child: ChildLayout<X>): PaneLayout<X>|undefined {
        if (this.children.length === 0) { return this.withChildren([child]); }

        return undefined;
    }

    /**
     * Construct a clone of the current node with a new list of children
     * @param newChildren the children to construct the clone with
     */
    protected abstract withChildren(newChildren: ChildLayout<X>[]): S;

    /**
     * Construct a child ID referencing a child of this node.
     * @param index the index of the child ID
     */
    public abstract childId(index: number): ChildLayoutId<X>;

    /**
     * Returns an index to insert a child at such that it will be placed after
     * the panes occurring before it in `order` and after the ones occurring
     * before.  Returns undefined if no ordering could be determined.
     * @param child the child in order array to calculate an index for
     * @param order the intended ordering of panes around child
     */
    public locateChild(child: ChildLayout<X>, order: (PaneLayout<X>|undefined)[]): number
        |undefined {
        const indices = new Map<any, number>();

        for (let i = 0; i < this.children.length; i += 1) { indices.set(this.children[i], i); }

        const idxOrder = order.map(c => indices.get(c));
        const childIdx = order.indexOf(child);
        let before     = -1; // The last child listed before pane in order
        let after      = -1; // The first child listed after pane in order

        for (let i = childIdx - 1; i >= 0; i -= 1) {
            const idx = idxOrder[i];

            if (idx !== undefined) {
                before = idx;
                break;
            }
        }

        for (let i = childIdx + 1; i < idxOrder.length; i += 1) {
            const idx = idxOrder[i];

            if (idx !== undefined) {
                after = idx;
                break;
            }
        }

        if (before === -1) {
            if (after === -1) { return undefined; }

            return after;
        }

        before += 1;

        if (after === -1) { return before; }

        return Math.floor((before + after) / 2);
    }

    /**
     * Find a child matching the given predicate.
     * @param pred predicate to match elements against
     */
    public findChild(pred: (c: ChildLayout<X>) => boolean): ChildLayoutId<X>|undefined {
        for (let i = 0; i < this.children.length; i += 1) {
            if (pred(this.children[i])) { return this.childId(i); }
        }

        for (const child of this.children) {
            const id = child.findChild(pred);

            if (id !== undefined) { return id; }
        }

        return undefined;
    }

    /**
     * Map the children of the current node to a new node using the given
     * function.
     * @param func function to map each child with
     */
    public mapChildren(func: (value: ChildLayout<X>, index: number) => ChildLayout<X>): S {
        return this.withChildren(this.children.map(func));
    }

    /**
     * Map a single child of the current node to a new node using the given
     * function.
     * @param index index of the child to map
     * @param func function to map the child with
     */
    public mapChild(index: number, func: (value: ChildLayout<X>) => ChildLayout<X>): S {
        return this.mapChildren((e, i) => i === index ? func(e) : e);
    }

    /**
     * Find any occurrences (by reference) of a node in the current tree and
     * replace them with another node.
     * @param find the node to search for
     * @param replace the note to replace the search node with
     */
    public transposeDeep(find: PaneLayout<X>, replace: PaneLayout<X>): PaneLayout<X>|undefined {
        if (Object.is(this, find)) { return replace; }

        let newChildren: ChildLayout<X>[]|undefined;

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
export type BranchLayout<X> = SplitLayout<X>|TabbedLayout<X>;

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
export class SplitLayout<X> extends BranchLayoutBase<X, SplitLayout<X>> {
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
     * @param fixTiny whether to normalize all ratios if the sum is too small
     */
    public constructor(public readonly    type: LayoutType.Horiz|LayoutType.Vert,
                       children: readonly ChildLayout<X>[],
                       private readonly   _ratios: number[],
                       gravity?: LayoutGravity,
                       group?: string,
                       fixTiny?: boolean) {
        super(children, gravity, group);

        if (_ratios.length !== children.length) {
            throw new Error(`mismatched child and split ratio counts (${children.length} vs ${
                _ratios.length})`);
        }

        for (const ratio of _ratios) {
            if (!isFinite(ratio)) { throw new Error(`invalid ratio ${ratio}`); }
        }

        this._ratioSum = _ratios.reduce((s, e) => s + e, 0);

        if (this.children.length > 0 && this._ratioSum < EPSILON) {
            if (fixTiny === true) {
                for (let i = 0; i < this._ratios.length; i += 1) { this._ratios[i] = 1; }

                this._ratioSum = this._ratios.length;
            }
            else {
                throw new Error('ratios for split layout are too small');
            }
        }

        // This fixes a quirk with the flex layout system where a sum weight
        // less than 1.0 causes elements not to fill all available space.
        if (this._ratioSum < 1) {
            const sum      = this._ratioSum;
            this._ratios   = _ratios.map(r => r / sum);
            this._ratioSum = 1;
        }
    }

    /** See `BranchLayoutBase.withChildren` */
    protected withChildren(newChildren: ChildLayout<X>[]): SplitLayout<X> {
        return new SplitLayout(this.type, newChildren, this._ratios, this.gravity, this.group);
    }

    /**
     * Construct a child ID referencing a child of this node.
     * @param index the index of the child ID
     */
    public childId(index: number): ChildLayoutId<X> { return {stem: this, index}; }

    /**
     * Convert this node into a root node.
     */
    public intoRoot(): RootLayout<X> { return new RootLayout(this); }

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
                          addChildren?: readonly ChildLayout<X>[],
                          addRatios?: readonly   number[]): {
        /** The resulting layout */
        layout: SplitLayout<X>;
        /** The removed children */
        removed: ChildLayout<X>[];
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
            layout:
                new SplitLayout(this.type, newChildren, newRatios, this.gravity, this.group, true),
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
        layout: SplitLayout<X>;
        /** The removed child */
        removed: ChildLayout<X>;
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
    public withChild(index: number|undefined, child: ChildLayout<X>, ratio: number):
        SplitLayout<X> {
        const {layout} = this.spliceChildren(index, 0, [child], [ratio]);

        return layout;
    }

    /**
     * Recursively simplify this node tree.
     */
    public simplifyDeep(): PaneLayout<X>|undefined {
        let newChildren: (ChildLayout<X>|readonly ChildLayout<X>[]|undefined)[]|undefined;
        let newRatios: (number|readonly number[]|undefined)[]|undefined;

        this.children.forEach((child, idx) => {
            let newChild: ChildLayout<X>|readonly ChildLayout<X>[]|undefined;
            let newRatio: number|readonly number[]|undefined;

            const simplified = child.simplifyDeep();

            if (simplified !== undefined && simplified.type === LayoutType.Root) {
                throw new Error('invalid simplification - child attempted to become root');
            }

            const next = simplified !== undefined ? simplified : child;

            // Branches with no children will skip this block, leaving newChild
            // to be undefined.
            if (next.type === LayoutType.Leaf || next.children.length !== 0) {
                newChild = next;

                if (next.type === this.type) {
                    newChild = next.children;

                    const sum    = next._ratioSum;
                    const ratios = this._ratios;

                    // TODO: this calculation needs to be corrected to account
                    //       for the widths of the split thumbs
                    newRatio = next._ratios.map(r => (r / sum) * ratios[idx]);
                }
                else {
                    newRatio = this._ratios[idx];
                }
            }

            if (!Object.is(newChild, child)) {
                if (newChildren === undefined) { newChildren = this.children.slice(); }
                if (newRatios === undefined) { newRatios = this._ratios.slice(); }

                newChildren[idx] = newChild;
                newRatios[idx]   = newRatio;
            }
        });

        if (newChildren === undefined) {
            if (this.children.length === 1) { return this.children[0]; }

            return undefined;
        }

        const flatChildren = SplitLayout.flatten(newChildren);

        if (flatChildren.length === 1) { return flatChildren[0]; }

        return new SplitLayout(this.type,
                               flatChildren,
                               newRatios !== undefined ? SplitLayout.flatten(newRatios)
                                                       : this._ratios,
                               this.gravity,
                               this.group,
                               true);
    }
}

/**
 * A layout with its children placed in tabs
 */
export class TabbedLayout<X> extends BranchLayoutBase<X, TabbedLayout<X>> {
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
     * Compute the new current tab for a spliced tab layout.
     * @param currentTab the current tab index of the old layout
     * @param idx the start index of the splice
     * @param remove the remove count of the splice
     * @param add the added children of the splice
     * @param children the resulting array of children
     */
    private static computeSpliceTab(currentTab: number,
                                    idx: number,
                                    remove: number,
                                    add: readonly      unknown[]|undefined,
                                    children: readonly unknown[]): number {
        let ret = currentTab;

        ret -= currentTab - Math.max(0, Math.min(remove, ret - idx + 1));

        if (ret >= idx && add !== undefined) { ret += add.length; }

        ret = Math.max(0, Math.min(children.length - 1, ret));

        return ret;
    }

    /**
     * Construct a new tabbed branch node.
     * @param children the children of the node
     * @param currentTab the currently selected child
     * @param gravity the gravity of the tabbed node
     * @param group the group of the tabbed node
     */
    public constructor(children: readonly ChildLayout<X>[],
                       currentTab: number,
                       gravity?: LayoutGravity,
                       group?: string) {
        super(children, gravity, group);

        this.currentTab = currentTab;
    }

    /** See `BranchLayoutBase.withChildren` */
    protected withChildren(newChildren: ChildLayout<X>[]): TabbedLayout<X> {
        return new TabbedLayout(newChildren, this.currentTab, this.gravity, this.group);
    }

    /**
     * Construct a child ID referencing a child of this node.
     * @param index the index of the child ID
     */
    public childId(index: number): ChildLayoutId<X> { return {stem: this, index}; }

    /**
     * convert this node into a root node.
     */
    public intoRoot(): RootLayout<X> { return new RootLayout(this); }

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
                          addChildren?: readonly ChildLayout<X>[],
                          changeTabTo?: number): {
        /** The resulting layout */
        layout: TabbedLayout<X>;
        /** The removed children */
        removed: ChildLayout<X>[];
    } {
        const idx = start === undefined ? this.children.length : start;

        const newChildren = this.children.slice();
        const removed = addChildren !== undefined ? newChildren.splice(idx, remove, ...addChildren)
                                                  : newChildren.splice(idx, remove);

        let newCurrentTab = this.currentTab;

        if (changeTabTo !== undefined) {
            if (addChildren === undefined || addChildren.length === 0) {
                if (changeTabTo !== 0) { throw new Error('invalid value for changeTabTo'); }

                newCurrentTab = TabbedLayout.computeSpliceTab(
                    this.currentTab, idx, remove, addChildren, newChildren);
            }
            else {
                if (changeTabTo < 0 || changeTabTo >= addChildren.length) {
                    throw new Error('invalid value for changeTabTo');
                }

                newCurrentTab = idx + changeTabTo;
            }
        }
        else {
            newCurrentTab = TabbedLayout.computeSpliceTab(
                this.currentTab, idx, remove, addChildren, newChildren);
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
        layout: TabbedLayout<X>;
        /** The removed child */
        removed: ChildLayout<X>;
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
    public withChild(index: number|undefined, child: ChildLayout<X>, changeTabTo: boolean):
        TabbedLayout<X> {
        const {layout} = this.spliceChildren(index, 0, [child], changeTabTo ? 0 : undefined);

        return layout;
    }

    /**
     * Recursively simplify this node tree.
     */
    public simplifyDeep(): PaneLayout<X>|undefined {
        let newChildren: (ChildLayout<X>|undefined)[]|undefined;

        this.children.forEach((child, idx) => {
            let newChild;

            const simplified = child.simplifyDeep();

            if (simplified !== undefined && simplified.type === LayoutType.Root) {
                throw new Error('invalid simplification - child attempted to become root');
            }

            const next = simplified !== undefined ? simplified : child;

            // Branches with no children will skip this block, leaving newChild
            // to be undefined.
            if (next.type === LayoutType.Leaf || next.children.length !== 0) { newChild = next; }

            if (!Object.is(newChild, child)) {
                if (newChildren === undefined) { newChildren = this.children.slice(); }

                newChildren[idx] = newChild;
            }
        });

        if (newChildren === undefined) {
            if (this.children.length === 1) { return this.children[0]; }

            return undefined;
        }

        const flatChildren = newChildren.filter(c => c !== undefined) as ChildLayout<X>[];

        if (flatChildren.length === 1) { return flatChildren[0]; }

        let newCurrentTab = this.currentTab;

        while (newCurrentTab > 0 && newChildren[newCurrentTab] === undefined) {
            newCurrentTab -= 1;
        }

        for (let i = newCurrentTab - 1; i >= 0; i -= 1) {
            if (newChildren[i] === undefined) { newCurrentTab -= 1; }
        }

        return new TabbedLayout(flatChildren, newCurrentTab, this.gravity, this.group);
    }
}
