// tslint:disable component-selector
import {Component} from '@angular/core';
import {
    headerStyle,
    LayoutBuilder,
    PaneHeaderStyle,
    RootLayout,
} from '@openopus/angular-pane-manager';

/** The root app component */
@Component({
    selector: 'app-root',
    template: `
    <ng-pane-manager id="manager" class="ng-theme-default" [layout]="layout"></ng-pane-manager>
    <app-custom-header *ngPaneTemplate="let pane named 'custom-header'; let extra = extra"
                      [title]="extra.title" (header)="pane.header = $event"></app-custom-header>
    <div *ngPaneTemplate="let pane named 'toolbar' withHeader toolbarHeader">
        <em>Toolbar</em>
    </div>`,
    styles: [`
    #manager {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
    }`],
})
export class AppComponent {
    /** The pane layout */
    public layout: RootLayout<any> = new RootLayout(undefined);

    /** Header style for the pane `toolbar` */
    public toolbarHeader: PaneHeaderStyle = headerStyle('hidden', 'Toolbar', undefined, false);

    /** Construct a new app instance */
    public constructor() {
        const result = LayoutBuilder.empty<any>().build(b => {
            b.add(b.leaf('foo', 'custom-header', {title: 'Foo'}, 'main'));
            b.add(b.leaf('bar', 'custom-header', {title: 'Bar'}, 'right'));
            b.add(b.leaf('toolbar', 'toolbar', {}, 'header'));
        });

        this.layout = result.unwrap();
    }
}
