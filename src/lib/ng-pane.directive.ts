/**************************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (ng-pane.directive.ts)
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
 *************************************************************************************/

import {AfterContentInit, Directive, Input, TemplateRef, ViewContainerRef} from '@angular/core';

import {LeafNodeContext, PaneProperties} from './layout-node-factory';
import {NgPaneManagerComponent} from './ng-pane-manager.component';

@Directive({selector: '[ngPane]'})
export class NgPaneDirective implements AfterContentInit {
    private template !: string;
    private props!: PaneProperties;
    private paneManager!: NgPaneManagerComponent;

    @Input()
    set ngPaneTemplate(template: string) {
        this.template = template;
    }

    @Input()
    set ngPaneWithProps(props: PaneProperties) {
        this.props = props;
    }

    @Input()
    set ngPaneFor(paneManager: NgPaneManagerComponent) {
        this.paneManager = paneManager;
    }

    constructor(private readonly templateRef: TemplateRef<LeafNodeContext>,
                viewContainer: ViewContainerRef) {}

    ngAfterContentInit() {
        this.paneManager.registerPanelTemplate(this.template, this.props, this.templateRef);
    }
}
