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

// TODO: create helper functions to construct common layout templates

/** A template for any kind of layout */
export type LayoutTemplate<T> = SplitLayoutTemplate<T>|TabLayoutTemplate<T>|LeafLayoutTemplate<T>;

/** Stringified versions of the layout gravities */
export type GravityTemplate = 'top'|'left'|'center'|'right'|'bottom';

/**
 * Base interface for all layout node templates.
 */
export interface LayoutTemplateBase {
    /** The gravity of this template */
    gravity?: GravityTemplate;
    /** The group of this template */
    group?: string;
}

/**
 * Template for a leaf layout node.
 */
export interface LeafLayoutTemplate<T> extends LayoutTemplateBase {
    /** Split mode.  Must be undefined, used for type checking. */
    split?: undefined;
    /** The unique identifier of this node */
    id: string;
    /** The template name of this node */
    template: string;
    /** The data for this leaf passed to the template */
    extra: T;
}

/**
 * Template for a split branch layout node.
 */
export interface SplitLayoutTemplate<T> extends LayoutTemplateBase {
    /** Split mode.  Can be `'horiz'` or `'vert'`. */
    split: 'horiz'|'vert';
    /** The ratios of this node's children.  Must match the length of `children`. */
    ratio: number[];
    /** The children of this node */
    children: LayoutTemplate<T>[];
}

/**
 * Template for a tabbed branch layout node.
 */
export interface TabLayoutTemplate<T> extends LayoutTemplateBase {
    /** Split mode.  Must be `'tab'`, used for type checking. */
    split: 'tab';
    /** The currently visible child */
    currentTab: number;
    /** The children of this node */
    children: LayoutTemplate<T>[];
}

/**
 * Convert a string gravity value to a numeric gravity value.
 * @param gravity the string gravity value, or `undefined`
 */
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

/**
 * Load a child layout from a layout template.
 * @param template the layout template to load
 */
export function loadLayout<T, X>(template: LayoutTemplate<T>,
                                 loadExtra: (extra: T) => X): ChildLayout<X> {
    const recurse = (tmpl: LayoutTemplate<T>) => loadLayout(tmpl, loadExtra);

    switch (template.split) {
    case undefined:
        return new LeafLayout(template.id,
                              template.template,
                              loadExtra(template.extra),
                              loadGravity(template.gravity),
                              template.group);
    case 'horiz':
        return new SplitLayout(LayoutType.Horiz,
                               template.children.map(recurse),
                               template.ratio,
                               loadGravity(template.gravity),
                               template.group);
    case 'vert':
        return new SplitLayout(LayoutType.Vert,
                               template.children.map(recurse),
                               template.ratio,
                               loadGravity(template.gravity),
                               template.group);
    case 'tab':
        return new TabbedLayout(template.children.map(recurse),
                                template.currentTab,
                                loadGravity(template.gravity),
                                template.group);
    default: throw new Error(`invalid split type '${(template as any).split}'`);
    }
}

/**
 * Convert a numeric gravity value to a string gravity value.
 * @param gravity the numeric gravity value, or `undefined`
 */
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

/**
 * Save a layout node to a layout template.
 * @param layout the layout node to save
 */
export function saveLayout<X, T>(layout: PaneLayout<X>,
                                 saveExtra: (extra: X) => T): LayoutTemplate<T> {
    const recurse = (pane: PaneLayout<X>) => saveLayout(pane, saveExtra);

    switch (layout.type) {
    case LayoutType.Root:
        if (layout.layout === undefined) { throw new Error('root layout is empty'); }

        return recurse(layout.layout);
    case LayoutType.Leaf:
        return {
            id: layout.id,
            template: layout.template,
            gravity: saveGravity(layout.gravity),
            group: layout.group,
            extra: saveExtra(layout.extra),
        };
    case LayoutType.Horiz:
        return {
            split: 'horiz',
            ratio: layout.ratios.slice(),
            children: layout.children.map(recurse),
            gravity: saveGravity(layout.gravity),
            group: layout.group,
        };
    case LayoutType.Vert:
        return {
            split: 'vert',
            ratio: layout.ratios.slice(),
            children: layout.children.map(recurse),
            gravity: saveGravity(layout.gravity),
            group: layout.group,
        };
    case LayoutType.Tabbed:
        return {
            split: 'tab',
            currentTab: layout.currentTab,
            children: layout.children.map(recurse),
            gravity: saveGravity(layout.gravity),
            group: layout.group,
        };
    }
}
