/*************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (layout-core.spec.ts)
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
 ************************************************************************************/

// Not sure why this isn't working correctly...
// tslint:disable await-promise no-implicit-dependencies
import fc from 'fast-check';

import {EPSILON} from '../util';

import {BranchLayout, SplitLayout, TabbedLayout} from './branch-layout';
import {
    childFromId,
    childIdValid,
    ChildLayout,
    ChildLayoutId,
    LayoutGravity,
    LayoutType,
    LeafLayout,
    PaneLayout,
    StemLayout,
} from './layout-core';

const MAX_LAYOUT_DEPTH  = 5;
/** Maximum branch layout fanout, to prevent explosion */
export const MAX_LAYOUT_FANOUT = 3;
const MAX_SPLIT_RATIO   = 10;

/** Suggested layout tree depth range */
export const layoutDepthArb = fc.integer(0, MAX_LAYOUT_DEPTH);

/** Produces a random layout node gravity */
export const gravityArb: fc.Arbitrary<LayoutGravity|undefined> = fc.oneof(
    fc.constant(undefined),
    fc.constant(LayoutGravity.Top),
    fc.constant(LayoutGravity.Left),
    fc.constant(LayoutGravity.Center),
    fc.constant(LayoutGravity.Right),
    fc.constant(LayoutGravity.Bottom),
);

/** Produces a random node group ID */
export const groupArb = fc.oneof(fc.constant(undefined), fc.string());

/**
 * Produces a child (non-root) layout node.
 */
export const childArb: fc.Memo<ChildLayout<any>> = fc.memo(n => {
    if (n <= 1) { return leafArb; }

    return fc.frequency({arbitrary: leafArb, weight: 1}, {arbitrary: branchArb(n), weight: 2});
});

/**
 * Produces a leaf node with random template, ID, and extra.
 */
export const leafArb: fc
    .Arbitrary<LeafLayout<any>> = fc.record({
                                        id: fc.string(),
                                        template: fc.string(),
                                        extra: fc.anything(),
                                        gravity: gravityArb,
                                        group: groupArb,
                                    })
                                      .map(
                                          ({id, template, extra, gravity, group}) => new LeafLayout(
                                              id, template, extra, gravity, group));

/**
 * Produces a branch layout node.
 */
export const branchArb:
    fc.Memo<BranchLayout<any>> = fc.memo(n => fc.oneof(splitArb(n), tabbedArb(n)));

/**
 * Produces a stem layout node.
 */
export const stemArb: fc.Memo<StemLayout<any>> = fc.memo(
    n => fc.frequency({arbitrary: childArb(n).map(c => c.intoRoot()), weight: 1},
                      {arbitrary: branchArb(n), weight: 2}));

/**
 * Produces any kind of layout node.
 */
export const paneArb: fc.Memo<PaneLayout<any>> = fc.memo(
    n => fc.frequency({arbitrary: childArb(n).map(c => c.intoRoot()), weight: 1},
                      {arbitrary: childArb(n), weight: 3}));

/**
 * Produces ratios to go with a list of children for a split layout.
 *
 * This function produces ratios that are possibly zero, but ensures that the
 * sum of all ratios is not too small.
 * @param nChildren the number of children to generate ratios for
 */
export function splitRatiosArb(nChildren: number): fc.Arbitrary<number[]> {
    return fc.array(fc.float(0, MAX_SPLIT_RATIO), nChildren, nChildren).chain(arr => {
        return arr.length > 0 && arr.reduce((s, e) => s + e, 0) < EPSILON
                   ? fc.integer(0, arr.length - 1).map(i => {
                         const arr2 = arr.slice();
                         arr2[i] += 1;

                         return arr2;
                     })
                   : fc.constant(arr);
    });
}

/**
 * Produces a split branch with generated children and ratios.
 */
export const splitArb: fc.Memo<SplitLayout<any>> = fc.memo(_n => {
    return fc.array(childArb(), MAX_LAYOUT_FANOUT)
        .chain(children => fc.record({
            type: fc.oneof(fc.constant<LayoutType.Horiz|LayoutType.Vert>(LayoutType.Horiz),
                           fc.constant<LayoutType.Horiz|LayoutType.Vert>(LayoutType.Vert)),
            children: fc.constant(children),
            ratios: splitRatiosArb(children.length),
            gravity: gravityArb,
            group: groupArb,
        }))
        .map(({type, children, ratios, gravity, group}) => new SplitLayout(
                 type, children, ratios, gravity, group));
});

/**
 * Produces a tabbed branch with generated children.
 */
export const tabbedArb: fc.Memo<TabbedLayout<any>> = fc.memo(_n => {
    return fc.array(childArb(), MAX_LAYOUT_FANOUT)
        .chain(children => fc.record({
            children: fc.constant(children),
            currentTab: fc.integer(0, Math.max(0, children.length - 1)),
            gravity: gravityArb,
            group: groupArb,
        }))
        .map(({children, currentTab, gravity, group}) => new TabbedLayout(
                 children, currentTab, gravity, group));
});

/**
 * Produces a ChildLayoutId with a generated stem and index.
 *
 * The index may not always be valid.
 */
export const childLayoutIdArb:
    fc.Memo<ChildLayoutId<any>> = fc.memo(n => stemArb(n).chain(stem => fc.record({
    stem: fc.constant(stem),
    index: fc.frequency({arbitrary: fc.integer(0, Number.MAX_SAFE_INTEGER), weight: 1}, {
        arbitrary: fc.integer(0, stem.type === LayoutType.Root ? 1 : stem.children.length),
        weight: 4,
    }),
})));

describe('PaneLayout', () => {
    it('should have a type', async () => {
        await fc.assert(
            fc.asyncProperty(layoutDepthArb.chain(paneArb),
                             async pane => { await expect(typeof pane.type).toEqual('number'); }));
    });

    it('should support intoRoot()', async () => {
        await fc.assert(fc.asyncProperty(
            layoutDepthArb.chain(paneArb),
            async pane => { await expect(pane.intoRoot().type).toEqual(LayoutType.Root); }));
    });
});

describe('LayoutChildId', () => {
    it('should not error if it is valid', async () => {
        await fc.assert(
            fc.asyncProperty(layoutDepthArb.chain(childLayoutIdArb),
                             async childId => {
                                 fc.pre(childIdValid(childId));

                                 await expect(childFromId(childId)).toBeDefined();
                             }),
        );
    });
});
