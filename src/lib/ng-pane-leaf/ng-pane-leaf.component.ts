import {Component, ViewChild} from '@angular/core';

import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';
import {LeafLayout} from '../pane-layout/module';
import {LeafNodeContext, LeafNodeTemplate} from '../pane-template';

@Component({
    selector: 'lib-ng-pane-leaf',
    template: 'LEAF',
    styleUrls: ['./ng-pane-leaf.component.scss'],
})
export class NgPaneLeafComponent {
    @ViewChild(NgPaneRendererDirective, {static: true})
    private readonly renderer!: NgPaneRendererDirective;

    private _template: LeafNodeTemplate|undefined;
    layout!: LeafLayout;

    get template(): LeafNodeTemplate|undefined { return this._template; }

    set template(val: LeafNodeTemplate|undefined) {
        if (val === this._template) return;

        this._template = val;

        this.renderer.viewContainer.clear();

        if (val !== undefined)
            this.renderer.viewContainer.createEmbeddedView<LeafNodeContext>(...val);
    }
}
