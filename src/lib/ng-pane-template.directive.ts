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

import {AfterContentInit, Directive, Input, TemplateRef, ViewContainerRef} from '@angular/core';

import {NgPaneManagerComponent} from './ng-pane-manager/ng-pane-manager.component';
import {LeafNodeContext, PaneHeaderStyle} from './pane-template';

/**
 * Stores the attached content as a named template for leaf panes.
 */
// tslint:disable-next-line directive-selector
@Directive({selector: '[ngPaneTemplate]'})
export class NgPaneTemplateDirective<X> implements AfterContentInit {
    /** See `ngPaneTemplateNamed` */
    private name!: string;
    /** See `ngPaneTemplateWithHeader` */
    private headerStyle!: PaneHeaderStyle;
    /** See `ngPaneTamplateFor` */
    private manager!: NgPaneManagerComponent<X>;

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

    /** Stores the pane manager to register this template with */
    @Input()
    public set ngPaneTemplateFor(manager: NgPaneManagerComponent<X>) {
        this.manager = manager;
    }

    /**
     * Construct a new pane template directive.
     * @param templateRef injected to be registered with a pane manager
     * @param _viewContainer injected (unused)
     */
    public constructor(private readonly templateRef: TemplateRef<LeafNodeContext<X>>,
                       _viewContainer: ViewContainerRef) {}

    /** Register the pane template with the pane manager */
    public ngAfterContentInit(): void {
        this.manager.registerLeafTemplate(this.name, this.headerStyle, this.templateRef);
    }
}
