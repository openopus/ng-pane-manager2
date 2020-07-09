import {LayoutGravity, PaneLayout} from './layout-core';

export abstract class LayoutBase {
    constructor(readonly gravity: LayoutGravity|undefined, readonly group: string|undefined) {}

    abstract transposeDeep(find: PaneLayout, replace: PaneLayout): PaneLayout|undefined;

    abstract simplifyDeep(): PaneLayout|undefined;
}
