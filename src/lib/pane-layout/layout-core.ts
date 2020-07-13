/********************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (layout-core.ts)
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

import {BranchLayout} from './branch-layout';
import {LayoutBase} from './layout-base';

export type PaneLayout  = RootLayout|BranchLayout|LeafLayout;
export type StemLayout  = RootLayout|BranchLayout;
export type ChildLayout = BranchLayout|LeafLayout;

export const enum LayoutType {
    Root,
    Horiz,
    Vert,
    Tabbed,
    Leaf,
}

export const enum LayoutGravity {
    Top,
    Left,
    Center,
    Right,
    Bottom,
}

export interface ChildLayoutId {
    stem: StemLayout;
    index: number;
}

export interface ChildWithId {
    child: ChildLayout;
    id: ChildLayoutId;
}

export function childFromId({stem, index}: ChildLayoutId): ChildLayout {
    if (stem.type === LayoutType.Root) {
        if (index !== 0) throw new Error(`invalid root child index ${index} - must be 0`);

        return stem.layout;
    }

    return stem.children[index];
}

export function childWithId(id: ChildLayoutId): ChildWithId { return {child: childFromId(id), id}; }

export class RootLayout extends LayoutBase {
    readonly type: LayoutType.Root = LayoutType.Root;

    constructor(readonly layout: ChildLayout) { super(undefined, undefined); }

    childId(): ChildLayoutId { return {stem: this, index: 0}; }

    transposeDeep(find: PaneLayout, replace: PaneLayout): PaneLayout|undefined {
        if (this === find) return replace;

        const newLayout = this.layout.transposeDeep(find, replace);

        if (newLayout === undefined) return undefined;

        if (newLayout.type === LayoutType.Root)
            throw new Error('invalid transposition - child attempted to become root');

        return new RootLayout(newLayout);
    }

    simplifyDeep(): PaneLayout|undefined {
        const newLayout = this.layout.simplifyDeep();

        if (newLayout === undefined) return undefined;

        if (newLayout.type === LayoutType.Root)
            throw new Error('invalid simplification - child attempted to become root');

        return new RootLayout(newLayout);
    }
}

export class LeafLayout extends LayoutBase {
    readonly type: LayoutType.Leaf = LayoutType.Leaf;

    constructor(readonly id: string,
                readonly template: string,
                gravity?: LayoutGravity,
                group?: string) {
        super(gravity, group);
    }

    intoRoot(): RootLayout { return new RootLayout(this); }

    transposeDeep(find: PaneLayout, replace: PaneLayout): PaneLayout|undefined {
        return this === find ? replace : undefined;
    }

    simplifyDeep(): PaneLayout|undefined { return undefined; }
}
