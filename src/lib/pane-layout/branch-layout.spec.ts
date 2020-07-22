/***************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (branch-layout.spec.ts)
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
 **************************************************************************************/

import fc from 'fast-check';

import {SplitLayout} from './branch-layout';
import {LayoutType} from './layout-core';
import {branchArb, childArb, layoutDepthArb, splitRatiosArb} from './layout-core.spec';

const spliceOpArb = layoutDepthArb.chain(branchArb)
                        .chain(branch => fc.record({
                            branch: fc.constant(branch),
                            start: fc.integer(0, branch.children.length).noShrink(),
                            add: fc.array(fc.integer(0, 3).chain(childArb)),
                        }))
                        .chain(({branch, start, add}) => fc.record({
                            branch: fc.constant(branch),
                            start: fc.constant(start),
                            remove: fc.integer(0, branch.children.length - start),
                            add: fc.constant(add),
                            extra: branch.type === LayoutType.Tabbed
                                       ? fc.integer(0, Math.max(0, add.length - 1))
                                       : splitRatiosArb(add.length),
                        }));

describe('BranchLayout', () => {
    it('should support spliceChildren', async () => {
        await fc.assert(
            fc.asyncProperty(spliceOpArb, async ({branch, start, remove, add, extra}) => {
                const {layout, removed} = branch.spliceChildren(start, remove, add, extra as any);

                const spliced       = branch.children.slice();
                const spliceRemoved = spliced.splice(start, remove, ...add);

                await expect(layout.children.length).toEqual(spliced.length);

                for (let i = 0; i < layout.children.length; i += 1) {
                    await expect(layout.children[i]).toEqual(spliced[i]);
                }

                await expect(removed.length).toEqual(spliceRemoved.length);

                for (let i = 0; i < removed.length; i += 1) {
                    await expect(removed[i]).toEqual(spliceRemoved[i]);
                }
            }));
    });
});

describe('SplitLayout', () => {
    it('should support spliceChildren', async () => {
        await fc.assert(
            fc.asyncProperty(spliceOpArb, async ({branch, start, remove, add, extra}) => {
                fc.pre(branch.type === LayoutType.Horiz || branch.type === LayoutType.Vert);
                const split = branch as SplitLayout<any>;

                const {layout,
                       removedRatios} = split.spliceChildren(start, remove, add, extra as any);

                await expect(removedRatios).toBeDefined();

                const spliced       = split.ratios.slice();
                const spliceRemoved = spliced.splice(start, remove, ...extra as any);

                const splicedSum = spliced.reduce((s, e) => s + e, 0);

                await expect(layout.ratios.length).toEqual(spliced.length);

                for (let i = 0; i < layout.ratios.length; i += 1) {
                    // Important note: the constructor for SplitLayout may
                    // normalize ratios, see the constructor for details
                    await expect(layout.ratios[i])
                        .toBeCloseTo(spliced[i] * layout.ratioSum / splicedSum);
                }

                await expect(removedRatios.length).toEqual(spliceRemoved.length);

                for (let i = 0; i < removedRatios.length; i += 1) {
                    await expect(removedRatios[i]).toEqual(spliceRemoved[i]);
                }
            }));
    });
});
