/********************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (layout-core.ts)
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

import {BranchLayout} from './branch-layout';
import {ChildLayoutBase, LayoutBase} from './layout-base';

/** A layout node of any kind */
export type PaneLayout<X> = RootLayout<X>|BranchLayout<X>|LeafLayout<X>;
/** A layout node containing children */
export type StemLayout<X> = RootLayout<X>|BranchLayout<X>;
/** A non-root layout node */
export type ChildLayout<X> = BranchLayout<X>|LeafLayout<X>;

/** The type identifier of a layout node */
export const enum LayoutType {
    /** A root layout node */
    Root,
    /** A split branch node, oriented horizontally */
    Horiz,
    /** A split branch node, oriented vertically */
    Vert,
    /** A tabbed branch node */
    Tabbed,
    /** A leaf node */
    Leaf,
}

// TODO: make gravity and group useful
/**
 * The gravity of a layout, used for identifying regions to insert panes into.
 */
export const enum LayoutGravity {
    /**
     * The top region spanning the whole layout horizontally.\
     * Example usages include toolbars, ribbons, or tool shelves.
     */
    Header,
    /**
     * The left region, nested vertically between the header and footer.\
     * Example usages include navbars or folder trees.
     */
    Left,
    /**
     * The central region, intended for the primary work area.
     */
    Main,
    /**
     * The bottom region stacked directly below main region.\
     * Example usages include status panels or ancillary information.
     */
    Bottom,
    /**
     * The right region, nested vertically between the header and footer.\
     * Example usages include property editors or sidebars.
     */
    Right,
    /**
     * The bottom region spanning the whole layout horizontally.\
     * Example usages include status bars or footers.
     */
    Footer,
}

/**
 * A reference to a layout node via the parent containing it.
 */
export interface ChildLayoutId<X, S extends StemLayout<X> = StemLayout<X>> {
    /** The stem containing the target node */
    stem: S;
    /** The index of the target node */
    index: number;
}

/**
 * A child layout ID, stored with a child guaranteed to match the ID.
 */
export class ChildWithId<X, C extends ChildLayout<X> = ChildLayout<X>> {
    /**
     * Retrieve the child referenced by the given ID.
     * @param id the layout ID to retrieve the child from
     */
    public static fromId<X>(id: ChildLayoutId<X>): ChildWithId<X> {
        return new ChildWithId(childFromId(id), id);
    }

    /**
     * Construct a new child-ID pair
     * @param child the child referenced by the ID
     * @param id the ID referencing a child
     */
    private constructor(public readonly child: C, public readonly id: ChildLayoutId<X>) {}
}

/**
 * Retrieve the child referenced by a layout ID.
 * @param id the ID of the child layout
 */
export function childFromId<X>({stem, index}: ChildLayoutId<X>): ChildLayout<X> {
    if (stem.type === LayoutType.Root) {
        if (stem.layout === undefined) { throw new Error('root layout is empty'); }

        if (index !== 0) { throw new Error(`invalid root child index ${index} - must be 0`); }

        return stem.layout;
    }

    return stem.children[index];
}

/**
 * Verify the given child ID is valid.
 * @param id the ID of the child layout
 */
export function childIdValid<X>({stem, index}: ChildLayoutId<X>): boolean {
    if (stem.type === LayoutType.Root) { return stem.layout !== undefined && index === 0; }

    return index >= 0 && stem.children.length > index;
}

/**
 * A root layout node, which contains one child and cannot be contained by any
 * other node type.
 *
 * This node is used to ensure that any other nodes can have a valid child ID.
 */
export class RootLayout<X> extends LayoutBase<X> {
    /** The type of the layout.  Used for type checking. */
    public readonly type: LayoutType.Root = LayoutType.Root;

    /**
     * Construct a new root layout node.
     * @param layout the child layout
     */
    public constructor(public readonly layout: ChildLayout<X>|undefined) { super(); }

