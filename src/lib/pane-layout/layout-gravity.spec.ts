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

import { EPSILON } from '../util';

import { LayoutGravity, LayoutType } from './layout-base';
import { ChildLayout, LeafLayout, PaneLayout, RootLayout } from './layout-core';
import { childArb, layoutDepthArb } from './layout-core.spec';
import { saveLayout, saveLayoutGravity } from './layout-template';
import { childFromId, ChildLayoutId } from './layout-util';

/** Find the element with the pseudo-gravity described by its expected child nodes. */
function findPseudoGravity<X>(
    stemType: LayoutType,
    // tslint:disable-next-line trailing-comma
    ...children: (ChildLayoutId<X> | undefined)[]
): PaneLayout<X> | undefined {
    const defined = children.filter(c => c !== undefined) as ChildLayoutId<X>[];

    switch (defined.length) {
        case 0:
            return undefined;
        case 1:
            return childFromId(defined[0]);
        default:
            defined.reduce((index, id) => {
                chai.expect(id.index).to.be.greaterThan(
                    index,
                    'mismatched order for expected siblings',
                );

                return id.index;
            }, -1);

            const stem = defined
                .map(d => d.stem)
                .reduce((parent, childStem) => {
                    chai.expect(childStem).to.equal(
                        parent,
                        'mismatched parent for expected siblings',
                    );

                    return parent;
                });

            chai.expect(stem.type).to.equal(stemType, 'unexpected stem type');

            return stem;
    }
}

/** Find the ID of a child from the given root. */
function tryIdFromChild<X>(
    child: PaneLayout<X> | undefined,
    root: PaneLayout<X>,
): ChildLayoutId<X> | undefined {
    if (child === undefined || child.type === LayoutType.Root) {
        return undefined;
    }

    return root.idFromChild(child);
}

/**
 * Assert that a layout node generated using withChildByGravity has the proper
 * structure.
 * @param prev the previous pane
 * @param next the pane to check
 */
