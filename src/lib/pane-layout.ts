/****************************************************************************
 *
 * ng-pane-manager2 - a port of ng-pane-manager to Angular 2+ (pane-layout.ts)
 * Copyright (C) 2019 Opus Logica
 *
 * ng-pane-manager2 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * ng-pane-manager2 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with ng-pane-manager2.  If not, see <https://www.gnu.org/licenses/>.
 *
 ***************************************************************************/

import {TemplateRef} from '@angular/core';

export type PaneLayout = BranchLayout|LeafLayout;

export enum LayoutType {
    Horiz,
    Vert,
    Tabbed,
    Leaf,
}

export enum LayoutGravity {
    Center,
    Left,
    Right,
    Top,
    Bottom,
}

export class LayoutBase {
    constructor(public readonly gravity?: LayoutGravity, public readonly group?: string) {}
}

export class BranchLayout extends LayoutBase {
    constructor(public readonly type: LayoutType.Horiz|LayoutType.Vert|LayoutType.Tabbed,
                private children: PaneLayout[],
                private ratios?: number[],
                private currentTabIndex?: number,
                gravity?: LayoutGravity,
                group?: string) {
        super(gravity, group);
    }

    getChildren(): Readonly<PaneLayout[]> { return this.children; }
    getRatios(): Readonly<number[]> { return this.ratios; }
    getCurrentTabIndex(): number { return this.currentTabIndex; }

    // TODO: send an event when children are modified

    replaceChild(index: number, child: PaneLayout) { this.children[index] = child; }
}

export class LeafLayout extends LayoutBase {
    public readonly type: LayoutType.Leaf = LayoutType.Leaf;
    // TODO: each pane should have control of title, icon, closeable, and alwaysTab

    constructor(public readonly id: string,
                public readonly template: string,
                gravity?: LayoutGravity,
                group?: string) {
        super(gravity, group);
    }
}

export type LayoutTemplate = BranchLayoutTemplate|LeafLayoutTemplate;

export interface LayoutTemplateBase {
    gravity?: 'center'|'left'|'right'|'top'|'bottom';
    group?: string;
}

export interface BranchLayoutTemplate extends LayoutTemplateBase {
    split: 'horiz'|'vert'|'tab';
    ratio?: number|number[];
    currentTab?: number;
    children: LayoutTemplate[];
}

export interface LeafLayoutTemplate extends LayoutTemplateBase {
    id: string;
    template: string;
}

export function loadLayout(template: LayoutTemplate): PaneLayout {
    let gravity: LayoutGravity;

    if (template.gravity) {
        switch (template.gravity) {
        case 'center': gravity = LayoutGravity.Center; break;
        case 'left': gravity = LayoutGravity.Left; break;
        case 'right': gravity = LayoutGravity.Right; break;
        case 'top': gravity = LayoutGravity.Top; break;
        case 'bottom': gravity = LayoutGravity.Bottom; break;
        }
    }

    if ((template as any).split) {
        const branch = template as BranchLayoutTemplate;

        let type: LayoutType.Horiz|LayoutType.Vert|LayoutType.Tabbed;

        switch (branch.split) {
        case 'horiz': type = LayoutType.Horiz; break;
        case 'vert': type = LayoutType.Vert; break;
        case 'tab': type = LayoutType.Tabbed; break;
        }

        let ratios: number[];

        if (branch.ratio) {
            switch (typeof branch.ratio) {
            case 'number': ratios = [branch.ratio]; break;
            case 'object': ratios = branch.ratio; break;
            }
        }
        else
            ratios = null;

        return new BranchLayout(type,
                                branch.children.map(child => loadLayout(child)),
                                ratios,
                                branch.currentTab,
                                gravity,
                                branch.group);
    }
    else {
        const leaf = template as LeafLayoutTemplate;

        return new LeafLayout(leaf.id, leaf.template, gravity, leaf.group);
    }
}

export function saveLayout(layout: PaneLayout): any {
    let gravity: 'center'|'left'|'right'|'top'|'bottom';

    if (layout.gravity != null) {
        switch (layout.gravity) {
        case LayoutGravity.Center: gravity = 'center'; break;
        case LayoutGravity.Left: gravity = 'left'; break;
        case LayoutGravity.Right: gravity = 'right'; break;
        case LayoutGravity.Top: gravity = 'top'; break;
        case LayoutGravity.Bottom: gravity = 'bottom'; break;
        }
    }

    switch (layout.type) {
    case LayoutType.Horiz:
    case LayoutType.Vert:
    case LayoutType.Tabbed: {
        let split: 'horiz'|'vert'|'tab';

        switch (layout.type) {
        case LayoutType.Horiz: split = 'horiz'; break;
        case LayoutType.Vert: split = 'vert'; break;
        case LayoutType.Tabbed: split = 'tab'; break;
        }

        return <BranchLayoutTemplate>{
            split,
            ratio: layout.getRatios(),
            currentTab: layout.getCurrentTabIndex(),
            children: layout.getChildren().map(child => saveLayout(child)),
            gravity,
            group: layout.group,
        };

        break;
    }
    case LayoutType.Leaf:
        return <LeafLayoutTemplate>{
            id: layout.id,
            template: layout.template,
            gravity,
            group: layout.group,
        };

        break;
    }
}

// export function collapseLayout(layout: PaneLayout) {
//     if (layout.type === LayoutType.Leaf) return layout;

//     const branch   = layout as BranchLayout;
//     const children = branch.getChildren();

//     for (let i = 0; i < children.length; ++i) {
//         branch.replaceChild(i, collapseLayout(children[i]));
//     }

//     if (children.length === 1) return children[0];

//     // TODO: collapse split layouts with identical orientations

//     return branch;
// }