    /**
     * Return the ID of this node's child.
     */
    public childId(): ChildLayoutId<X> { return {stem: this, index: 0}; }

    /**
     * Does nothing, but is provided for completeness.  Adding this definition
     * ensures `.intoRoot()` exists for any `PaneLayout`.
     */
    public intoRoot(): RootLayout<X> { return this; }

    /**
     * Find a child matching the given predicate.
     * @param pred predicate to match elements against
     */
    public findChild(pred: (c: ChildLayout<X>) => boolean): ChildLayoutId<X>|undefined {
        if (this.layout === undefined) { return undefined; }

        if (pred(this.layout)) { return this.childId(); }

        return this.layout.findChild(pred);
    }

    /**
     * Remove the child of this node.
     * @param index the index of the child to remove.  Must be `undefined` or 0
     */
    public withoutChild(index: number|undefined): {
        /** The resulting layout */
        layout: RootLayout<X>;
        /** The removed child */
        removed: ChildLayout<X>;
    } {
        if (this.layout === undefined) {
            throw new Error('cannot remove child of empty root layout');
        }

        if (index !== undefined && index !== 0) {
            throw new Error(`invalid root child index ${index} - must be 0`);
        }

        return {layout: new RootLayout(undefined), removed: this.layout};
    }

    /**
     * Find any occurrences (by reference) of a node in the current tree and
     * replace them with another node.
     * @param find the node to search for
     * @param replace the node to replace the search node with
     */
    public transposeDeep(find: PaneLayout<X>, replace: PaneLayout<X>): PaneLayout<X>|undefined {
        if (Object.is(this, find)) { return replace; }

        const newLayout = this.layout !== undefined ? this.layout.transposeDeep(find, replace)
                                                    : undefined;

        if (newLayout === undefined) { return undefined; }

        if (newLayout.type === LayoutType.Root) {
            throw new Error('invalid transposition - child attempted to become root');
        }

        return new RootLayout(newLayout);
    }

    /**
     * Recursively simplify this node tree.
     */
    public simplifyDeep(): PaneLayout<X>|undefined {
        const newLayout = this.layout !== undefined ? this.layout.simplifyDeep() : undefined;

        if (newLayout === undefined) { return undefined; }

        if (newLayout.type === LayoutType.Root) {
            throw new Error('invalid simplification - child attempted to become root');
        }

        return new RootLayout(newLayout);
    }
}

/**
 * A leaf node, which contains user content but no other nodes.
 */
export class LeafLayout<X> extends ChildLayoutBase<X> {
    /** The type of the layout.  Used for type checking. */
    public readonly type: LayoutType.Leaf = LayoutType.Leaf;

    /**
     * Construct a new leaf node.
     * @param id the unique string identifier for this leaf node
     * @param template the name of the template to render this leaf node with
     * @param gravity the gravity of this leaf node
     * @param group the group of this leaf node
     */
    public constructor(public readonly id: string,
                       public readonly template: string,
                       public readonly extra: X,
                       gravity?: LayoutGravity,
                       group?: string) {
        super(gravity, group);
    }

    /**
     * Wrap this leaf node in a root node.
     */
    public intoRoot(): RootLayout<X> { return new RootLayout(this); }

    /**
     * Returns undefined, since leaves have no child IDs.
     * @param pred predicate to match elements against
     */
    public findChild(_pred: (c: ChildLayout<X>) => boolean): ChildLayoutId<X>|undefined {
        return undefined;
    }

    /**
     * Find any occurrences (by reference) of a node in the current tree and
     * replace them with another node.
     * @param find the node to search for
     * @param replace thenode to replace the search node with
     */
    public transposeDeep(find: PaneLayout<X>, replace: PaneLayout<X>): PaneLayout<X>|undefined {
        return Object.is(this, find) ? replace : undefined;
    }

    /**
     * Recursively simplify this node tree.
     */
    public simplifyDeep(): PaneLayout<X>|undefined { return undefined; }
}
