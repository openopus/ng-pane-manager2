/*****************************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-header-templates.service.ts)
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
 ****************************************************************************************************/

import {Injectable, TemplateRef} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';

import {HeaderWidgetContext} from './pane-template';

/**
 * A set of header widget templates and any extra information associated with them.
 */
export interface HeaderTemplateInfo<X> {
    /** The title template.  See `HeaderWidgetTemplate<X>` for more info. */
    title: TemplateRef<HeaderWidgetContext<X>>;
    /** The controls template.  See `HeaderWidgetTemplate<X>` for more info. */
    controls: TemplateRef<HeaderWidgetContext<X>>|undefined;
}

/**
 * Optional identifying information for a header template.
 */
export type HeaderTemplateInfoOpt<X> = {
    [K in keyof HeaderTemplateInfo<X>]?: HeaderTemplateInfo<X>[K]
};

/**
 * Provides access to the global dictionary of pane header templates.
 */
@Injectable({providedIn: 'root'})
export class NgPaneHeaderTemplateService<X> {
    /** Registered header templates, stored by name */
    private readonly templates:
        Map<string, BehaviorSubject<HeaderTemplateInfo<X>|undefined>> = new Map();
    /**
     * Whether a prune operation is currently scheduled.\
     * See `schedulePrune`.
     */
    private pruneScheduled: boolean = false;

    /**
     * Schedules a pruning operation to remove dead entries with no observers.
     */
    private schedulePrune(): void {
        if (!this.pruneScheduled) {
            this.pruneScheduled = true;

            requestAnimationFrame(_ => {
                let remove;
                for (const [key, val] of this.templates) {
                    if (val.value === undefined && val.observers.length === 0) {
                        if (remove === undefined) { remove = [key]; }
                        else {
                            remove.push(key);
                        }
                    }
                }

                if (remove !== undefined) { remove.forEach(k => this.templates.delete(k)); }

                this.pruneScheduled = false;
            });
        }
    }

    /**
     * Retrieve the template with the given name.
     * @param name the name of the template
     */
    public get(name: string): Observable<HeaderTemplateInfo<X>|undefined> {
        const entry = this.templates.get(name);

        this.schedulePrune();

        if (entry !== undefined) { return entry; }

        const ret = new BehaviorSubject<HeaderTemplateInfo<X>|undefined>(undefined);

        this.templates.set(name, ret);

        return ret;
    }

    /**
     * Registers a given set of `TemplateRef`s for custom pane headers with the
     * corresponding template ID string.
     * @param name the name of the template
     * @param info the associated information for this template
     * @param force set to true to override an existing template with this name
     */
    public add(name: string, info: HeaderTemplateInfo<X>, force: boolean = false): void {
        const entry = this.templates.get(name);

        if (entry === undefined) {
            this.templates.set(name, new BehaviorSubject<HeaderTemplateInfo<X>|undefined>(info));

            return;
        }

        if (entry.value !== undefined && !force) {
            throw new Error(`pane header template '${name}' already registered`);
        }

        entry.next(info);
    }

    /**
     * Remove the header template with the given name.
     * @param name the name of the template to remove
     * @param info only unregister if the template matches any fields provided
     *             here
     * @returns whether a matching template was found and removed
     */
    public remove(name: string, info: HeaderTemplateInfoOpt<X>): boolean {
        const {title, controls} = info;
        const entry             = this.templates.get(name);

        if (entry === undefined || entry.value === undefined) { return false; }

        if (title !== undefined && !Object.is(entry.value.title, title) ||
            controls !== undefined && !Object.is(entry.value.controls, controls)) {
            return false;
        }

        if (entry.observers.length === 0) {
            entry.next(undefined);

            return true;
        }

        return this.templates.delete(name);
    }
}
