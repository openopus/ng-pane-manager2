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

import { SplitLayout, TabbedLayout } from './branch-layout';
import { LayoutGravity, LayoutType } from './layout-base';
import { ChildLayout, GroupLayout, LeafLayout, PaneLayout } from './layout-core';

/** A template for any kind of layout */
export type LayoutTemplate<T> =
    | GroupLayoutTemplate<T>
    | SplitLayoutTemplate<T>
    | TabLayoutTemplate<T>
    | LeafLayoutTemplate<T>;

/** Stringified versions of the layout gravities */
export type GravityTemplate = 'header' | 'left' | 'main' | 'bottom' | 'right' | 'footer';

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
    /** Disallows `split` as a property name.  Used for type checking. */
    split?: never;
    /** The unique identifier of this node */
    id: string;
    /** The template name of this node */
    template: string;
    /** The data for this leaf passed to the template */
    extra: T;
}

/**
 * Template for a grouped split layout node.
 */
export interface GroupLayoutTemplate<T> extends LayoutTemplateBase {
    /** Split mode.  Must be `'group'`, used for type checking. */
    split: 'group';
    /** The child split node of this group node */
    child: SplitLayoutTemplate<T> | undefined;
    /** The template name of this node's header */
    header: string;
}

/**
 * Template for a split branch layout node.
 */
export interface SplitLayoutTemplate<T> extends LayoutTemplateBase {
    /** Split mode.  Can be `'horiz'` or `'vert'`. */
    split: 'horiz' | 'vert';
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
export function loadLayoutGravity(gravity: GravityTemplate | undefined): LayoutGravity | undefined {
    switch (gravity) {
        case undefined:
            return undefined;
        case 'header':
            return LayoutGravity.Header;
            break;
        case 'left':
            return LayoutGravity.Left;
            break;
        case 'main':
            return LayoutGravity.Main;
            break;
        case 'bottom':
            return LayoutGravity.Bottom;
            break;
        case 'right':
            return LayoutGravity.Right;
            break;
        case 'footer':
            return LayoutGravity.Footer;
            break;
        default:
            throw new Error(`invalid layout gravity '${gravity}'`);
    }
}

/**
 * Load a child layout from a layout template.
 * @param template the layout template to load
 */
export function loadLayout<T, X>(
    template: LayoutTemplate<T>,
    loadExtra: (extra: T) => X,
): ChildLayout<X> {
    const recurse = (next: LayoutTemplate<T>) => loadLayout(next, loadExtra);

    switch (template.split) {
        case undefined:
            return new LeafLayout(
                template.id,
                template.template,
                loadExtra(template.extra),
                loadLayoutGravity(template.gravity),
                template.group,
            );
        case 'group':
            const split = template.child !== undefined ? recurse(template.child) : undefined;

            if (
                !(
                    split === undefined ||
                    split.type === LayoutType.Horiz ||
                    split.type === LayoutType.Vert
                )
            ) {
                throw new Error('invalid child for grouped split template');
            }

            return new GroupLayout(
                split,
                template.header,
                loadLayoutGravity(template.gravity),
                template.group,
            );
        case 'horiz':
            return new SplitLayout(
                LayoutType.Horiz,
                template.children.map(recurse),
                template.ratio,
                loadLayoutGravity(template.gravity),
                template.group,
            );
        case 'vert':
            return new SplitLayout(
                LayoutType.Vert,
                template.children.map(recurse),
                template.ratio,
                loadLayoutGravity(template.gravity),
                template.group,
            );
        case 'tab':
            return new TabbedLayout(
                template.children.map(recurse),
                template.currentTab,
                loadLayoutGravity(template.gravity),
                template.group,
            );
        default:
            throw new Error(`invalid split type '${(template as any).split}'`);
    }
}

/**
 * Convert a numeric gravity value to a string gravity value.
 * @param gravity the numeric gravity value, or `undefined`
 */
export function saveLayoutGravity(gravity: LayoutGravity | undefined): GravityTemplate | undefined {
    switch (gravity) {
        case undefined:
            return undefined;
        case LayoutGravity.Header:
            return 'header';
            break;
        case LayoutGravity.Left:
            return 'left';
            break;
        case LayoutGravity.Main:
            return 'main';
            break;
        case LayoutGravity.Bottom:
            return 'bottom';
            break;
        case LayoutGravity.Right:
            return 'right';
            break;
        case LayoutGravity.Footer:
            return 'footer';
            break;
    }
}

/**
 * Save a layout node to a layout template.
 * @param layout the layout node to save
 */
export function saveLayout<X, T>(
    layout: PaneLayout<X>,
    saveExtra: (extra: X) => T,
): LayoutTemplate<T> {
    const recurse = (pane: PaneLayout<X>) => saveLayout(pane, saveExtra);

    switch (layout.type) {
        case LayoutType.Root:
            if (layout.layout === undefined) {
                throw new Error('root layout is empty');
            }

            return recurse(layout.layout);
        case LayoutType.Group:
            const child = layout.split !== undefined ? recurse(layout.split) : undefined;

            if (!(child === undefined || child.split === 'horiz' || child.split === 'vert')) {
                throw new Error("invalid grouped split node - this shouldn't happen");
            }

            return {
                split: 'group',
                child,
                header: layout.headerWidgetId,
                gravity: saveLayoutGravity(layout.gravity),
                group: layout.group,
            };
        case LayoutType.Leaf:
            return {
                id: layout.id,
                template: layout.template,
                gravity: saveLayoutGravity(layout.gravity),
                group: layout.group,
                extra: saveExtra(layout.extra),
            };
        case LayoutType.Horiz:
            return {
                split: 'horiz',
                ratio: layout.ratios.slice(),
                children: layout.children.map(recurse),
                gravity: saveLayoutGravity(layout.gravity),
                group: layout.group,
            };
        case LayoutType.Vert:
            return {
                split: 'vert',
                ratio: layout.ratios.slice(),
                children: layout.children.map(recurse),
                gravity: saveLayoutGravity(layout.gravity),
                group: layout.group,
            };
        case LayoutType.Tabbed:
            return {
                split: 'tab',
                currentTab: layout.currentTab,
                children: layout.children.map(recurse),
                gravity: saveLayoutGravity(layout.gravity),
                group: layout.group,
            };
    }
}
