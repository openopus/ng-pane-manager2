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
import {BehaviorSubject, Observable} from 'rxjs';

import {LeafNodeContext} from './layout-node-factory';
import {NgPaneManagerComponent} from './ng-pane-manager.component';

@Directive({selector: '[ngPane]'})
export class NgPaneDirective implements AfterContentInit {
    private name!: string;
    private title!: Observable<string>;
    private icon!: Observable<string>;
    private paneManager!: NgPaneManagerComponent;

    @Input()
    set ngPaneNamed(name: string) {
        this.name = name;
    }

    @Input()
    set ngPaneWithTitle(title: string|Observable<string>) {
        this.title = typeof title === 'string' ? new BehaviorSubject(title) : title;
    }

    @Input()
    set ngPaneWithIcon(icon: string|Observable<string>) {
        this.icon = typeof icon === 'string' ? new BehaviorSubject(icon) : icon;
    }

    @Input()
    set ngPaneFor(paneManager: NgPaneManagerComponent) {
        this.paneManager = paneManager;
    }

    constructor(private readonly templateRef: TemplateRef<LeafNodeContext>,
                viewContainer: ViewContainerRef) {}

    // TODO: send title and icon in the registration info
    // TODO: add other properties (closable, alwaysTab, etc.)
    ngAfterContentInit() { this.paneManager.registerPanelTemplate(this.name, this.templateRef); }
}
