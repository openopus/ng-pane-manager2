/*********************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-widget.directive.ts)
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
 ********************************************************************************************/

import {
    AfterContentInit,
    Directive,
    Input,
    OnDestroy,
    TemplateRef,
    ViewContainerRef,
} from '@angular/core';
import { NgPaneHeaderTemplateService } from './ng-pane-header-templates.service';
import { HeaderWidgetContext } from './pane-template';

/**
 * Store the attached content as a named template for custom pane headers.
 */
// tslint:disable-next-line directive-selector
@Directive({ selector: '[ngPaneWidget]' })
export class NgPaneWidgetDirective<X> implements AfterContentInit, OnDestroy {
    /** See `ngPaneWidgetNamed` */
    private name: string | undefined;
    /** See `ngPaneWidgetControls` */
    private controls: TemplateRef<HeaderWidgetContext<X>> | undefined;

    /** Stores the name to register this template under */
    @Input()
    public set ngPaneWidgetNamed(name: string) {
        this.name = name;
    }

    /** Stores the associated right-hand-side controls for this title widget */
    @Input()
    public set ngPaneWidgetControls(controls: TemplateRef<HeaderWidgetContext<X>>) {
        this.controls = controls;
    }

    /**
     * Construct a new pane header widget template directive.
     * @param templateRef injected to be registered with the widget template service
     * @param _viewContainer injected (unused)
     * @param templateService injected to register the widget template
     */
    public constructor(
        private readonly templateRef: TemplateRef<HeaderWidgetContext<X>>,
        _viewContainer: ViewContainerRef,
        private readonly templateService: NgPaneHeaderTemplateService<X>,
    ) {}

    /** Register the header widget template */
    public ngAfterContentInit(): void {
        if (this.name === undefined) {
            throw new Error("header widget template missing 'named' keyword");
        }

        this.templateService.add(this.name, { title: this.templateRef, controls: this.controls });
    }

    /** Attempt to unregister the template */
    public ngOnDestroy(): void {
        if (this.name === undefined) {
            return;
        }

        this.templateService.remove(this.name, {
            title: this.templateRef,
            controls: this.controls,
        });
    }
}
