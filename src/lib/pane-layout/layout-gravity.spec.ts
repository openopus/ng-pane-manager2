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
            if (id.index <= index) { throw new Error('mismatched order for expected siblings'); }

            return id.index;
        }, -1);

        const stem = defined.map(d => d.stem).reduce((parent, childStem) => {
            chai.expect(childStem).to.equal(parent, 'mismatched parent for expected siblings');

            return parent;
        });

        chai.expect(stem.type).to.equal(stemType);

        return stem;
    }
}

/** Find the ID of a child from the given root. */
function tryIdFromChild<X>(child: PaneLayout<X>|undefined, root: PaneLayout<X>): ChildLayoutId<X>|
    undefined {
    if (child === undefined) { return undefined; }

    return root.findChild(c => Object.is(c, child));
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
    const leftId   = root.findChildByGravity(LayoutGravity.Header);
    const mainId   = root.findChildByGravity(LayoutGravity.Header);
    const bottomId = root.findChildByGravity(LayoutGravity.Header);
    const rightId  = root.findChildByGravity(LayoutGravity.Header);
    const footerId = root.findChildByGravity(LayoutGravity.Footer);

    const center   = findPseudoGravity(LayoutType.Vert, mainId, bottomId);
    const centerId = tryIdFromChild(center, pane);

    const body   = findPseudoGravity(LayoutType.Horiz, leftId, centerId, rightId);
    const bodyId = tryIdFromChild(body, pane);

    const root2 = findPseudoGravity(LayoutType.Vert, headerId, bodyId, footerId);

    chai.expect(root2).to.equal(pane, 'unexpected root layout');
}

describe('PaneLayout.withChildByGravity', () => {
    it('should be order-independent', () => {
        const gravities: readonly LayoutGravity[] = [
            LayoutGravity.Header,
            LayoutGravity.Left,
            LayoutGravity.Main,
            LayoutGravity.Bottom,
            LayoutGravity.Right,
            LayoutGravity.Footer,
        ];

        fc.assert(fc.property(
            fc.array(fc.nat().noShrink(), gravities.length, gravities.length).map(idcs => {
                const bag = gravities.slice();
                const ret = [];

                for (const idx of idcs) { ret.push(bag.splice(idx % bag.length, 1)[0]); }

                return ret;
            }),
            arr => {
                let layout = new RootLayout(undefined);

                for (let i = 0; i < arr.length; i += 1) {
                    const gravity = arr[i];

                    const next = layout.withChildByGravity(
                        new LeafLayout(`grav${gravity.toString()}`, 'template', undefined),
                        gravity);

                    try {
                        assertProperGravity(next);
                    }
                    catch (e) {
                        throw new Error(`adding panes failed at step ${i + 1} (gravity ${
                            saveLayoutGravity(gravity)}):\n${e}\nCurrent layout: ${
                            JSON.stringify(layout)}\nFailed layout: ${JSON.stringify(next)}`);
                    }

                    layout = next.intoRoot();
                }
            },
            ));

        expect().nothing();
    });
});
