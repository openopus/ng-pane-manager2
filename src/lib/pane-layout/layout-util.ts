/********************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (layout-util.ts)
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

import { LayoutType } from './layout-base';
import { ChildLayout, StemLayout } from './layout-core';

/**
 * A reference to a layout node via the parent containing it.
 */
export interface ChildLayoutId<X, S extends StemLayout<X> = StemLayout<X>> {
    /** The stem containing the target node */
    stem: S;
    /** The index of the target node */
    index: number;
}

/**
 * A child layout ID, stored with a child guaranteed to match the ID.
 */
export class ChildWithId<X, C extends ChildLayout<X> = ChildLayout<X>> {
    /**
     * Retrieve the child referenced by the given ID.
     * @param id the layout ID to retrieve the child from
     */
    public static fromId<X>(id: ChildLayoutId<X>): ChildWithId<X> {
        return new ChildWithId(childFromId(id), id);
    }

    /**
     * Construct a new child-ID pair
     * @param child the child referenced by the ID
     * @param id the ID referencing a child
     */

    private constructor(
        public readonly child: C,
        public readonly id: ChildLayoutId<X>,
    ) {}
}

/**
 * Retrieve the child referenced by a layout ID.
 * @param id the ID of the child layout
 */
export function childFromId<X>({ stem, index }: ChildLayoutId<X>): ChildLayout<X> {
    switch (stem.type) {
        case LayoutType.Root: {
            if (stem.layout === undefined) {
                throw new Error('root layout is empty');
            }

            if (index !== 0) {
                throw new Error(`invalid root child index ${index} - must be 0`);
            }

            return stem.layout;
        }
        case LayoutType.Group: {
            if (stem.split === undefined) {
                throw new Error('group layout is empty');
            }

            if (index !== 0) {
                throw new Error(`invalid group child index ${index} - must be 0`);
            }

            return stem.split;
        }
        default:
            return stem.children[index];
    }
}

/**
 * Verify the given child ID is valid.
 * @param id the ID of the child layout
 */
export function childIdValid<X>({ stem, index }: ChildLayoutId<X>): boolean {
    switch (stem.type) {
        case LayoutType.Root:
            return stem.layout !== undefined && index === 0;
        case LayoutType.Group:
            return stem.split !== undefined && index === 0;
        default:
            return index >= 0 && stem.children.length > index;
    }
}
