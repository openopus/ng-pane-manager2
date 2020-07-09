import {Component, ComponentRef, ViewChild} from '@angular/core';

import {NgPaneHeaderComponent} from '../ng-pane-header/ng-pane-header.component';
import {NgPaneLeafComponent} from '../ng-pane-leaf/ng-pane-leaf.component';
import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';
import {NgPaneSplitComponent} from '../ng-pane-split/ng-pane-split.component';
import {NgPaneTabRowComponent} from '../ng-pane-tab-row/ng-pane-tab-row.component';

@Component({
    selector: 'lib-ng-pane',
    template: '<ng-container libNgPaneRenderer></ng-container>',
    styleUrls: ['./ng-pane.component.scss'],
})
export class NgPaneComponent {
    @ViewChild(NgPaneRendererDirective, {static: true}) renderer!: NgPaneRendererDirective;

    header: ComponentRef<NgPaneHeaderComponent>|ComponentRef<NgPaneTabRowComponent>|undefined;
    content: ComponentRef<NgPaneSplitComponent>|ComponentRef<NgPaneLeafComponent>|undefined;
}
