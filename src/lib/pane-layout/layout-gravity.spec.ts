/****************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (layout-gravity.spec.ts)
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
 ***************************************************************************************/

// tslint:disable no-implicit-dependencies
import * as chai from 'chai';
import fc from 'fast-check';

import {LayoutGravity, LayoutType} from './layout-base';
import {
    LeafLayout,
    PaneLayout,
    RootLayout,
} from './layout-core';
import {saveLayoutGravity} from './layout-template';
import {childFromId, ChildLayoutId} from './layout-util';

/** Find the element with the pseudo-gravity described by its expected child nodes. */
function findPseudoGravity<X>(stemType: LayoutType, ...children: (ChildLayoutId<X>|undefined)[]):
    PaneLayout<X>|undefined {
    const defined = children.filter(c => c !== undefined) as ChildLayoutId<X>[];

    switch (defined.length) {
    case 0: return undefined;
    case 1: return childFromId(defined[0]);
    default:
        defined.reduce((index, id) => {
            chai.expect(id.index).to.be.greaterThan(index,
                                                    'mismatched order for expected siblings');

            return id.index;
        }, -1);

        const stem = defined.map(d => d.stem).reduce((parent, childStem) => {
            chai.expect(childStem).to.equal(parent, 'mismatched parent for expected siblings');

            return parent;
        });

        chai.expect(stem.type).to.equal(stemType, 'unexpected stem type');

        return stem;
    }
}

/** Find the ID of a child from the given root. */
function tryIdFromChild<X>(child: PaneLayout<X>|undefined, root: PaneLayout<X>): ChildLayoutId<X>|
    undefined {
    if (child === undefined || child.type === LayoutType.Root) { return undefined; }

    return root.idFromChild(child);
}

/**
 * Assert that a layout node generated using withChildByGravity has the proper
 * structure.
 * @param pane the pane to check
 */
function assertProperGravity<X>(pane: PaneLayout<X>): void {
    // Intended layout: (parenthesized nodes are pseudo-gravities)
    // (Root)       - vert
    // |-Header     - any
    // |-(Body)     - horiz
    // | |-Left     - any
    // | |-(Center) - horiz
    // | | |-Main   - any
    // | | '-Bottom - any
    // | '-Right    - any
    // '-Footer     - any

    const root = pane.intoRoot();

    const headerId = root.findChildByGravity(LayoutGravity.Header);
    const leftId   = root.findChildByGravity(LayoutGravity.Left);
    const mainId   = root.findChildByGravity(LayoutGravity.Main);
    const bottomId = root.findChildByGravity(LayoutGravity.Bottom);
    const rightId  = root.findChildByGravity(LayoutGravity.Right);
    const footerId = root.findChildByGravity(LayoutGravity.Footer);

    const center   = findPseudoGravity(LayoutType.Vert, mainId, bottomId);
    const centerId = tryIdFromChild(center, pane);

    const body   = findPseudoGravity(LayoutType.Horiz, leftId, centerId, rightId);
    const bodyId = tryIdFromChild(body, pane);

    const root2 = findPseudoGravity(LayoutType.Vert, headerId, bodyId, footerId);

    chai.expect(root2).to.equal(root.layout, 'unexpected root layout');
}

/**
 * Assert adding panes to an empty layout by gravity works.
 * @param gravs the gravities to add panes by
 */
function assertAddByGravity(gravs: LayoutGravity[]): void {
    let layout = new RootLayout(undefined);

    for (let i = 0; i < gravs.length; i += 1) {
        const gravity = gravs[i];
        let next;

        try {
            next = layout.withChildByGravity(
                new LeafLayout(`grav${gravity.toString()}`, 'template', undefined, gravity));

            // tslint:disable-next-line no-unused-expression
            chai.expect(next, 'withChildByGravity() failed').not.to.be.undefined;

            if (next !== undefined) {
                assertProperGravity(next);

                layout = next.intoRoot();
            }
        }
        catch (e) {
            throw new Error(`adding panes failed at step ${i + 1} (gravity ${
                saveLayoutGravity(gravity)}):\n${e}\nCurrent layout: ${
                JSON.stringify(layout)}\nFailed layout: ${JSON.stringify(next)}`);
        }
    }
}

describe('PaneLayout.withChildByGravity', () => {
    const GRAVITIES: readonly LayoutGravity[] = [
        LayoutGravity.Header,
        LayoutGravity.Left,
        LayoutGravity.Main,
        LayoutGravity.Bottom,
        LayoutGravity.Right,
        LayoutGravity.Footer,
    ];

    it('should be order-independent', () => {
        fc.assert(fc.property(
            fc.array(fc.nat().noShrink(), GRAVITIES.length, GRAVITIES.length).map(idcs => {
                const bag = GRAVITIES.slice();
                const ret = [];

                for (const idx of idcs) { ret.push(bag.splice(idx % bag.length, 1)[0]); }

                return ret;
            }),
            gravs => {
                assertAddByGravity(gravs);
                expect().nothing();
            }));

        expect().nothing();
    });

    it('should function correctly for any number of panels', () => {
        fc.assert(fc.property(fc.array(fc.oneof(...GRAVITIES.map(g => fc.constant(g)))), gravs => {
            assertAddByGravity(gravs);
            expect().nothing();
        }));
    });
});
