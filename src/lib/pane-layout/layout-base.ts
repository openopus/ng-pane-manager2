/********************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (layout-base.ts)
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

import {
    ChildLayout,
    PaneLayout,
    RootLayout,
} from './layout-core';
import {childFromId, ChildLayoutId} from './layout-util';

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

// TODO: add 'sticky' nodes or placeholders for empty branches that aren't
//       removed during simplify to complement the gravity system (e.g. leaving
//       a document well around even if the last tab was closed)
/**
 * Base class for all pane layout node types.
 */
export abstract class LayoutBase<X> {
    /**
     * The type of the current node.
     */
    public abstract get type(): LayoutType;

    /**
     * If this represents an empty container, place the given child into it.
     * @param child the child to place
     */
    protected abstract tryEmplaceEmpty(child: ChildLayout<X>): PaneLayout<X>|undefined;

    /**
     * Convert this node into a root node.
     */
    public abstract intoRoot(): RootLayout<X>;

    /**
     * Find a child matching the given predicate.
     * @param pred predicate to match elements against
     */
    public abstract findChild(pred: (c: ChildLayout<X>) => boolean): ChildLayoutId<X>|undefined;

    /**
     * Find a child with the given gravity.
     * @param gravity the gravity to match against
     */
    public findChildByGravity(gravity: LayoutGravity): ChildLayoutId<X>|undefined {
        return this.findChild(c => c.gravity === gravity);
    }

    /**
     * Find any occurrences (by reference) of a node in the current tree and
     * replace them with another node.
     * @param find the node to search for
     * @param replace the node to replace the search node with
     */
    public abstract transposeDeep(find: PaneLayout<X>,
                                  replace: PaneLayout<X>): PaneLayout<X>|undefined;

    /**
     * Recursively simplify this node tree.
     */
    public abstract simplifyDeep(): PaneLayout<X>|undefined;

    /**
     * Add a child to the current layout tree using the given gravity value to
     * position it automatically.
     * @param pane the child to add
     * @param gravity the gravity of the child
     */
    public withChildByGravity(pane: ChildLayout<X>, gravity: LayoutGravity): PaneLayout<X> {
        // return this as any as PaneLayout<X>;

        {
            const emplaced = this.tryEmplaceEmpty(pane);

            // console.log(emplaced);

            if (emplaced !== undefined) { return emplaced; }
        }

        // If the well with the specified gravity already exists, drop the new
        // pane into that.
        {
            const well = this.findChildByGravity(gravity);

            if (well !== undefined) {
                const child = childFromId(well);

                let replace;

                switch (child.type) {
                case LayoutType.Leaf: throw new Error('Not yet implemented');
                case LayoutType.Horiz:
                case LayoutType.Vert: throw new Error('Not yet implemented');
                case LayoutType.Tabbed: replace = child.withChild(undefined, pane, true); break;
                }

                const transposed = this.transposeDeep(child, replace);

                if (transposed === undefined) {
                    throw new Error('failed to drop new pane into existing well');
                }

                return transposed;
            }
        }

        throw new Error('Not yet implemented');

        // switch (gravity) {
        // case LayoutGravity.Top:
        //     if (this.containsAnyGravity(LayoutGravity.Left,
        //                                 LayoutGravity.Center,
        //                                 LayoutGravity.Right)) {
        //         // TODO
        //     }
        //     break;
        // case LayoutGravity.Left:
        //     if (this.containsAnyGravity(LayoutGravity.Center)) {}
        //     break;
        // case LayoutGravity.Center:
        //     if (this.containsAnyGravity()) {} // TODO
        //     break;
        // case LayoutGravity.Right:
        //     // TODO
        //     break;
        // case LayoutGravity.Bottom:
        //     // TODO
        //     break;
        // }
    }

    // /**
    //  * Add a child to the specified group, or return undefined if the group
    //  * cannot be found.
    //  * @param pane the child to add
    //  * @param group the group the child should be added to
    //  */
    // public abstract addChildByGroup(pane: ChildLayout<X>,
    //                                 gravity: LayoutGravity): PaneLayout<X>|undefined;
}

/**
 * Base class for all non-root pane layout types.
 */
export abstract class ChildLayoutBase<X> extends LayoutBase<X> {
    /**
     * Construct a new layout node.
     * @param gravity the gravity of this layout node
     * @param group the group of this layout node
     */
    public constructor(public readonly gravity: LayoutGravity|undefined,
                       public readonly group: string|undefined) {
        super();
    }
}
