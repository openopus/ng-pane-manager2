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

// Not sure why this isn't working correctly...
// tslint:disable no-implicit-dependencies
import * as chai from 'chai';
import fc from 'fast-check';

import { EPSILON } from '../util';

import { SplitLayout } from './branch-layout';
import { LayoutType } from './layout-base';
import { branchArb, childArb, layoutDepthArb, splitRatiosArb } from './layout-core.spec';

const MAX_SPLICE_ADD = 5;

const spliceOpArb = layoutDepthArb
    .chain(branchArb)
    .chain(branch =>
        fc.record({
            branch: fc.constant(branch),
            start: fc.integer(0, branch.children.length).noShrink(),
            add: fc.array(fc.integer(0, MAX_SPLICE_ADD).chain(childArb)),
        }),
    )
    .chain(({ branch, start, add }) =>
        fc.record({
            branch: fc.constant(branch),
            start: fc.constant(start),
            remove: fc.integer(0, branch.children.length - start),
            add: fc.constant(add),
            extra:
                branch.type === LayoutType.Tabbed
                    ? fc.integer(0, Math.max(0, add.length - 1))
                    : splitRatiosArb(add.length),
        }),
    );

describe('BranchLayout', () => {
    it('should support spliceChildren', () => {
        fc.assert(
            fc.property(spliceOpArb, ({ branch, start, remove, add, extra }) => {
                const { layout, removed } = branch.spliceChildren(start, remove, add, extra as any);

                const spliced = branch.children.slice();
                const spliceRemoved = spliced.splice(start, remove, ...add);

                chai.expect(layout.children.length).to.equal(spliced.length);

                for (let i = 0; i < layout.children.length; i += 1) {
                    chai.expect(layout.children[i]).to.equal(spliced[i]);
                }

                chai.expect(removed.length).to.equal(spliceRemoved.length);

                for (let i = 0; i < removed.length; i += 1) {
                    chai.expect(removed[i]).to.equal(spliceRemoved[i]);
                }
            }),
        );

        expect().nothing();
    });
});

describe('SplitLayout', () => {
    it('should support spliceChildren', () => {
        fc.assert(
            fc.property(spliceOpArb, ({ branch, start, remove, add, extra }) => {
                fc.pre(branch.type === LayoutType.Horiz || branch.type === LayoutType.Vert);
                const split = branch as SplitLayout<any>;

                const { layout, removedRatios } = split.spliceChildren(
                    start,
                    remove,
                    add,
                    extra as any,
                );

                // tslint:disable-next-line no-unused-expression
                chai.expect(removedRatios).not.to.be.undefined;

                const spliced = split.ratios.slice();
                const spliceRemoved = spliced.splice(start, remove, ...(extra as any));

                const splicedSum = spliced.reduce((s, e) => s + e, 0);

                chai.expect(layout.ratios.length).to.equal(spliced.length);

                for (let i = 0; i < layout.ratios.length; i += 1) {
                    // Important note: the constructor for SplitLayout may
                    // normalize ratios, see the constructor for details
                    chai.expect(layout.ratios[i] * splicedSum).to.be.closeTo(
                        spliced[i] * layout.ratioSum,
                        EPSILON * splicedSum,
                    );
                }

                chai.expect(removedRatios.length).to.equal(spliceRemoved.length);

                for (let i = 0; i < removedRatios.length; i += 1) {
                    // These ratios should not be normalized, so they should be
                    // exactly equal
                    chai.expect(removedRatios[i]).to.equal(spliceRemoved[i]);
                }
            }),
        );

        expect().nothing();
    });
});
