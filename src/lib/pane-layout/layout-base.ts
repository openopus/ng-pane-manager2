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

import { clipDenormPos } from '../util';

import { SplitLayout, TabbedLayout } from './branch-layout';
import { ChildLayout, PaneLayout, RootLayout, StemLayout } from './layout-core';
import { childFromId, ChildLayoutId } from './layout-util';

/** The type identifier of a layout node */
export const enum LayoutType {
    /** A root layout node */
    Root,
    /** A group layout node for a split with a header */
    Group,
    /** A split branch node, oriented horizontally */
    Horiz,
    /** A split branch node, oriented vertically */
    Vert,
    /** A tabbed branch node */
    Tabbed,
    /** A leaf node */
    Leaf,
}

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
type PseudoGravity<X> =
    | {
          /** No panel could be located with the specified pseudo-gravity */
          type: PseudoGravityType.None;
          /** Disallows `pane` as a property name.  Used for type checking. */
          pane?: never;
          /** Disallows `id` as a property name.  Used for type checking. */
          id?: never;
      }
    | {
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
    | {
          /** Multiple children were located, and the most likely parent was found. */
          type: PseudoGravityType.Real;
          /** The parent that was found */
          pane: StemLayout<X>;
          /** The ID of the parent, if it was retrievable */
          id: ChildLayoutId<X> | undefined;
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
    private findPseudoGravity(...children: (ChildLayoutId<X> | undefined)[]): PseudoGravity<X> {
        const defined = children.filter(c => c !== undefined) as ChildLayoutId<X>[];

        switch (defined.length) {
            case 0:
                return { type: PseudoGravityType.None };
            case 1:
                return {
                    type: PseudoGravityType.Phantom,
                    pane: childFromId(defined[0]),
                    id: defined[0],
                };
            default:
                const freqs = new Map<StemLayout<X>, number>();

                for (const el of defined) {
                    const stem = el.stem;
                    const freq = freqs.get(stem);

                    if (stem.type === LayoutType.Root) {
                        continue;
                    }

                    if (freq === undefined) {
                        freqs.set(stem, 1);
                    } else {
                        freqs.set(stem, freq + 1);
                    }
                }

                let bestFreq = -1;
                let bestStem: StemLayout<X> | undefined;

                for (const [stem, freq] of freqs) {
                    if (freq > bestFreq) {
                        bestStem = stem;
                        bestFreq = freq;
                    }
                }

                if (bestStem === undefined) {
                    return { type: PseudoGravityType.None };
                }

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
     * @param fixRatios a map of children to maintain fixed ratios for to
     *                  prevent changing their size.  maps to a factor to
     *                  scale the child's overall percentage size by
     */
    private placeChildForPseudoGravity(
        pg: PseudoGravity<X>,
        pane: ChildLayout<X>,
        order: (PaneLayout<X> | undefined)[],
        splitType: LayoutType.Horiz | LayoutType.Vert,
        pct: number,
        fixRatios: Map<ChildLayoutId<X>, number>,
    ): PaneLayout<X> | undefined {
        switch (pg.type) {
            case PseudoGravityType.None:
                return undefined;
            case PseudoGravityType.Phantom: {
                const pseudoIdx = order.indexOf(pg.pane);
                const paneIdx = order.indexOf(pane);

                if (pseudoIdx < 0 || paneIdx < 0) {
                    throw new Error('invalid order array');
                }

                const invPct = 1 - pct;

                return this.transposeDeep(
                    pg.pane,
                    paneIdx < pseudoIdx
                        ? new SplitLayout(splitType, [pane, pg.pane], [pct, invPct])
                        : new SplitLayout(splitType, [pg.pane, pane], [invPct, pct]),
                );
            }
            case PseudoGravityType.Real:
                let find;

                switch (pg.pane.type) {
                    case LayoutType.Root:
                        throw new Error(
                            "multiple children reporting one root as a parent - this shouldn't happen",
                        );
                    case LayoutType.Group:
                        find = pg.pane.split;
                        break;
                    default:
                        find = pg.pane;
                        break;
                }

                // To appease TypeScript.
                if (find === undefined) {
                    throw new Error("pseudo-gravity pane was undefined  - this shouldn't happen");
                }

                const idx = find.locateChild(pane, order);

                if (idx === undefined) {
                    return undefined;
                }

                let replace;

                switch (find.type) {
                    case LayoutType.Horiz:
                    case LayoutType.Vert: {
                        const fixIdcs = new Map<number, number>();
                        const adjustedRatios = find.ratios.slice();
                        const addRatio = pct * find.ratioSum;
                        let extraSum = 0;
                        let netFixChange = 0;
                        let minExtra;

                        for (const [{ stem, index }, fac] of fixRatios) {
                            if (Object.is(stem, find)) {
                                fixIdcs.set(index, fac);
                            }
                        }

                        for (const [ratio, index] of find.ratios.map((r, i) => [r, i])) {
                            const fac = fixIdcs.get(index);
                            if (fac !== undefined) {
                                netFixChange += ratio * (1 - fac);
                            } else {
                                if (minExtra === undefined || ratio < minExtra) {
                                    minExtra = ratio;
                                }

                                extraSum += ratio;
                            }
                        }

                        const minExtraPct =
                            minExtra !== undefined ? minExtra / clipDenormPos(find.ratioSum) : 0;

                        const TINY = 0.1;
                        const extraFactor = Math.max(
                            TINY / Math.max(TINY, minExtraPct),
                            (netFixChange - addRatio) / clipDenormPos(extraSum) + 1,
                        );

                        for (let i = 0; i < adjustedRatios.length; i += 1) {
                            const fac = fixIdcs.get(i);
                            adjustedRatios[i] *= fac !== undefined ? fac : extraFactor;
                        }

                        adjustedRatios.splice(idx, 0, addRatio);

                        replace = find.withChild(idx, pane, adjustedRatios);
                        break;
                    }
                    case LayoutType.Tabbed:
                        replace = find.withChild(idx, pane, true);
                        break;
                }

                return this.transposeDeep(find, replace);
        }
    }

    /**
     * If this represents an empty container, place the given child into it.
     * @param child the child to place
     */
    protected abstract tryEmplaceEmpty(child: ChildLayout<X>): PaneLayout<X> | undefined;

    /**
     * Convert this node into a root node.
     */
    public abstract intoRoot(): RootLayout<X>;

    /**
     * Find a descendant matching the given predicate.
     * @param pred predicate to match elements against
     */
    public abstract findChild(pred: (c: ChildLayout<X>) => boolean): ChildLayoutId<X> | undefined;

    /**
     * Find a descendant with the given gravity.
     * @param gravity the gravity to match against
     */
    public findChildByGravity(gravity: LayoutGravity): ChildLayoutId<X> | undefined {
        return this.findChild(c => c.gravity === gravity);
    }

    /**
     * Find a descendant with the given group.
     * @param group the group to match against
     */
    public findChildByGroup(group: string): ChildLayoutId<X> | undefined {
        return this.findChild(c => c.group === group);
    }

    /**
     * Find the ID of a descendant node within this node.
     * @param child the child to retrieve the ID of
     */
    public idFromChild(child: ChildLayout<X>): ChildLayoutId<X> | undefined {
        return this.findChild(c => Object.is(c, child));
    }

    /**
     * Find any occurrences (by reference) of a node in the current tree and
     * replace them with another node.
     * @param find the node to search for
     * @param replace the node to replace the search node with
     */
    public abstract transposeDeep(
        find: PaneLayout<X>,
        replace: PaneLayout<X>,
    ): PaneLayout<X> | undefined;

    /**
     * Recursively simplify this node tree.
     */
    public abstract simplifyDeep(): PaneLayout<X> | undefined;

    /**
     * Add a child to the given node, splitting or tabifying it as necessary.
     * @param well the pane to add a child to
     * @param desc the child to add
     */
    public withDescendant(well: ChildLayoutId<X>, desc: ChildLayout<X>): PaneLayout<X> | undefined {
        const child = childFromId(well);

        let find = child;
        let replace;

        switch (child.type) {
            case LayoutType.Leaf:
                if (well.stem.type === LayoutType.Tabbed) {
                    find = well.stem;
                    replace = well.stem.withChild(undefined, desc, true);
                } else {
                    replace = new TabbedLayout([child, desc], 1, child.gravity, child.group);
                }
                break;
            case LayoutType.Group:
                replace = child.map(s =>
                    s.withChild(
                        undefined,
                        desc,
                        s.children.length > 0 ? s.ratioSum / s.children.length : 1,
                    ),
                );
                break;
            // TODO: This may cause undesired behavior.  The more intuitive
            //       approach may be to descend and create a tab in a child
            //       container but I didn't want to risk accidentally
            //       creating a split inside a tab.
            case LayoutType.Horiz:
            case LayoutType.Vert:
                replace = child.withChild(
                    undefined,
                    desc,
                    child.children.length > 0 ? child.ratioSum / child.children.length : 1,
                );
                break;
            case LayoutType.Tabbed:
                replace = child.withChild(undefined, desc, true);
                break;
        }

        const transposed = this.transposeDeep(find, replace);

        if (transposed === undefined) {
            throw new Error('failed to drop descendant into well');
        }

        return transposed;
    }

    /**
     * Add a child to the current layout tree using the child's gravity value to
     * position it automatically.
     * @param pane the child to add
     */
    public withChildByGravity(pane: ChildLayout<X>): PaneLayout<X> | undefined {
        if (pane.gravity === undefined) {
            throw new Error('cannot insert pane with no gravity');
        }

        // tslint:disable no-magic-numbers
        const HEADER_PCT = 1 / 5;
        const LEFT_PCT = 1 / 4;
        const RIGHT_PCT = LEFT_PCT;
        const BOTTOM_PCT = 1 / 3;
        const FOOTER_PCT = 1 / 10;

        const LEFT_PCT_LR = 1 / 2;
        const RIGHT_PCT_LR = 1 - LEFT_PCT_LR;

        const FOOTER_PCT_HF = FOOTER_PCT;
        const HEADER_PCT_HF = 1 - FOOTER_PCT;
        // tslint:enable no-magic-numbers

        {
            const emplaced = this.tryEmplaceEmpty(pane);

            if (emplaced !== undefined) {
                return emplaced;
            }
        }

        // If the well with the specified gravity already exists, drop the new
        // pane into that.
        {
            const well = this.findChildByGravity(pane.gravity);

            if (well !== undefined) {
                const ret = this.withDescendant(well, pane);

                if (ret !== undefined) {
                    return ret;
                }
            }
        }

        // Orient ourselves, then insert a split in the right spot
        // TODO: optimize this once it works
        {
            const headerId = this.findChildByGravity(LayoutGravity.Header);
            const leftId = this.findChildByGravity(LayoutGravity.Left);
            const mainId = this.findChildByGravity(LayoutGravity.Main);
            const bottomId = this.findChildByGravity(LayoutGravity.Bottom);
            const rightId = this.findChildByGravity(LayoutGravity.Right);
            const footerId = this.findChildByGravity(LayoutGravity.Footer);

            const header = headerId !== undefined ? childFromId(headerId) : undefined;
            const left = leftId !== undefined ? childFromId(leftId) : undefined;
            const main = mainId !== undefined ? childFromId(mainId) : undefined;
            const bottom = bottomId !== undefined ? childFromId(bottomId) : undefined;
            const right = rightId !== undefined ? childFromId(rightId) : undefined;
            const footer = footerId !== undefined ? childFromId(footerId) : undefined;

            const center = this.findPseudoGravity(mainId, bottomId);
            const body = this.findPseudoGravity(leftId, center.id, rightId);
            const root = this.findPseudoGravity(headerId, body.id, footerId);

            let pg;
            let order;
            let type: LayoutType.Horiz | LayoutType.Vert | undefined;
            let ratio;

            const fallbackCenter = () => {
                if (body.type !== PseudoGravityType.None) {
                    pg = body;
                    order = [left, pane, right];
                    type = LayoutType.Horiz;
                    ratio = 1;

                    if (leftId !== undefined) {
                        ratio -= LEFT_PCT;
                    }
                    if (rightId !== undefined) {
                        ratio -= RIGHT_PCT;
                    }
                } else {
                    fallbackBody();
                }
            };

            const fallbackBody = () => {
                pg = root;
                order = [header, pane, footer];
                type = LayoutType.Vert;
                ratio = 1;

                if (headerId !== undefined) {
                    ratio -= HEADER_PCT;
                }
                if (footerId !== undefined) {
                    ratio -= FOOTER_PCT;
                }
            };

            switch (pane.gravity) {
                case LayoutGravity.Header:
                    pg = root;
                    order = [pane, body.pane, footer];
                    type = LayoutType.Vert;
                    ratio =
                        footerId !== undefined && body.type === PseudoGravityType.None
                            ? HEADER_PCT_HF
                            : HEADER_PCT;
                    break;
                case LayoutGravity.Left:
                    if (body.type !== PseudoGravityType.None) {
                        pg = body;
                        order = [pane, center.pane, right];
                        type = LayoutType.Horiz;
                        ratio =
                            rightId !== undefined && center.type === PseudoGravityType.None
                                ? LEFT_PCT_LR
                                : LEFT_PCT;
                    } else {
                        fallbackBody();
                    }
                    break;
                case LayoutGravity.Main:
                    if (center.type !== PseudoGravityType.None) {
                        pg = center;
                        order = [pane, bottom];
                        type = LayoutType.Vert;
                        ratio = 1;

                        if (bottomId !== undefined) {
                            ratio -= BOTTOM_PCT;
                        }
                    } else {
                        fallbackCenter();
                    }
                    break;
                case LayoutGravity.Bottom:
                    if (center.type !== PseudoGravityType.None) {
                        pg = center;
                        order = [main, pane];
                        type = LayoutType.Vert;
                        ratio = BOTTOM_PCT;
                    } else {
                        fallbackCenter();
                    }
                    break;
                case LayoutGravity.Right:
                    if (body.type !== PseudoGravityType.None) {
                        pg = body;
                        order = [left, center.pane, pane];
                        type = LayoutType.Horiz;
                        ratio =
                            leftId !== undefined && center.type === PseudoGravityType.None
                                ? RIGHT_PCT_LR
                                : RIGHT_PCT;
                    } else {
                        fallbackBody();
                    }
                    break;
                case LayoutGravity.Footer:
                    pg = root;
                    order = [header, body.pane, pane];
                    type = LayoutType.Vert;
                    ratio =
                        headerId !== undefined && body.type === PseudoGravityType.None
                            ? FOOTER_PCT_HF
                            : FOOTER_PCT;
                    break;
            }

            const fixRatios = new Map<ChildLayoutId<X> | undefined, number>();

            if (pg !== undefined && pg.type === PseudoGravityType.Real) {
                switch (pg) {
                    case root:
                        if (headerId !== undefined && footerId !== undefined) {
                            fixRatios.set(headerId, HEADER_PCT / HEADER_PCT_HF);
                            fixRatios.set(footerId, FOOTER_PCT / FOOTER_PCT_HF);
                        } else {
                            fixRatios.set(headerId, 1);
                            fixRatios.set(footerId, 1);
                        }

                        break;
                    case body:
                        if (leftId !== undefined && rightId !== undefined) {
                            fixRatios.set(leftId, LEFT_PCT / LEFT_PCT_LR);
                            fixRatios.set(rightId, RIGHT_PCT / RIGHT_PCT_LR);
                        } else {
                            fixRatios.set(leftId, 1);
                            fixRatios.set(rightId, 1);
                        }
                        break;
                    case center:
                        fixRatios.set(bottomId, 1);
                        break;
                }
            }

            fixRatios.delete(undefined);

            if (
                pg === undefined ||
                order === undefined ||
                type === undefined ||
                ratio === undefined
            ) {
                throw new Error('missing pseudo-gravity info - this should never happen');
            }

            return this.placeChildForPseudoGravity(
                pg,
                pane,
                order,
                type,
                ratio,
                fixRatios as Map<ChildLayoutId<X>, number>,
            );
        }
    }

    /**
     * Add a child to the child's group within the layout, or return undefined
     * if the group cannot be found.
     * @param pane the child to add
     */
    public withChildByGroup(pane: ChildLayout<X>): PaneLayout<X> | undefined {
        if (pane.group === undefined) {
            throw new Error('cannot insert a pane with no group');
        }

        const well = this.findChildByGroup(pane.group);

        if (well === undefined) {
            return undefined;
        }

        return this.withDescendant(well, pane);
    }
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
    public constructor(
        public readonly gravity: LayoutGravity | undefined,
        public readonly group: string | undefined,
    ) {
        super();
    }
}
