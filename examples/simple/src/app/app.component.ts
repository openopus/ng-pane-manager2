// tslint:disable component-selector
import {Component} from '@angular/core';
import {
    headerStyle,
    LayoutBuilder,
    PaneHeaderStyle,
    RootLayout,
} from '@openopus/angular-pane-manager';

// TODO: write a tutorial to accompany this
/** The root app component */
@Component({
    selector: 'app-root',
    template: `
    <ng-pane-manager id="manager" class="ng-theme-default" [layout]="layout"></ng-pane-manager>
    <div *ngPaneTemplate="let pane named 'toolbar' withHeader toolbarHeader">
        <em>Toolbar</em>
    </div>
    <div *ngPaneTemplate="let pane named 'foo' withHeader fooHeader">
        <h1>Hello world!</h1>
    </div>
    <div *ngPaneTemplate="let pane named 'bar' withHeader barHeader">
        <p>Cool sidebar!</p>
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

    /** Header style for the pane `foo` */
    public fooHeader: PaneHeaderStyle = headerStyle('visible', 'Foo', undefined, false);

    /** Header style for the pane `bar` */
    public barHeader: PaneHeaderStyle = headerStyle('visible', 'Bar', undefined, false);

    /** Construct a new app instance */
    public constructor() {
        const result = LayoutBuilder.empty<any>().build(b => {
            b.add(b.leaf('foo', 'foo', {}, 'main'));
            b.add(b.leaf('bar', 'bar', {}, 'right'));
            b.add(b.leaf('toolbar', 'toolbar', {}, 'header'));
        });

        this.layout = result.unwrap();
    }
}
