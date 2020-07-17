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
export interface PaneHeaderStyle<T extends PaneHeaderMode = PaneHeaderMode> {
    /** The display mode for this header */
    headerMode: T;
    /** The title for this header */
    title: Observable<string>;
    /** The icon for this header, or `undefined` for no icon */
    icon: Observable<string|undefined>;
    /** Whether this pane can be closed */
    closable: boolean;
}

/**
 * Construct a pane header style object.
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
        title: typeof                      title === 'string' ? new BehaviorSubject(title) : title,
        icon: icon === undefined || typeof icon === 'string' ? new BehaviorSubject(icon) : icon,
        closable,
    };
}

/**
 * Context passed to the `TemplateRef` of a leaf node.
 */
export interface LeafNodeContext<X> {
    /** The header style of this node */
    header: PaneHeaderStyle;
    /** The layout data for this node */
    extra: X;
}

/** The information needed to render the contents of a leaf node. */
export type LeafNodeTemplate<X> = [TemplateRef<LeafNodeContext<X>>, LeafNodeContext<X>];
