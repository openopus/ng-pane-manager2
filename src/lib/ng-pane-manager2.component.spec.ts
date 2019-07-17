/**********************************************************************************************
 *
 * ng-pane-manager2 - a fork of ng-pane-manager for Angular (ng-pane-manager2.component.spec.ts)
 * Copyright (C) 2019 Opus Logica
 *
 * ng-pane-manager2 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * ng-pane-manager2 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with ng-pane-manager2.  If not, see <https://www.gnu.org/licenses/>.
 *
 *********************************************************************************************/

import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {NgPaneManager2Component} from './ng-pane-manager2.component';

describe('NgPaneManager2Component', () => {
    let component: NgPaneManager2Component;
    let fixture: ComponentFixture<NgPaneManager2Component>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({declarations: [NgPaneManager2Component]})
            .compileComponents();
    }));

    beforeEach(() => {
        fixture   = TestBed.createComponent(NgPaneManager2Component);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => { expect(component).toBeTruthy(); });
});
