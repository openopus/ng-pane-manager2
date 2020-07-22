/*****************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (layout-template.spec.ts)
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
 ****************************************************************************************/

// Not sure why this isn't working correctly...
// tslint:disable await-promise no-implicit-dependencies
import fc from 'fast-check';

import {EPSILON} from '../util';

import {LayoutType, PaneLayout} from './layout-core';
import {
    childArb,
    groupArb,
    layoutDepthArb,
    MAX_LAYOUT_FANOUT,
    splitRatiosArb,
} from './layout-core.spec';
import {
    GravityTemplate,
    LayoutTemplate,
    LeafLayoutTemplate,
    loadLayout,
    saveLayout,
    SplitLayoutTemplate,
    TabLayoutTemplate,
} from './layout-template';

// TODO: change these functions to asserts to improve error messages

/** Indicates if two layout templates are equivalent */
function sameTemplate<T>(lhs: LayoutTemplate<T>,
                         rhs: LayoutTemplate<T>,
                         sameExtra: (l: T, r: T) => boolean = sameExtraAny): boolean {
    const anyRhs = rhs as any;

    if (!(Object.is(lhs.split, rhs.split) && Object.is(lhs.gravity, rhs.gravity) &&
          Object.is(lhs.group, rhs.group))) {
        return false;
    }

    if (lhs.split === undefined) {
        return lhs.template === anyRhs.template && lhs.id === anyRhs.id &&
               sameExtra(lhs.extra, anyRhs.extra);
    }

    if (lhs.children.length !== anyRhs.children.length) { return false; }

    for (let i = 0; i < lhs.children.length; i += 1) {
        if (!sameTemplate(lhs.children[i], anyRhs.children[i], sameExtra)) { return false; }
    }

    switch (lhs.split) {
    case 'horiz':
    case 'vert': {
        const lRatioSum = lhs.ratio.reduce((s, e) => s + e, 0);
        const rRatioSum = anyRhs.ratio.reduce((s: number, e: number) => s + e, 0);

        for (let i = 0; i < lhs.ratio.length; i += 1) {
            if (Math.abs(lhs.ratio[i] * rRatioSum - anyRhs.ratio[i] * lRatioSum) > EPSILON) {
                return false;
            }
        }
        break;
    }
    case 'tab':
        if (lhs.currentTab !== anyRhs.currentTab) { return false; }
        break;
    }

    return true;
}

/** Indicates if two layouts are equivalent */
function sameLayout<T>(lhs: PaneLayout<T>,
                       rhs: PaneLayout<T>,
                       sameExtra: (l: T, r: T) => boolean = sameExtraAny): boolean {
    const anyRhs = rhs as any;

    if (!(lhs.type === rhs.type && Object.is(lhs.gravity, rhs.gravity) &&
          Object.is(lhs.group, rhs.group))) {
        return false;
    }

    switch (lhs.type) {
    case LayoutType.Leaf:
        if (!(lhs.template === anyRhs.template) && lhs.id === anyRhs.id &&
            sameExtra(lhs.extra, anyRhs.extra)) {
            return false;
        }
        break;
    case LayoutType.Root:
        if (lhs.layout === undefined || anyRhs.layout === undefined) {
            if (!Object.is(lhs.layout, anyRhs.layout)) { return false; }
        }
        else if (!sameLayout(lhs.layout, anyRhs.layout, sameExtra)) {
            return false;
        }
        break;
    default:
        if (lhs.children.length !== anyRhs.children.length) { return false; }

        for (let i = 0; i < lhs.children.length; i += 1) {
            if (!sameLayout(lhs.children[i], anyRhs.children[i], sameExtra)) { return false; }
        }

        switch (lhs.type) {
        case LayoutType.Horiz:
        case LayoutType.Vert: {
            for (let i = 0; i < lhs.ratios.length; i += 1) {
                if (Math.abs(lhs.ratios[i] * anyRhs.ratioSum - anyRhs.ratios[i] * lhs.ratioSum) >
                    EPSILON) {
                    return false;
                }
            }
            break;
        }
        case LayoutType.Tabbed:
            if (lhs.currentTab !== anyRhs.currentTab) { return false; }
            break;
        }
        break;
    }

    return true;
}