function assertProperGravity<X>(_prev: RootLayout<X>, next: RootLayout<X>): void {
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

    const headerId = next.findChildByGravity(LayoutGravity.Header);
    const leftId = next.findChildByGravity(LayoutGravity.Left);
    const mainId = next.findChildByGravity(LayoutGravity.Main);
    const bottomId = next.findChildByGravity(LayoutGravity.Bottom);
    const rightId = next.findChildByGravity(LayoutGravity.Right);
    const footerId = next.findChildByGravity(LayoutGravity.Footer);

    const center = findPseudoGravity(LayoutType.Vert, mainId, bottomId);
    const centerId = tryIdFromChild(center, next);

    const body = findPseudoGravity(LayoutType.Horiz, leftId, centerId, rightId);
    const bodyId = tryIdFromChild(body, next);

    const root2 = findPseudoGravity(LayoutType.Vert, headerId, bodyId, footerId);

    chai.expect(root2).to.equal(next.layout, 'unexpected root layout');

    // tslint:disable no-magic-numbers
    if (headerId !== undefined && bodyId !== undefined) {
        if (headerId.stem.type === LayoutType.Vert) {
            chai.expect(headerId.stem.ratios[headerId.index] * 5, 'bad header ratio').to.be.closeTo(
                headerId.stem.ratioSum * 1,
                EPSILON * headerId.stem.ratioSum,
            );
        } else {
            chai.assert(false, 'encountered unexpected headerId split type');
        }
    }

    if (leftId !== undefined && centerId !== undefined) {
        if (leftId.stem.type === LayoutType.Horiz) {
            chai.expect(leftId.stem.ratios[leftId.index] * 4, 'bad left ratio').to.be.closeTo(
                leftId.stem.ratioSum * 1,
                EPSILON * leftId.stem.ratioSum,
            );
        } else {
            chai.assert(false, 'encountered unexpected leftId split type');
        }
    }

    if (bottomId !== undefined && mainId !== undefined) {
        if (bottomId.stem.type === LayoutType.Vert) {
            chai.expect(bottomId.stem.ratios[bottomId.index] * 3, 'bad bottom ratio').to.be.closeTo(
                bottomId.stem.ratioSum * 1,
                EPSILON * bottomId.stem.ratioSum,
            );
        } else {
            chai.assert(false, 'encountered unexpected bottomId split type');
        }
    }

    if (rightId !== undefined && centerId !== undefined) {
        if (rightId.stem.type === LayoutType.Horiz) {
            chai.expect(rightId.stem.ratios[rightId.index] * 4, 'bad right ratio').to.be.closeTo(
                rightId.stem.ratioSum * 1,
                EPSILON * rightId.stem.ratioSum,
            );
        } else {
            chai.assert(false, 'encountered unexpected rightId split type');
        }
    }

    if (footerId !== undefined && bodyId !== undefined) {
        if (footerId.stem.type === LayoutType.Vert) {
            chai.expect(
                footerId.stem.ratios[footerId.index] * 10,
                'bad footer ratio',
            ).to.be.closeTo(footerId.stem.ratioSum * 1, EPSILON * footerId.stem.ratioSum);
        } else {
            chai.assert(false, 'encountered unexpected footerId split type');
        }
    }

    // Special cases

    if (leftId !== undefined && rightId !== undefined && centerId === undefined) {
        chai.expect(leftId.stem, 'left-right stems should be equal').to.equal(rightId.stem);

        if (leftId.stem.type === LayoutType.Horiz) {
            chai.expect(
                leftId.stem.ratios[leftId.index] * 2,
                'bad left ratio of left-right pair',
            ).to.be.closeTo(leftId.stem.ratioSum, EPSILON * leftId.stem.ratioSum);

            chai.expect(
                leftId.stem.ratios[rightId.index] * 2,
                'bad right ratio of left-right pair',
            ).to.be.closeTo(leftId.stem.ratioSum, EPSILON);
        } else {
            chai.assert(false, 'encountered unexpected left-right split type');
        }
    }

    if (headerId !== undefined && footerId !== undefined && bodyId === undefined) {
        chai.expect(headerId.stem, 'header-footer stems should be equal').to.equal(footerId.stem);

        if (headerId.stem.type === LayoutType.Vert) {
            chai.expect(
                headerId.stem.ratios[headerId.index] * 10,
                'bad header ratio of header-footer pair',
            ).to.be.closeTo(headerId.stem.ratioSum * 9, EPSILON * headerId.stem.ratioSum);

            chai.expect(
                headerId.stem.ratios[footerId.index] * 10,
                'bad footer ratio of header-footer pair',
            ).to.be.closeTo(headerId.stem.ratioSum, EPSILON * headerId.stem.ratioSum);
        } else {
            chai.assert(false, 'encountered unexpected header-footer-split type');
        }
    }
    // tslint:enable no-magic-numbers
}

/**
 * Assert that adding a pane by gravity did not introduce any new bad ratios.
 * @param prev the previous pane
 * @param next the pane to check
 */
