/************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (layout-template.ts)
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
 ***********************************************************************************/

import {SplitLayout, TabbedLayout} from './branch-layout';
import {ChildLayout, LayoutGravity, LayoutType, LeafLayout, PaneLayout} from './layout-core';

export type LayoutTemplate = SplitLayoutTemplate|TabLayoutTemplate|LeafLayoutTemplate;

export type GravityTemplate = 'top'|'left'|'center'|'right'|'bottom';

export interface LayoutTemplateBase {
    gravity?: GravityTemplate;
    group?: string;
}

export interface LeafLayoutTemplate extends LayoutTemplateBase {
    split?: undefined;
    id: string;
    template: string;
}

export interface SplitLayoutTemplate extends LayoutTemplateBase {
    split: 'horiz'|'vert';
    ratio: number[];
    children: LayoutTemplate[];
}

export interface TabLayoutTemplate extends LayoutTemplateBase {
    split: 'tab';
    currentTab: number;
    children: LayoutTemplate[];
}

function loadGravity(gravity: GravityTemplate|undefined): LayoutGravity|undefined {
    switch (gravity) {
    case undefined: return undefined;
    case 'center': return LayoutGravity.Center; break;
    case 'left': return LayoutGravity.Left; break;
    case 'right': return LayoutGravity.Right; break;
    case 'top': return LayoutGravity.Top; break;
    case 'bottom': return LayoutGravity.Bottom; break;
    default: throw new Error(`invalid layout gravity '${gravity}'`);
    }
}

export function loadLayout(template: LayoutTemplate): ChildLayout {
    switch (template.split) {
    case undefined:
        return new LeafLayout(template.id,
                              template.template,
                              loadGravity(template.gravity),
                              template.group);
    case 'horiz':
        return new SplitLayout(LayoutType.Horiz,
                               template.children.map(loadLayout),
                               template.ratio,
                               loadGravity(template.gravity),
                               template.group);
    case 'vert':
        return new SplitLayout(LayoutType.Vert,
                               template.children.map(loadLayout),
                               template.ratio,
                               loadGravity(template.gravity),
                               template.group);
    case 'tab':
        return new TabbedLayout(template.children.map(loadLayout),
                                template.currentTab,
                                loadGravity(template.gravity),
                                template.group);
    default: throw new Error(`invalid split type '${(template as any).split}'`);
    }
}

function saveGravity(gravity: LayoutGravity|undefined): GravityTemplate|undefined {
    switch (gravity) {
    case undefined: return undefined;
    case LayoutGravity.Center: return 'center'; break;
    case LayoutGravity.Left: return 'left'; break;
    case LayoutGravity.Right: return 'right'; break;
    case LayoutGravity.Top: return 'top'; break;
    case LayoutGravity.Bottom: return 'bottom'; break;
    }
}

export function saveLayout(layout: PaneLayout): LayoutTemplate {
    switch (layout.type) {
    case LayoutType.Root: return saveLayout(layout.layout);
    case LayoutType.Leaf:
        return {
            id: layout.id,
            template: layout.template,
            gravity: saveGravity(layout.gravity),
            group: layout.group,
        };
    case LayoutType.Horiz:
        return {
            split: 'horiz',
            ratio: layout.ratios.slice(),
            children: layout.children.map(saveLayout),
            gravity: saveGravity(layout.gravity),
            group: layout.group,
        };
    case LayoutType.Vert:
        return {
            split: 'vert',
            ratio: layout.ratios.slice(),
            children: layout.children.map(saveLayout),
            gravity: saveGravity(layout.gravity),
            group: layout.group,
        };
    case LayoutType.Tabbed:
        return {
            split: 'tab',
            currentTab: layout.currentTab,
            children: layout.children.map(saveLayout),
            gravity: saveGravity(layout.gravity),
            group: layout.group,
        };
    }
}
