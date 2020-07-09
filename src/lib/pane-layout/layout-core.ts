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
