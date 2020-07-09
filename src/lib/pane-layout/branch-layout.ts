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

export abstract class BranchLayoutBase<T extends PaneLayout> extends LayoutBase {
    constructor(readonly children: readonly ChildLayout[],
                gravity: LayoutGravity|undefined,
                group: string|undefined) {
        super(gravity, group);
    }

    protected abstract withChildren(newChildren: ChildLayout[]): T;

    mapChildren(func: (value: ChildLayout, index: number) => ChildLayout): T {
        return this.withChildren(this.children.map(func));
    }

    mapChild(index: number, func: (value: ChildLayout) => ChildLayout): T {
        return this.mapChildren((e, i) => i === index ? func(e) : e);
    }

    transposeDeep(find: PaneLayout, replace: PaneLayout): PaneLayout|undefined {
        if (this as any === find) return replace;

        let newChildren: ChildLayout[]|undefined;

        this.children.forEach((child, idx) => {
            const newChild = child.transposeDeep(find, replace);

            if (newChild === undefined) return;

            if (newChild.type === LayoutType.Root)
                throw new Error('invalid transposition - child attempted to become root');

            if (newChildren === undefined) newChildren = this.children.slice();

            newChildren[idx] = newChild;
        });

        return newChildren !== undefined ? this.withChildren(newChildren) : undefined;
    }
}

export type BranchLayout = SplitLayout|TabbedLayout;

// TODO: there's some pretty heavy code duplication between the two
//       implementations below, but I can't think of a clean way to abstract the
//       repeated part.

export interface ResizeEvent {
    readonly index: number;
    readonly ratio: number;
}

export class SplitLayout extends BranchLayoutBase<SplitLayout> {
    private readonly _resizeEvents: Subject<ResizeEvent> = new Subject();
    private _ratioSum: number;

    get ratios(): readonly number[] { return this._ratios; }

    get resizeEvents(): Observable<ResizeEvent> { return this._resizeEvents; }

    // NOTE: TypeScript hates this, edit with caution.
    private static flatten<T>(arr: (T|readonly T[]|undefined)[]): T[] {
        return arr.filter(e => e !== undefined)
                   .reduce((l, r) => (l as T[]).concat(r as T | readonly T[]), []) as T[];
    }

    constructor(readonly           type: LayoutType.Horiz|LayoutType.Vert,
                children: readonly ChildLayout[],
                private readonly   _ratios: number[],
                gravity?: LayoutGravity,
                group?: string) {
        super(children, gravity, group);

        if (_ratios.length !== children.length)
            throw new Error(`mismatched child and split ratio counts (${children.length} vs ${
                _ratios.length})`);

        for (const ratio of _ratios) {
            if (!isFinite(ratio)) throw new Error(`invalid ratio ${ratio}`);
        }

        this._ratioSum = _ratios.reduce((s, e) => s + e, 0);

        // This fixes a quirk with the flex layout system where a sum weight
        // less than 1.0 causes elements not to fill all available space.
        if (this._ratioSum < 1.0) {
            const sum      = this._ratioSum;
            this._ratios   = _ratios.map(r => r / sum);
            this._ratioSum = 1.0;
        }
    }

    protected withChildren(newChildren: ChildLayout[]): SplitLayout {
        return new SplitLayout(this.type, newChildren, this._ratios, this.gravity, this.group);
    }

    childId(index: number): ChildLayoutId { return {stem: this, index}; }

    intoRoot(): RootLayout { return new RootLayout(this); }

    resizeChild(index: number, ratio: number) {
        if (index >= this._ratios.length)
            throw new Error(`index must be less than ${this._ratios.length}`);

        const oldRatio      = this._ratios[index];
        this._ratios[index] = ratio;

        this._ratioSum += ratio - oldRatio;

        // TODO: should an event be sent to all other children, since changing
        //       the sum ratio implicitly changes the size of all children?

        this._resizeEvents.next({index, ratio});
    }

    moveSplit(firstIdx: number, amount: number) {
        const secondIdx = firstIdx + 1;


        if (secondIdx >= this._ratios.length)
            throw new Error(`firstIdx must be less than ${this._ratios.length - 1}`);

        const clampedAmount = Math.max(-this._ratios[firstIdx],
                                       Math.min(this._ratios[secondIdx], amount));

        this._ratios[firstIdx] += clampedAmount;
        this._ratios[secondIdx] -= clampedAmount;
    }

