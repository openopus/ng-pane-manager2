/***********************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane-template.directive.ts)
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
 **********************************************************************************************/

import {
    AfterContentInit,
    Directive,
    Input,
    OnDestroy,
    TemplateRef,
    ViewContainerRef,
} from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { NgPaneLeafTemplateService } from './ng-pane-leaf-templates.service';
import { LeafNodeContext, PaneHeaderMode, PaneHeaderStyle } from './pane-template';

/**
 * Stores the attached content as a named template for leaf panes.
 */
// tslint:disable-next-line directive-selector
@Directive({ selector: '[ngPaneTemplate]' })
export class NgPaneTemplateDirective<X> implements AfterContentInit, OnDestroy {
    /** See `ngPaneTemplateNamed` */
    private name: string | undefined;
    /** See `ngPaneTemplateWithHeader` */
    private headerStyle: PaneHeaderStyle | undefined;

    /** Stores the name to register this template under */
    @Input()
    public set ngPaneTemplateNamed(name: string) {
        this.name = name;
    }

    /** Stores the header information to register with this template */
    @Input()
    public set ngPaneTemplateWithHeader(style: PaneHeaderStyle) {
        this.headerStyle = style;
    }

    /**
     * Construct a new pane template directive.
     * @param templateRef injected to be registered with the pane template service
     * @param _viewContainer injected (unused)
     * @param templateService injected to register the pane template
     */
    public constructor(
        private readonly templateRef: TemplateRef<LeafNodeContext<X>>,
        _viewContainer: ViewContainerRef,
        private readonly templateService: NgPaneLeafTemplateService<X>,
    ) {}

    /** Register the pane template */
    public ngAfterContentInit(): void {
        if (this.name === undefined) {
            throw new Error("pane template missing 'named' keyword");
        }

        if (this.headerStyle === undefined) {
            this.headerStyle = {
                headerMode: PaneHeaderMode.Hidden,
                title: new BehaviorSubject(''),
                icon: new BehaviorSubject(undefined),
                closable: false,
            };
        }

        this.templateService.add(this.name, {
            header: this.headerStyle,
            template: this.templateRef,
        });
    }

    /** Attempt to unregister the template */
    public ngOnDestroy(): void {
        if (this.name === undefined) {
            return;
        }

        this.templateService.remove(this.name, {
            header: this.headerStyle,
            template: this.templateRef,
        });
    }
}
