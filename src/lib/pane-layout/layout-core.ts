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

import {BranchLayout, SplitLayout} from './branch-layout';
import {ChildLayoutBase, LayoutBase, LayoutGravity, LayoutType} from './layout-base';
import {ChildLayoutId} from './layout-util';

/** A layout node of any kind */
export type PaneLayout<X> = StemLayout<X>|LeafLayout<X>;
/** A layout node containing children */
export type StemLayout<X> = RootLayout<X>|GroupLayout<X>|BranchLayout<X>;
/** A non-root layout node */
export type ChildLayout<X> = GroupLayout<X>|BranchLayout<X>|LeafLayout<X>;

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
     * If this represents an empty container, place the given child into it.
     * @param child the child to place
     */
    protected tryEmplaceEmpty(child: ChildLayout<X>): PaneLayout<X>|undefined {
        if (this.layout === undefined) { return new RootLayout(child); }

        return undefined;
    }

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
        if (this.layout === undefined) { return undefined; }

        const newLayout = this.layout.simplifyDeep();

        const emptyChild = (l: ChildLayout<X>) => {
            switch (l.type) {
            case LayoutType.Horiz:
            case LayoutType.Vert:
            case LayoutType.Tabbed: return l.children.length === 0;
            default: return false;
            }
        };

        if (newLayout === undefined) {
            return emptyChild(this.layout) ? new RootLayout(undefined) : undefined;
        }

        if (newLayout.type === LayoutType.Root) {
            throw new Error('invalid simplification - child attempted to become root');
        }

        return new RootLayout(emptyChild(newLayout) ? undefined : newLayout);
    }
}

/**
 * A grouped split layout node, which contains one split layout node.
 *
 * This node is used to render headers over split nodes and prevent them from
 * collapsing.
 */
export class GroupLayout<X> extends ChildLayoutBase<X> {
    /** The type of the layout.  Used for type checking. */
    public readonly type: LayoutType.Group = LayoutType.Group;

    /**
     * Construct a new grouped split layout node.
     * @param headerWidgetId the string identifier of the header widgets to use
     * @param split the child layout
     */
    public constructor(public readonly split: SplitLayout<X>|undefined,
                       public readonly headerWidgetId: string,
                       gravity?: LayoutGravity,
                       group?: string) {
        super(gravity, group);
    }

    /**
     * If this represents an empty container and child is a split layout, place the given child into
     * this layout.
     * @param child the child to place
     */
    protected tryEmplaceEmpty(child: ChildLayout<X>): PaneLayout<X>|undefined {
        if (this.split === undefined &&
            (child.type === LayoutType.Horiz || child.type === LayoutType.Vert)) {
            return new GroupLayout(child, this.headerWidgetId, this.gravity, this.group);
        }

        return undefined;
    }

    /**
     * Return the ID of this node's child.
     */
    public childId(): ChildLayoutId<X> { return {stem: this, index: 0}; }

    /**
     * Wrap this group node in a root node.
     */
    public intoRoot(): RootLayout<X> { return new RootLayout(this); }

    /**
     * Find a child matching the given predicate.
     * @param pred predicate to match elements against
     */
    public findChild(pred: (c: ChildLayout<X>) => boolean): ChildLayoutId<X>|undefined {
        if (this.split === undefined) { return undefined; }

        if (pred(this.split)) { return this.childId(); }

        return this.split.findChild(pred);
    }

    /**
     * Remove the child of this node.
     * @param index the index of the child to remove.  Mus be `undefined` or 0
     */
    public withoutChild(index: number|undefined): {
        /** The resulting layout */
        layout: GroupLayout<X>;
        /** The removed child */
        removed: SplitLayout<X>;
    } {
        if (this.split === undefined) {
            throw new Error('cannot remove child of empty group layout');
        }

        if (index !== undefined && index !== 0) {
            throw new Error(`invalid root child index ${index} - must be 0`);
        }

        return {
            layout: new GroupLayout(undefined, this.headerWidgetId, this.gravity, this.group),
            removed: this.split,
        };
    }

    /**
     * Update the contained split node of this group
     * @param f the function to update the split layout with
     */
    public map(f: (c: SplitLayout<X>) => SplitLayout<X>| undefined): GroupLayout<X> {
        if (this.split === undefined) { return this; }

        return new GroupLayout(f(this.split), this.headerWidgetId, this.gravity, this.group);
    }

    /**
     * Find any occurrences (by reference) of a node in the current tree and
     * replace them with another node.
     * @param find the node to search for
     * @param replace the node to replace the search node with
     */
    public transposeDeep(find: PaneLayout<X>, replace: PaneLayout<X>): PaneLayout<X>|undefined {
        if (Object.is(this, find)) { return replace; }

        const newLayout = this.split !== undefined ? this.split.transposeDeep(find, replace)
                                                   : undefined;

        if (newLayout === undefined) { return undefined; }

        if (!(newLayout.type === LayoutType.Horiz || newLayout.type === LayoutType.Vert)) {
            throw new Error('invalid transposition - grouped split attempted to become non-split');
        }

        return new GroupLayout(newLayout, this.headerWidgetId, this.gravity, this.group);
    }

    /**
     * Recursively simplify this node tree.
     */
    public simplifyDeep(): PaneLayout<X>|undefined {
        if (this.split === undefined) { return undefined; }

        const newLayout = this.split.simplifyDeep(false);

        if (newLayout === undefined) {
            return this.split.children.length === 0
                       ? new GroupLayout(undefined, this.headerWidgetId, this.gravity, this.group)
                       : undefined;
        }

        if (!(newLayout.type === LayoutType.Horiz || newLayout.type === LayoutType.Vert)) {
            throw new Error('invalid simplification - grouped split attempted to become non-split');
        }

        return new GroupLayout(newLayout.children.length === 0 ? undefined : newLayout,
                               this.headerWidgetId,
                               this.gravity,
                               this.group);
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
     * Returns undefined, since leaves cannot be empty containers.
     * @param child the child to place
     */
    protected tryEmplaceEmpty(_child: ChildLayout<X>): PaneLayout<X>|undefined { return undefined; }

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
     * @param replace the node to replace the search node with
     */
    public transposeDeep(find: PaneLayout<X>, replace: PaneLayout<X>): PaneLayout<X>|undefined {
        return Object.is(this, find) ? replace : undefined;
    }

    /**
     * Recursively simplify this node tree.
     */
    public simplifyDeep(): PaneLayout<X>|undefined { return undefined; }
}
