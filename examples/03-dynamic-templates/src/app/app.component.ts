// tslint:disable component-selector no-magic-numbers
import {AfterContentInit, Component, TemplateRef, ViewChild} from '@angular/core';
import {
    headerStyle,
    LayoutBuilder,
    NgPaneLeafTemplateService,
    PaneHeaderStyle,
    RootLayout,
} from '@openopus/angular-pane-manager';
import {timer} from 'rxjs';

/** The root app component */
@Component({
    selector: 'app-root',
    template: `
    <ng-pane-manager id="manager" class="ng-theme-default" [layout]="layout"></ng-pane-manager>
    <div *ngPaneTemplate="let pane named 'toolbar' withHeader toolbarHeader">
        <em>Toolbar</em>
    </div>
    <div *ngPaneTemplate="let pane named 'bar' withHeader barHeader">
        <p>Cool sidebar!</p>
    </div>
    <ng-template #foo>
        <div>
            <h1>Hello world!</h1>
        </div>
    </ng-template>
    <ng-template #bar>
        <div>
            <h2>It is I!</h2>
        </div>
    </ng-template>
    <ng-template #baz>
        <div>
            <sup>Lorem Ipsum!</sup>
        </div>
    </ng-template>`,
    styles: [`
    #manager {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
    }`],
})
export class AppComponent implements AfterContentInit {
    /** The template named `foo` */
    @ViewChild('foo', {static: true}) private readonly fooTemplate!: TemplateRef<any>;
    /** The template named `bar` */
    @ViewChild('bar', {static: true}) private readonly barTemplate!: TemplateRef<any>;
    /** The template named `baz` */
    @ViewChild('baz', {static: true}) private readonly bazTemplate!: TemplateRef<any>;

    /** The pane layout */
    public layout: RootLayout<any> = new RootLayout(undefined);

    /** Header style for the pane `toolbar` */
    public toolbarHeader: PaneHeaderStyle = headerStyle('hidden', 'Toolbar', undefined, false);

    /** Header style for the pane `bar` */
    public barHeader: PaneHeaderStyle = headerStyle('visible', 'Bar', undefined, false);

    /** Construct a new app instance */
    public constructor(private readonly templateService: NgPaneLeafTemplateService<any>) {
        const result = LayoutBuilder.empty<any>().build(b => {
            b.add(b.leaf('foo', 'dynamic', {}, 'main'));
            b.add(b.leaf('bar', 'bar', {}, 'right'));
            b.add(b.leaf('toolbar', 'toolbar', {}, 'header'));
        });

        this.layout = result.unwrap();
    }

    /** Display the templates when they're ready */
    public ngAfterContentInit(): void {
        const templates = [
            {template: this.fooTemplate, title: 'Foo'},
            {template: this.barTemplate, title: 'Bar'},
            {template: this.bazTemplate, title: 'Baz'},
        ];

        timer(0, 2000).subscribe(i => {
            const {title, template} = templates[i % templates.length];

            this.templateService.registerLeafTemplate(
                'dynamic', headerStyle('visible', title, undefined, false), template, true);
        });
    }
}
