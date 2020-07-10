import {
    Component,
    ComponentFactoryResolver,
    ComponentRef,
    Input,
    TemplateRef,
    ViewChild,
} from '@angular/core';

import {NgPaneRendererDirective} from '../ng-pane-renderer.directive';
import {NgPaneComponent} from '../ng-pane/ng-pane.component';
import {PaneFactory} from '../pane-factory';
import {LayoutType, RootLayout} from '../pane-layout/module';
import {LeafNodeContext, PaneHeaderStyle} from '../pane-template';

@Component({
    selector: 'ng-pane-manager',
    template: '<ng-container libNgPaneRenderer></ng-container>',
    styleUrls: ['./ng-pane-manager.component.scss'],
})
export class NgPaneManagerComponent {
    @ViewChild(NgPaneRendererDirective, {static: true}) readonly renderer!: NgPaneRendererDirective;

    private _layout: RootLayout|undefined;
    private pane: ComponentRef<NgPaneComponent>|undefined;
    readonly factory: PaneFactory;

    @Input()
    get layout(): RootLayout|undefined {
        return this._layout;
    }

    set layout(val: RootLayout|undefined) {
        if (val === this._layout) return;

        if (val !== undefined) {
            if (val.type !== LayoutType.Root)
                throw new Error('invalid layout type for pane manager - must be a root layout');

            const simplified = val.simplifyDeep();

            if (simplified !== undefined) {
                if (simplified.type !== LayoutType.Root)
                    throw new Error('invalid simplification - root layout collapsed into child');

                val = simplified;
            }
        }

        this._layout = val;

        const oldPane = this.pane;

        // TODO: notify layout change start

        try {
            this.pane = val !== undefined
                            ? this.factory.placePane(this.renderer.viewContainer, val.childId())
                            : undefined;
        }
        finally {
            // TODO: notify layout change end
            if (oldPane !== undefined) oldPane.destroy();
        }
    }

    constructor(cfr: ComponentFactoryResolver) { this.factory = new PaneFactory(cfr); }

    registerLeafTemplate(name: string,
                         header: PaneHeaderStyle,
                         template: TemplateRef<LeafNodeContext>) {
        this.factory.registerLeafTemplate(name, header, template);
    }

    unregisterLeafTemplate(name: string) { this.factory.unregisterLeafTemplate(name); }
}
