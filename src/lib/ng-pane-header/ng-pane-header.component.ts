import {Component, ViewChild} from '@angular/core';

import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';
import {PaneFactory} from '../pane-factory';
import {ChildLayoutId, childWithId} from '../pane-layout/module';
import {PaneHeaderMode, PaneHeaderStyle} from '../pane-template';

@Component({
    selector: 'lib-ng-pane-header',
    template: '<ng-container libNgPaneRenderer></ng-container>',
    styleUrls: ['./ng-pane-header.component.scss'],
})
export class NgPaneHeaderComponent {
    @ViewChild(NgPaneRendererDirective, {static: true})
    private readonly renderer!: NgPaneRendererDirective;

    private _style: PaneHeaderStyle|undefined;
    childId!: ChildLayoutId;
    factory!: PaneFactory;

    get style(): PaneHeaderStyle|undefined { return this._style; }

    set style(val: PaneHeaderStyle|undefined) {
        if (val === this._style) return;

        this._style = val;

        this.renderer.viewContainer.clear();

        if (val !== undefined) {
            switch (val.headerMode) {
            case PaneHeaderMode.Hidden: break;
            case PaneHeaderMode.Visible:
                this.factory.placeTitle(this.renderer.viewContainer, childWithId(this.childId));
                break;
            case PaneHeaderMode.AlwaysTab:
                this.factory.placeTabRow(this.renderer.viewContainer, childWithId(this.childId));
                break;
            }
        }
    }
}
