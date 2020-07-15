/********************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (layout-base.ts)
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

import {LayoutGravity, PaneLayout} from './layout-core';

/**
 * Base class for all pane layout node types.
 */
export abstract class LayoutBase {
    /**
     * Construct a new layout node.
     * @param gravity the gravity of this layout node
     * @param group the group of this layout node
     */
    public constructor(public readonly gravity: LayoutGravity|undefined,
                       public readonly group: string|undefined) {}

    /**
     * Find any occurrences (by reference) of a node in the current tree and
     * replace them with another node.
     * @param find the node to search for
     * @param replace the node to replace the search node with
     */
    public abstract transposeDeep(find: PaneLayout, replace: PaneLayout): PaneLayout|undefined;

    /**
     * Recursively simplify this node tree.
     */
    public abstract simplifyDeep(): PaneLayout|undefined;
}