    spliceChildren(start: number|undefined,
                   remove: number,
                   addChildren?: readonly ChildLayout[],
                   addRatios?: readonly   number[]):
        {layout: SplitLayout; removed: ChildLayout[]; removedRatios: number[]} {
        if (start === undefined) start = this.children.length;

        const newChildren = this.children.slice();
        const removed     = addChildren !== undefined
                            ? newChildren.splice(start, remove, ...addChildren)
                            : newChildren.splice(start, remove);

        if ((addRatios !== undefined ? addRatios.length : 0) !==
            (addChildren !== undefined ? addChildren.length : 0))
            throw new Error('mismatched lengths of addChildren and addRatios');

        const newRatios     = this._ratios.slice();
        const removedRatios = addRatios !== undefined
                                  ? newRatios.splice(start, remove, ...addRatios)
                                  : newRatios.splice(start, remove);

        return {
            layout: new SplitLayout(this.type, newChildren, newRatios, this.gravity, this.group),
            removed,
            removedRatios,
        };
    }

    withoutChild(index: number|
                 undefined): {layout: SplitLayout; removed: ChildLayout; removedRatio: number} {
        const {layout, removed, removedRatios} = this.spliceChildren(index, 1);

        return {layout, removed: removed[0], removedRatio: removedRatios[0]};
    }

    withChild(index: number|undefined, child: ChildLayout, ratio: number): SplitLayout {
        const {layout} = this.spliceChildren(index, 0, [child], [ratio]);

        return layout;
    }

    simplifyDeep(): PaneLayout|undefined {
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

                if (simplified !== undefined && simplified.type === LayoutType.Root)
                    throw new Error('invalid simplification - child attempted to become root');

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
                if (newChildren === undefined) newChildren = this.children.slice();
                if (newRatios === undefined) newRatios = this._ratios.slice();

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

export class TabbedLayout extends BranchLayoutBase<TabbedLayout> {
    readonly         type: LayoutType.Tabbed               = LayoutType.Tabbed;
    private readonly _$currentTab: BehaviorSubject<number> = new BehaviorSubject(-1);

    get $currentTab(): Observable<number> { return this._$currentTab; }
    get currentTab(): number { return this._$currentTab.value; }

    set currentTab(val: number) {
        if (this._$currentTab.value === val) return;

        if (val < 0 || val >= Math.max(1, this.children.length))
            throw new Error(`currentTab index ${val} is out of range`);

        this._$currentTab.next(val);
    }

    constructor(children: readonly ChildLayout[],
                currentTab: number,
                gravity?: LayoutGravity,
                group?: string) {
        super(children, gravity, group);

        this.currentTab = currentTab;
    }

    protected withChildren(newChildren: ChildLayout[]): TabbedLayout {
        return new TabbedLayout(newChildren, this.currentTab, this.gravity, this.group);
    }

    childId(index: number): ChildLayoutId { return {stem: this, index}; }

    intoRoot(): RootLayout { return new RootLayout(this); }

    spliceChildren(start: number|undefined,
                   remove: number,
                   addChildren?: readonly ChildLayout[],
                   changeTabTo?: number): {layout: TabbedLayout; removed: ChildLayout[]} {
        if (start === undefined) start = this.children.length;

        const newChildren = this.children.slice();
        const removed     = addChildren !== undefined
                            ? newChildren.splice(start, remove, ...addChildren)
                            : newChildren.splice(start, remove);

        let newCurrentTab = this.currentTab;

        if (changeTabTo !== undefined) {
            if (changeTabTo < 0 || (addChildren === undefined || changeTabTo >= addChildren.length))
                throw new Error('invalid value for changeTabTo');

            newCurrentTab = start + changeTabTo;
        }
        else {
            newCurrentTab -= Math.max(0, Math.min(remove, newCurrentTab - start + 1));

            if (newCurrentTab >= start && addChildren !== undefined)
                newCurrentTab += addChildren.length;
        }

        return {
            layout: new TabbedLayout(newChildren, newCurrentTab, this.gravity, this.group),
            removed,
        };
    }

    withoutChild(index: number|undefined): {layout: TabbedLayout; removed: ChildLayout} {
        const {layout, removed} = this.spliceChildren(index, 1);

        return {
            layout,
            removed: removed[0],
        };
    }

    withChild(index: number|undefined, child: ChildLayout, changeTabTo: boolean): TabbedLayout {
        const {layout} = this.spliceChildren(index, 0, [child], changeTabTo ? 0 : undefined);

        return layout;
    }

    simplifyDeep(): PaneLayout|undefined {
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
            if (child.type === LayoutType.Leaf || child.children.length === 0) {
                const simplified = child.simplifyDeep();

                if (simplified !== undefined && simplified.type === LayoutType.Root)
                    throw new Error('invalid simplification - child attempted to become root');

                newChild = simplified !== undefined ? simplified : child;
            }

            if (newChild !== child) {
                if (newChildren === undefined) newChildren = this.children.slice();

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
