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

// TODO: prevent tabifying headerless panes
// TODO: add size constraints/no-resize mode?
export const enum PaneHeaderMode {
    Hidden,
    Visible,
    AlwaysTab,
}

export type StringHeaderMode = 'hidden'|'visible'|'alwaysTab';

export interface PaneHeaderStyle {
    headerMode: PaneHeaderMode;
    title: Observable<string>;
    icon: Observable<string|undefined>;
    closable: boolean;
}

export function headerStyle(
    headerMode: StringHeaderMode|PaneHeaderMode,
    title: string|Observable<string>,
    icon: string|undefined|Observable<string|undefined>,
    closable: boolean,
    ): PaneHeaderStyle {
    switch (headerMode) {
    case 'hidden': headerMode = PaneHeaderMode.Hidden; break;
    case 'visible': headerMode = PaneHeaderMode.Visible; break;
    case 'alwaysTab': headerMode = PaneHeaderMode.AlwaysTab; break;
    }

    return {
        headerMode,
        title: typeof                      title === 'string' ? new BehaviorSubject(title) : title,
        icon: icon === undefined || typeof icon === 'string' ? new BehaviorSubject(icon) : icon,
        closable,
    };
}

// TODO: add support for passing parameters into the templates from the layout
export interface LeafNodeContext {
    header: PaneHeaderStyle;
}

export type LeafNodeTemplate = [TemplateRef<LeafNodeContext>, LeafNodeContext];