function assertNoBadRatios<X>(prev: RootLayout<X>, next: RootLayout<X>): void {
    const TINY = 0.1;
    const HUGE = 1e3;

    const findBad = (pane: PaneLayout<X>, tiny: number[], huge: number[]): void => {
        switch (pane.type) {
            case LayoutType.Leaf:
                break;
            case LayoutType.Root:
                if (pane.layout !== undefined) {
                    findBad(pane.layout, tiny, huge);
                }
                break;
            case LayoutType.Group:
                if (pane.split !== undefined) {
                    findBad(pane.split, tiny, huge);
                }
                break;
            case LayoutType.Horiz:
                for (const [child, ratio] of pane.children.map(
                    (c, i) => [c, pane.ratios[i]] as [ChildLayout<X>, number],
                )) {
                    if (ratio > HUGE) {
                        huge.push(ratio);
                    }

                    if (ratio < (TINY * pane.ratioSum) / pane.children.length) {
                        tiny.push(ratio);
                    }

                    findBad(child, tiny, huge);
                }
                break;
            case LayoutType.Vert:
                for (const [child, ratio] of pane.children.map(
                    (c, i) => [c, pane.ratios[i]] as [ChildLayout<X>, number],
                )) {
                    if (ratio > HUGE) {
                        huge.push(ratio);
                    }

                    if (ratio < (TINY * pane.ratioSum) / pane.children.length) {
                        tiny.push(ratio);
                    }

                    findBad(child, tiny, huge);
                }
                break;
            case LayoutType.Tabbed:
                for (const child of pane.children) {
                    findBad(child, tiny, huge);
                }
                break;
        }
    };

    const [prevTiny, prevHuge] = [[], []];
    const [nextTiny, nextHuge] = [[], []];

    findBad(prev, prevTiny, prevHuge);
    findBad(next, nextTiny, nextHuge);

    chai.expect(
        nextHuge.length,
        `layout change introduced a huge ratio: ${JSON.stringify(nextHuge)} vs ${JSON.stringify(
            prevHuge,
        )}`,
    ).not.to.be.greaterThan(prevHuge.length);

    chai.expect(
        nextTiny.length,
        `layout change introduced a tiny ratio: ${JSON.stringify(nextTiny)} vs ${JSON.stringify(
            prevTiny,
        )}`,
    ).not.to.be.greaterThan(prevTiny.length);
}

/**
 * Assert adding panes to an empty layout by gravity works.
 * @param start the layout to begin with
 * @param gravs the gravities to add panes by
 * @param check the function to check new layouts with
 * @param assertDefined whether withChildByGravity returning undefined should be
 *                      ignored or counted as a failure
 */
function assertAddByGravity(
    start: RootLayout<undefined>,
    gravs: LayoutGravity[],
    check: (prev: RootLayout<undefined>, next: RootLayout<undefined>) => void,
    assertDefined: boolean,
): void {
    let layout = start;

    for (let i = 0; i < gravs.length; i += 1) {
        const gravity = gravs[i];
        let next;

        try {
            next = layout.withChildByGravity(
                new LeafLayout(`grav${gravity.toString()}`, 'template', undefined, gravity),
            );

            if (next !== undefined) {
                const nextRoot = next.intoRoot();

                check(layout, nextRoot);
                layout = nextRoot;
            } else {
                if (assertDefined) {
                    chai.assert(false, 'withChildByGravity() failed');
                }

                break;
            }
        } catch (e) {
            throw new Error(
                `adding panes failed at step ${i + 1} (gravity ${saveLayoutGravity(
                    gravity,
                )}):\n${e}\nCurrent layout: ${JSON.stringify(
                    saveLayout(layout, x => x),
                )}\nFailed layout: ${JSON.stringify(
                    next !== undefined ? saveLayout(next, x => x) : next,
                )}`,
            );
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
        fc.assert(
            fc.property(
                fc.array(fc.nat().noShrink(), GRAVITIES.length, GRAVITIES.length).map(idcs => {
                    const bag = GRAVITIES.slice();
                    const ret = [];

                    for (const idx of idcs) {
                        ret.push(bag.splice(idx % bag.length, 1)[0]);
                    }

                    return ret;
                }),
                gravs => {
                    assertAddByGravity(new RootLayout(undefined), gravs, assertProperGravity, true);
                },
            ),
        );

        expect().nothing();
    });

    it('should function correctly for any number of panels', () => {
        fc.assert(
            fc.property(fc.array(fc.oneof(...GRAVITIES.map(g => fc.constant(g)))), gravs => {
                assertAddByGravity(new RootLayout(undefined), gravs, assertProperGravity, true);
            }),
        );

        expect().nothing();
    });

    it('should not create very small or very big ratios', () => {
        fc.assert(
            fc.property(
                layoutDepthArb.chain(childArb).map(c => c.intoRoot()),
                fc.array(fc.oneof(...GRAVITIES.map(g => fc.constant(g)))),
                (layout, gravs) => {
                    assertAddByGravity(layout, gravs, assertNoBadRatios, false);
                },
            ),
        );

        expect().nothing();
    });
});
