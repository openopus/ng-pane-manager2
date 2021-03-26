/***********************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (layout-builder.ts)
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
 **********************************************************************************/

import {SplitLayout, TabbedLayout} from './branch-layout';
import {LayoutGravity, LayoutType} from './layout-base';
import {ChildLayout, GroupLayout, LeafLayout, PaneLayout, RootLayout} from './layout-core';
import {GravityTemplate, LayoutTemplate, loadLayout, loadLayoutGravity} from './layout-template';

/** Represents a value with either a success or failure */
export type Result<T> = {
    /** The resulting value, indicating a success */
    ok: T;
    /** Disallows `err` as a property name.  Used for type checking. */
    err?: never;

    /** Returns the underlying value. */
    unwrap(): T;
}|{
    /** Disallows `ok` as a property name.  Used for type checking. */
    ok?: never;
    /** An error that occurred, indicating a failure */
    err: Error;

    /** Throws the attached error. */
    unwrap(): never;
};

/** Represents a string or numeric layout gravity. */
export type AnyGravity = GravityTemplate|LayoutGravity|undefined;

/**
 * Convert a value of type `AnyGravity` to a `LayoutGravity`.
 * @param gravity the gravity to convert
 */
function getGravity(gravity: AnyGravity): LayoutGravity|undefined {
    if (typeof gravity === 'string') { return loadLayoutGravity(gravity); }

    return gravity;
}

/** Interface for the `.build` method of a new layout builder. */
export interface LayoutBuilderRunner<X> {
    /** The root layout constructed by the builder so far */
    readonly root: RootLayout<X>;

    /**
     * Apply a sequence of operations to the current value of root, returning it
     * as a result.
     *
     * This function catches all errors and collects them into the return value.
     * @param callback function to use to modify the current root
     */
    build(callback: (builder: LayoutBuilder<X>) => void): Result<RootLayout<X>>;
}

/**
 * Helper class for quickly constructing layout trees using a simplified
 * version of the layout node API.
 */
export class LayoutBuilder<X> implements LayoutBuilderRunner<X> {
    /**
     * The current root layout.  This value is mutated when a layout change is
     * applied.
     */
    public get root(): RootLayout<X> { return this._root; }

    /**
     * Begin building on an existing layout.
     * @param layout the layout to wrap
     */
    public static from<X>(layout: PaneLayout<X>): LayoutBuilderRunner<X> {
        return new LayoutBuilder(layout.intoRoot());
    }

    /**
     * Begin building a new layout from scratch.
     */
    public static empty<X>(): LayoutBuilderRunner<X> {
        return new LayoutBuilder(new RootLayout(undefined));
    }

    /**
     * Construct a new layout builder.
     * @param _root the initial root layout
     */
    private constructor(private _root: RootLayout<X>) {}

    /**
     * Update the current root layout, throwing if the function errors or
     * returns `undefined`.
     * @param callback function to compute a new root layout given the current one
     */
    private transact(callback: (root: RootLayout<X>) => RootLayout<X>| undefined): void {
        const ret = callback(this._root);
        if (ret === undefined) { throw new Error('layout transaction returned undefined'); }

        this._root = ret;
    }

    /**
     * Apply a sequence of operations to the current value of root, returning it
     * as a result.
     *
     * This function catches all errors and collects them into the return value.
     * @param callback function to use to modify the current root
     */
    public build(callback: (builder: LayoutBuilder<X>) => void): Result<RootLayout<X>> {
        try {
            callback(this);
            const ok = this._root;

            return {ok, unwrap: () => ok};
        }
        catch (err) {
            return {err, unwrap: () => { throw err; }};
        }
    }

    /**
     * Loads a layout template with the given function to load extra data from
     * the template.
     *
     * If your `loadExtra` function looks like `x => x`, consider using
     * `loadSimple` instead.
     * @param template the template to load, or `undefined`
     * @param loadExtra the function used to load extra data
     */
    public load<T>(template: LayoutTemplate<T>|undefined,
                   loadExtra: (extra: T) => X): ChildLayout<X> {
        if (template === undefined) { throw new Error('template to load was undefined'); }

        return loadLayout(template, loadExtra);
    }

    /**
     * Loads a layout template, applying no changes to the extra data.
     *
     * If you need more complex handling of extra data, consider using
     * `load` instead.
     * @param template the template to load, or `undefined`
     */
    public loadSimple(template: LayoutTemplate<X>|undefined): ChildLayout<X> {
        return this.load(template, x => x);
    }