/** Simple baseline equality comparator for the extra tags of a layout template */
function sameExtraAny(lhs: any, rhs: any): boolean {
    if (typeof lhs !== typeof rhs) { return false; }

    if (typeof lhs === 'object') { return JSON.stringify(lhs) === JSON.stringify(rhs); }

    return Object.is(lhs, rhs);
}

/** Produces a random layout template gravity */
export const gravityTemplateArb: fc.Arbitrary<GravityTemplate|undefined> = fc.oneof(
    fc.constant(undefined),
    fc.constant<GravityTemplate>('top'),
    fc.constant<GravityTemplate>('left'),
    fc.constant<GravityTemplate>('center'),
    fc.constant<GravityTemplate>('right'),
    fc.constant<GravityTemplate>('bottom'),
);

/**
 * Produces a random layout template.
 *
 * Note that all layout templates correspond to child nodes.
 */
export const layoutTemplateArb: fc.Memo<LayoutTemplate<any>> = fc.memo(n => {
    if (n <= 1) { return leafTemplateArb; }

    return fc.oneof(leafTemplateArb, splitTemplateArb(n), tabTemplateArb(n));
});

/**
 * Produces a leaf node template with random template, ID, and extra.
 */
export const leafTemplateArb: fc.Arbitrary<LeafLayoutTemplate<any>> = fc.record({
    id: fc.string(),
    template: fc.string(),
    extra: fc.anything(),
    gravity: gravityTemplateArb,
    group: groupArb,
});

/**
 * Produces a split branch template with generated children and ratios.
 */
export const splitTemplateArb: fc.Memo<SplitLayoutTemplate<any>> = fc.memo(_n => {
    return fc.array(layoutTemplateArb(), MAX_LAYOUT_FANOUT).chain(children => fc.record({
        split: fc.oneof(fc.constant<'horiz'|'vert'>('horiz'), fc.constant<'horiz'|'vert'>('vert')),
        children: fc.constant(children),
        ratio: splitRatiosArb(children.length),
        gravity: gravityTemplateArb,
        group: groupArb,
    }));
});

/**
 * Produces a tabbed branch template with generated children.
 */
export const tabTemplateArb: fc.Memo<TabLayoutTemplate<any>> = fc.memo(_n => {
    return fc.array(layoutTemplateArb(), MAX_LAYOUT_FANOUT).chain(children => fc.record({
        split: fc.constant('tab'),
        children: fc.constant(children),
        currentTab: fc.integer(0, Math.max(0, children.length - 1)),
        gravity: gravityTemplateArb,
        group: groupArb,
    }));
});

describe('LayoutTemplate', () => {
    it('should be equal when loaded and saved', async () => {
        jasmine.addCustomEqualityTester(sameTemplate);

        await fc.assert(
            fc.asyncProperty(layoutDepthArb.chain(layoutTemplateArb), async template => {
                await expect(saveLayout(loadLayout(template, x => x), x => x)).toEqual(template);
            }));
    });

    it('should be equal when a child layout is saved and loaded', async () => {
        jasmine.addCustomEqualityTester(sameLayout);

        await fc.assert(fc.asyncProperty(layoutDepthArb.chain(childArb), async child => {
            await expect(loadLayout(saveLayout(child, x => x), x => x)).toEqual(child);
        }));
    });

    it('should be equal when a root layout is saved and loaded', async () => {
        jasmine.addCustomEqualityTester(sameLayout);

        await fc.assert(
            fc.asyncProperty(layoutDepthArb.chain(childArb).map(c => c.intoRoot()), async root => {
                await expect(loadLayout(saveLayout(root, x => x), x => x).intoRoot()).toEqual(root);
            }));
    });
});
