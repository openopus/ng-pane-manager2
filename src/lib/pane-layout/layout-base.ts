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

import {SplitLayout} from './branch-layout';
import {
    ChildLayout,
    PaneLayout,
    RootLayout,
    StemLayout,
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

/**
 * Used internally to identify what role a certain pane plays when inserting
 * children by gravity.
 */
const enum PseudoGravityType {
    None,
    Phantom,
    Real,
}

/** Information about a higher-level pane */
type PseudoGravity<X> = {
    /** No panel could be located with the specified pseudo-gravity */
    type: PseudoGravityType.None;
    /** Must remain undefined */
    pane?: undefined;
    /** Must remain undefined */
    id?: undefined;
}|{
    /**
     * Only one pane was located, and should be treated as a container with one
     * child.
     */
    type: PseudoGravityType.Phantom;
    /** The child that was found */
    pane: ChildLayout<X>;
    /** The ID of the child */
    id: ChildLayoutId<X>;
}
|{
    /** Multiple children were located, and the most likely parent was found. */
    type: PseudoGravityType.Real;
    /** The parent that was found */
    pane: StemLayout<X>;
    /** The ID of the parent, if it was retrievable */
    id: ChildLayoutId<X>|undefined;
};

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
     * Identify an existing parent node given the provided children.\
     * Used to locate nodes for `withChildByGravity`.
     * @param children the children to match against
     */
    private findPseudoGravity(...children: (ChildLayoutId<X>|undefined)[]): PseudoGravity<X> {
        const defined = children.filter(c => c !== undefined) as ChildLayoutId<X>[];

        switch (defined.length) {
        case 0: return {type: PseudoGravityType.None};
        case 1:
            return {type: PseudoGravityType.Phantom, pane: childFromId(defined[0]), id: defined[0]};
        default:
            const freqs = new Map<StemLayout<X>, number>();

            for (const el of defined) {
                const stem = el.stem;
                const freq = freqs.get(stem);

                if (freq === undefined) { freqs.set(stem, 1); }
                else {
                    freqs.set(stem, freq + 1);
                }
            }

            let bestFreq = -1;
            let bestStem: StemLayout<X>|undefined;

            for (const [stem, freq] of freqs) {
                if (freq > bestFreq) {
                    bestStem = stem;
                    bestFreq = freq;
                }
            }

            if (bestStem === undefined) { return {type: PseudoGravityType.None}; }

            return {
                type: PseudoGravityType.Real,
                pane: bestStem,
                id: bestStem.type !== LayoutType.Root ? this.idFromChild(bestStem) : undefined,
            };
        }
    }

    /**
     * Add a child to the current layout using the provided pseudo-gravity and
     * intended sibling ordering.
     * @param pg the pseudo-gravity parent information
     * @param pane the pane to place
     * @param order an array of panes including `pane` to determine the index
     *              `pane` should be inserted at
     * @param splitType if a split is inserted, what type to make it
     * @param pct if the pane is inserted into a split node, the percentage of
     *            the available space it should be given
     */
    private placeChildForPseudoGravity(pg: PseudoGravity<X>,
                                       pane: ChildLayout<X>,
                                       order: (PaneLayout<X>|undefined)[],
                                       splitType: LayoutType.Horiz|LayoutType.Vert,
                                       pct: number): PaneLayout<X>|undefined {
        let replace;

        switch (pg.type) {
        case PseudoGravityType.None: return undefined;
        case PseudoGravityType.Phantom:
            const pseudoIdx = order.indexOf(pg.pane);
            const paneIdx   = order.indexOf(pane);

            if (pseudoIdx < 0 || paneIdx < 0) { throw new Error('invalid order array'); }

            const invPct = 1 - pct;
            replace      = paneIdx < pseudoIdx
                          ? new SplitLayout(splitType, [pane, pg.pane], [pct, invPct])
                          : new SplitLayout(splitType, [pg.pane, pane], [invPct, pct]);
            break;
        case PseudoGravityType.Real:
            if (pg.pane.type === LayoutType.Root) { throw new Error('Not yet implemented'); }

            const idx = pg.pane.locateChild(pane, order);

            switch (pg.pane.type) {
            case LayoutType.Horiz:
            case LayoutType.Vert:
                replace = pg.pane.withChild(idx, pane, (pct * pg.pane.ratioSum) / (1 - pct));
                break;
            case LayoutType.Tabbed: replace = pg.pane.withChild(idx, pane, true); break;
            }
            break;
        }

        return this.transposeDeep(pg.pane, replace);
    }

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
     * Find a descendant matching the given predicate.
     * @param pred predicate to match elements against
     */
    public abstract findChild(pred: (c: ChildLayout<X>) => boolean): ChildLayoutId<X>|undefined;

    /**
     * Find a descendant with the given gravity.
     * @param gravity the gravity to match against
     */
    public findChildByGravity(gravity: LayoutGravity): ChildLayoutId<X>|undefined {
        return this.findChild(c => c.gravity === gravity);
    }

    /**
     * Find the ID of a descendant node within this node.
     * @param child the child to retrieve the ID of
     */
    public idFromChild(child: ChildLayout<X>): ChildLayoutId<X>|undefined {
        return this.findChild(c => Object.is(c, child));
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
    public withChildByGravity(pane: ChildLayout<X>): PaneLayout<X>|undefined {
        if (pane.gravity === undefined) { throw new Error('cannot insert pane with no gravity'); }

        {
            const emplaced = this.tryEmplaceEmpty(pane);

            if (emplaced !== undefined) { return emplaced; }
        }

        // If the well with the specified gravity already exists, drop the new
        // pane into that.
        // TODO: finish writing this section
        {
            const well = this.findChildByGravity(pane.gravity);

            if (well !== undefined) {
                const child = childFromId(well);

                let replace;

                switch (child.type) {
                case LayoutType.Leaf: throw new Error('Not yet implemented (emplacing leaf)');
                case LayoutType.Horiz:
                case LayoutType.Vert: throw new Error('Not yet implemented (emplacing split)');
                case LayoutType.Tabbed: replace = child.withChild(undefined, pane, true); break;
                }

                const transposed = this.transposeDeep(child, replace);

                if (transposed === undefined) {
                    throw new Error('failed to drop new pane into existing well');
                }

                return transposed;
            }
        }

        // Orient ourselves, then insert a split in the right spot
        // TODO: optimize this once it works
        {
            const headerId = this.findChildByGravity(LayoutGravity.Header);
            const leftId   = this.findChildByGravity(LayoutGravity.Left);
            const mainId   = this.findChildByGravity(LayoutGravity.Main);
            const bottomId = this.findChildByGravity(LayoutGravity.Bottom);
            const rightId  = this.findChildByGravity(LayoutGravity.Right);
            const footerId = this.findChildByGravity(LayoutGravity.Footer);

            const header = headerId !== undefined ? childFromId(headerId) : undefined;
            const left   = leftId !== undefined ? childFromId(leftId) : undefined;
            const main   = mainId !== undefined ? childFromId(mainId) : undefined;
            const bottom = bottomId !== undefined ? childFromId(bottomId) : undefined;
            const right  = rightId !== undefined ? childFromId(rightId) : undefined;
            const footer = footerId !== undefined ? childFromId(footerId) : undefined;

            const center = this.findPseudoGravity(mainId, bottomId);
            const body   = this.findPseudoGravity(leftId, center.id, rightId);
            const root   = this.findPseudoGravity(headerId, body.id, footerId);

            let pg;
            let order;
            let type: LayoutType.Horiz|LayoutType.Vert;
            let ratio;

            switch (pane.gravity) {
            case LayoutGravity.Header:
                pg    = root;
                order = [pane, body.pane, footer];
                type  = LayoutType.Vert;
                ratio = 1 / 5; // tslint:disable-line no-magic-numbers
                break;
            case LayoutGravity.Left:
                if (body.type !== PseudoGravityType.None) {
                    pg    = body;
                    order = [pane, center.pane, right];
                    type  = LayoutType.Horiz;
                }
                else {
                    pg    = root;
                    order = [header, pane, footer];
                    type  = LayoutType.Vert;
                }

                ratio = 1 / 4; // tslint:disable-line no-magic-numbers
                break;
            case LayoutGravity.Main:
                if (center.type !== PseudoGravityType.None) {
                    pg    = center;
                    order = [pane, bottom];
                    type  = LayoutType.Vert;
                }
                else if (body.type !== PseudoGravityType.None) {
                    pg    = body;
                    order = [left, pane, right];
                    type  = LayoutType.Horiz;
                }
                else {
                    pg    = root;
                    order = [header, pane, footer];
                    type  = LayoutType.Vert;
                }

                ratio = 2 / 3; // tslint:disable-line no-magic-numbers
                break;
            case LayoutGravity.Bottom:
                if (center.type !== PseudoGravityType.None) {
                    pg    = center;
                    order = [main, pane];
                    type  = LayoutType.Vert;
                }
                else if (body.type !== PseudoGravityType.None) {
                    pg    = body;
                    order = [left, pane, right];
                    type  = LayoutType.Horiz;
                }
                else {
                    pg    = root;
                    order = [header, pane, footer];
                    type  = LayoutType.Vert;
                }

                ratio = 1 / 3; // tslint:disable-line no-magic-numbers
                break;
            case LayoutGravity.Right:
                if (body.type !== PseudoGravityType.None) {
                    pg    = body;
                    order = [left, center.pane, pane];
                    type  = LayoutType.Horiz;
                }
                else {
                    pg    = root;
                    order = [header, pane, footer];
                    type  = LayoutType.Vert;
                }

                ratio = 1 / 4; // tslint:disable-line no-magic-numbers
                break;
            case LayoutGravity.Footer:
                pg    = root;
                order = [header, body.pane, pane];
                type  = LayoutType.Vert;
                ratio = 1 / 10; // tslint:disable-line no-magic-numbers
                break;
            }

            return this.placeChildForPseudoGravity(pg, pane, order, type, ratio);
        }
    }

    // TODO: implement this
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