    /**
     * Construct a new leaf node.
     * @param id the leaf ID
     * @param template the leaf template name
     * @param extra the extra data for the leaf
     * @param gravity the node gravity
     * @param group the node group
     */
    public leaf(id: string, template: string, extra: X, gravity?: AnyGravity, group?: string):
        LeafLayout<X> {
        return new LeafLayout(id, template, extra, getGravity(gravity), group);
    }

    /**
     * Construct a new grouped split node.
     * @param split the contained split node
     * @param header the name of the node header template
     * @param gravity the node gravity
     * @param group the node group
     */
    public group(split: SplitLayout<X>, header: string, gravity?: AnyGravity, group?: string):
        GroupLayout<X> {
        return new GroupLayout(split, header, getGravity(gravity), group);
    }

    /**
     * Construct a new split node.
     * @param vert true if the split should be oriented vertically, not horizontally
     * @param children the children of the split node
     * @param ratios the ratios of the children, or `undefined` for all `1`s
     * @param gravity the node gravity
     * @param group the node group
     */
    public split(vert: boolean,
                 children: ChildLayout<X>[],
                 ratios?: number[],
                 gravity?: AnyGravity,
                 group?: string): SplitLayout<X> {
        return new SplitLayout(vert ? LayoutType.Vert : LayoutType.Horiz,
                               children,
                               ratios !== undefined ? ratios : children.map(_ => 1),
                               getGravity(gravity),
                               group);
    }

    /**
     * Construct a new horizontal split node.
     * @param children the children of the split node
     * @param ratios the ratios of the children, or `undefined` for all `1`s
     * @param gravity the node gravity
     * @param group the node group
     */
    public horiz(children: ChildLayout<X>[],
                 ratios?: number[],
                 gravity?: AnyGravity,
                 group?: string): SplitLayout<X> {
        return this.split(false, children, ratios, gravity, group);
    }

    /**
     * Construct a new vertical split node.
     * @param children the children of the split node
     * @param ratios the ratios of the children, or `undefined` for all `1`s
     * @param gravity the node gravity
     * @param group the node group
     */
    public vert(children: ChildLayout<X>[],
                ratios?: number[],
                gravity?: AnyGravity,
                group?: string): SplitLayout<X> {
        return this.split(true, children, ratios, gravity, group);
    }

    /**
     * Construct a new tabbed node.
     * @param children the children of the tabbed node
     * @param current the current tab, or `undefined` for the last child
     * @param gravity the node gravity
     * @param group the node group
     */
    public tab(children: ChildLayout<X>[], current?: number, gravity?: AnyGravity, group?: string):
        TabbedLayout<X> {
        return new TabbedLayout(children,
                                current !== undefined ? current : children.length - 1,
                                getGravity(gravity),
                                group);
    }

    /**
     * Replace the current root with a new layout.  Mutates `this.root`.
     * @param layout the layout to switch the current root to
     */
    public set(layout: PaneLayout<X>): void { this.transact(_ => layout.intoRoot()); }

    /**
     * Add the given children to the current root.  Mutates `this.root`.
     * @param children the list of children to add, in order
     */
    public add(...children: ChildLayout<X>[]): void {
        for (const child of children) {
            this.transact(root => {
                if (child.group !== undefined) {
                    const next = root.withChildByGroup(child);

                    if (next !== undefined) { return next.intoRoot(); }
                }

                if (child.gravity !== undefined) {
                    const next = root.withChildByGravity(child);

                    if (next !== undefined) { return next.intoRoot(); }
                }

                throw new Error('unable to place child into layout');
            });
        }
    }

    /**
     * Replace `find` with `replace` in the current root layout.  Mutates
     * `this.root`.
     * @param find the node to search for, or undefined
     * @param replace the node to replace `find` with, or undefined
     */
    public sub(find: PaneLayout<X>|undefined, replace: PaneLayout<X>|undefined): void {
        if (find === undefined) { throw new Error('find node was undefined'); }
        if (replace === undefined) { throw new Error('replacement node was undefined'); }

        this.transact(root => {
            const next = root.transposeDeep(find, replace);

            return next !== undefined ? next.intoRoot() : undefined;
        });
    }
}
