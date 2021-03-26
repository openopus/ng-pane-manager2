/**********************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (pane-template.ts)
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
 *********************************************************************************/

import {TemplateRef} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {ChildLayout} from './pane-layout/module';

// TODO: add size constraints/no-resize mode? Perhaps fixed sizes, too
/** The display format of a pane header */
export const enum PaneHeaderMode {
    /** Don't display a header for this pane */
    Hidden,
    /** Display a basic header for this pane */
    Visible,
    /** Always display a tab bar for this pane, even if it's not tabbed */
    AlwaysTab,
}

/** Stringified versions of the header modes */
export type StringHeaderMode = 'hidden'|'visible'|'alwaysTab';

/**
 * Style information for a pane header.
 */
export type PaneHeaderStyle<T extends PaneHeaderMode = PaneHeaderMode> = BasicPaneHeaderStyle<T>|
    CustomPaneHeaderStyle<T>;

/**
 * Style information for a pane header with no custom widgets.
 */
export interface BasicPaneHeaderStyle<T extends PaneHeaderMode = PaneHeaderMode> {
    /** The display mode for this header */
    headerMode: T;
    /** The title for this header */
    title: Observable<string>;
    /** The icon for this header, or `undefined` for no icon */
    icon: Observable<string|undefined>;
    /** Should always be undefined.  See `CustomPaneHeaderStyle` for more information */
    widgets?: never;
    /** Whether this pane can be closed */
    closable: boolean;
}

/**
 * Style information for a pane header using custom widgets.
 */
export interface CustomPaneHeaderStyle<T extends PaneHeaderMode = PaneHeaderMode> {
    /** The display mode for this header */
    headerMode: T;
    /** The unique string identifier for the widget template to use */
    widgets: string;
    /** Whether this pane can be closed */
    closable: boolean;
}

/**
 * Construct a basic pane header style object.
 * @param header the display mode for the header
 * @param title the title for the header
 * @param icon the icon for the header, or `undefined` for no icon
 * @param closable whether this pane can be closed
 */
export function headerStyle(
    header: StringHeaderMode|PaneHeaderMode,
    title: string|Observable<string>,
    icon: string|undefined|Observable<string|undefined>,
    closable: boolean,
    ): PaneHeaderStyle {
    let headerMode;

    switch (header) {
    case 'hidden': headerMode = PaneHeaderMode.Hidden; break;
    case 'visible': headerMode = PaneHeaderMode.Visible; break;
    case 'alwaysTab': headerMode = PaneHeaderMode.AlwaysTab; break;
    default: headerMode = header; break;
    }

    return {
        headerMode,
        title: typeof title === 'string' ? new BehaviorSubject(title) : title,
        icon: icon === undefined || typeof icon === 'string' ? new BehaviorSubject(icon) : icon,
        closable,
    };
}

/**
 * Context passed to the `TemplateRef` of a leaf node.
 */
export interface LeafNodeContext<X> {
    /** The panel data itself */
    $implicit: {
        /** The header style of this node.  Can be read or written. */
        header: PaneHeaderStyle;
        /** A stream of resize events for the pane associated with this node. */
        readonly onResize: Observable<undefined>;
    };
    /** The layout data for this node */
    extra: X;
}

/**
 * Context passed to the `TemplateRef`s of a set of header widgets.
 */
export interface HeaderWidgetContext<X> {
    /** The widget data itself */
    $implicit: {
        // TODO: who needs what?
    };
    /** The layout data for this node */
    layout: ChildLayout<X>;
}

/** The information needed to render the contents of a leaf node. */
export interface LeafNodeTemplate<X> {
    /** The template for the panel */
    pane: TemplateRef<LeafNodeContext<X>>;
    /** The context provided to both templates when rendering. */
    context: LeafNodeContext<X>;
}

/** The information needed to render custom header widgets for a node. */
export interface HeaderWidgetTemplate<X> {
    /**
     * The controls for the title of the pane.  On a normal pane, this is the
     * left side of the header, and on a tabbed pane, this is the contents of
     * the tab.
     */
    title: TemplateRef<HeaderWidgetContext<X>>;
    /**
     * Additional controls for the pane header.  On a normal pane, this is the
     * right side of the header, and on a tabbed pane, this appears to the right
     * of the tab list, contextual to the current tab.
     */
    controls: TemplateRef<HeaderWidgetContext<X>>;
    /** The context provided to both templates when rendering. */
    context: HeaderWidgetContext<X>;
}

/**
 * Function to determine if two leaf templates are equivalent.
 * @param lhs the first template to compare
 * @param rhs the second template to compare
 * @param extraEq equality comparison function for the extra data
 */
export function sameLeafTemplate<X>(lhs: LeafNodeTemplate<X>|undefined,
                                    rhs: LeafNodeTemplate<X>|undefined,
                                    extraEq: (l: X, r: X) => boolean = Object.is.bind(Object)):
    boolean {
    if (Object.is(lhs, rhs)) { return true; }

    if (lhs === undefined || rhs === undefined) { return false; }

    const {pane: lTmp, context: lCtx} = lhs;
    const {pane: rTmp, context: rCtx} = lhs;

    if (!Object.is(lTmp.elementRef.nativeElement, rTmp.elementRef.nativeElement)) { return false; }

    // TODO: check header?

    if (!extraEq(lCtx.extra, rCtx.extra)) { return false; }

    return true;
}
