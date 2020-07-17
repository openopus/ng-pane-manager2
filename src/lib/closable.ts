/*******************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (closable.ts)
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
 ******************************************************************************/

import {Component, HostListener} from '@angular/core';

import {DraggablePaneComponent} from './drag-and-drop';
import {PaneHeaderMode, PaneHeaderStyle} from './pane-template';

/**
 * Abstract base component class for components hosting a closable, draggable
 * pane.
 *
 * Provides a `close()` method and an `auxclick` handler that covers all pane
 * middle-click-to-close functionality.
 */
@Component({template: ''})
export abstract class ClosablePaneComponent<X, T extends PaneHeaderMode = PaneHeaderMode> extends
    DraggablePaneComponent<X> {
    /** The header style information for this component */
    protected abstract get style(): PaneHeaderStyle<T>;

    /**
     * Closes the associated pane on middle-click.
     *
     * **NOTE:** Do _not_ adorn any overrides of this method with
     *           `@HostListener`, this will result in undesired behavior.
     */
    @HostListener('auxclick', ['$event'])
    protected onClick(evt: MouseEvent): void {
        if (evt.button === 1) { this.close(); }
    }

    /**
     * Remove this pane from the layout tree.
     */
    public close(): void {
        if (!this.style.closable) { return; }

        const transposed = this.manager.layout.transposeDeep(
            this.childId.stem, this.childId.stem.withoutChild(this.childId.index).layout);

        if (transposed === undefined) {
            throw new Error('unable to close pane - this should never happen');
        }

        this.manager.layout = transposed.intoRoot();
    }
}
