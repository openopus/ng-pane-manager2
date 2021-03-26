/***************************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-leaf-templates.service.ts)
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
 **************************************************************************************************/

import {Injectable, TemplateRef} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';

import {LeafNodeContext, PaneHeaderStyle} from './pane-template';

/**
 * A leaf template and any extra information associated with it.
 */
export interface LeafTemplateInfo<X> {
    /** The content of the leaf template */
    template: TemplateRef<LeafNodeContext<X>>;
    /** The default header information for the leaf template */
    header: PaneHeaderStyle;
}

/**
 * Optional identifying information for a leaf template.
 */
export type LeafTemplateInfoOpt<X> = {
    [K in keyof LeafTemplateInfo<X>]?: LeafTemplateInfo<X>[K]
};

/**
 * Provides access to the global dictionary of pane leaf templates.
 */
@Injectable({providedIn: 'root'})
export class NgPaneLeafTemplateService<X> {
    /** Registered leaf templates, stored by name */
    private readonly templates:
        Map<string, BehaviorSubject<LeafTemplateInfo<X>|undefined>> = new Map();
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
    public get(name: string): Observable<LeafTemplateInfo<X>|undefined> {
        const entry = this.templates.get(name);

        this.schedulePrune();

        if (entry !== undefined) { return entry; }

        const ret = new BehaviorSubject<LeafTemplateInfo<X>|undefined>(undefined);

        this.templates.set(name, ret);

        return ret;
    }

    /**
     * Registers a given `TemplateRef` for leaves with the corresponding
     * template ID string.
     * @param name the name of the template, corresponding with the `template`
     *             property of leaf nodes
     * @param info the associated information for this template
     * @param force set to true to override an existing template with this name
     */
    public add(name: string, info: LeafTemplateInfo<X>, force: boolean = false): void {
        const entry = this.templates.get(name);

        if (entry === undefined) {
            this.templates.set(name, new BehaviorSubject<LeafTemplateInfo<X>|undefined>(info));

            return;
        }

        if (entry.value !== undefined && !force) {
            throw new Error(`pane template '${name}' already registered`);
        }

        entry.next(info);
    }

    /**
     * Registers a given `TemplateRef` for leaves with the corresponding
     * template ID string.
     * @param name the name of the template, corresponding with the `template`
     *             property of leaf nodes
     * @param header the default style information for this template
     * @param template the content to render in leaves with this template
     * @param force set to true to override an existing template with this name
     * @deprecated use `add(name, {header, template}, force)` instead
     */
    public registerLeafTemplate(name: string,
                                header: PaneHeaderStyle,
                                template: TemplateRef<LeafNodeContext<X>>,
                                force: boolean = false): void {
        this.add(name, {header, template}, force);
    }

    /**
     * Removes the leaf template with the given name.
     * @param name the name of the template to remove
     * @param info only unregister if the template matches any fields provided
     *             here
     * @returns whether a matching template was found and removed
     */
    public remove(name: string, info: LeafTemplateInfoOpt<X>): boolean {
        const {template, header} = info;
        const entry              = this.templates.get(name);

        if (entry === undefined || entry.value === undefined) { return false; }

        if (template !== undefined && !Object.is(entry.value.template, template) ||
            header !== undefined && !Object.is(entry.value.header.widgets, header.widgets)) {
            return false;
        }

        if (entry.observers.length === 0) {
            entry.next(undefined);

            return true;
        }

        return this.templates.delete(name);
    }

    /**
     * Removes the leaf template with the given name.
     * @param name the name of the template to remove
     * @param template if provided, only unregister if the template matches this
     *                 value
     * @returns whether a matching template was found
     * @deprecated use `remove(name, {template?})` instead
     */
    public unregisterLeafTemplate(name: string,
                                  template?: TemplateRef<LeafNodeContext<X>>): boolean {
        return this.remove(name, {template});
    }
}
