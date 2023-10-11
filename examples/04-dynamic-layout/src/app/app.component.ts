// tslint:disable component-selector no-magic-numbers
import { Component } from '@angular/core';
import { StorageMap } from '@ngx-pwa/local-storage';
import {
    headerStyle,
    LayoutBuilder,
    LayoutTemplate,
    LayoutType,
    PaneHeaderStyle,
    RootLayout,
    saveLayout,
} from '@openopus/angular-pane-manager';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

/** The root app component */
@Component({
    selector: 'app-root',
    template: `<ng-pane-manager
            id="manager"
            class="ng-theme-default"
            [(layout)]="layout"
            (layoutUpdate)="requestAutosave.next(undefined)"
        ></ng-pane-manager>
        <div *ngPaneTemplate="let pane; named: 'toolbar'; withHeader: toolbarHeader">
            <em>Toolbar</em>
            <p>
                <button (click)="resetLayout()">Reset Layout</button>
                <span style="display: inline-block; width: 2rem"></span>
                <button (click)="addMain()">Add Main Panel</button>
                <span style="display: inline-block; width: 1rem"></span>
                <button (click)="toggleSide()">Toggle Sidebar</button>
            </p>
        </div>
        <div *ngPaneTemplate="let pane; named: 'foo'; withHeader: fooHeader; let extra = extra">
            <h1>Hello world!</h1>
            <p>
                My id is: <code>{{ extra.id }}</code>
            </p>
        </div>
        <div *ngPaneTemplate="let pane; named: 'bar'; withHeader: barHeader">
            <p>Cool sidebar!</p>
        </div>`,
    styles: [
        `
            #manager {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
            }
        `,
    ],
})
export class AppComponent {
    /**
     * The indexedDB key for the saved layout.
     *
     * It's important not to change this, as it will break existing saved data.
     */
    private static readonly LAYOUT_KEY: string = 'paneLayout';

    /** The pane layout.  Changing this will not save the layout. */
    private _layout: RootLayout<any> = new RootLayout(undefined);
    /** The ID of the next free main panel */
    private nextMainId: number = 0;

    /** Header style for the pane `toolbar` */
    public toolbarHeader: PaneHeaderStyle = headerStyle('hidden', 'Toolbar', undefined, false);
    /** Header style for the pane `foo` */
    public fooHeader: PaneHeaderStyle = headerStyle('visible', 'Foo', undefined, true);
    /** Header style for the pane `bar` */
    public barHeader: PaneHeaderStyle = headerStyle('visible', 'Bar', undefined, true);

    /** Request a (debounced) autosave */
    public readonly requestAutosave: Subject<undefined> = new Subject();

    /** The pane layout.  Changing this value will save the layout. */
    public get layout(): RootLayout<any> {
        return this._layout;
    }

    public set layout(val: RootLayout<any>) {
        if (Object.is(this._layout, val)) {
            return;
        }

        this._layout = val;
        this.saveLayout();
    }

    /**
     * Construct a new app instance.
     *
     * Here `@ngx-pwa/local-storage` is being used to save and restore layouts,
     * but you can use any storage library that supports reading and writing
     * JSON.
     */
    public constructor(private readonly storage: StorageMap) {
        this.storage.get(AppComponent.LAYOUT_KEY).subscribe(template => {
            const result = LayoutBuilder.empty<any>().build(b => {
                b.set(b.loadSimple(template as LayoutTemplate<any>));

                // Look for a toolbar - if one doesn't exist, then the
                // Reset Layout button won't be available
                if (
                    b.root.findChild(
                        c => c.type === LayoutType.Leaf && c.template === 'toolbar',
                    ) === undefined
                ) {
                    b.add(b.leaf('toolbar', 'toolbar', {}, 'header'));
                }
            });

            if (result.err !== undefined) {
                console.warn('Error loading layout: ', result.err);
                this.resetLayout();
            } else {
                this._layout = result.ok;
            }
        });

        this.requestAutosave.pipe(debounceTime(500)).subscribe(_ => this.saveLayout());
    }

    /** Save the current layout immediately */
    private saveLayout(): void {
        this.storage
            .set(
                AppComponent.LAYOUT_KEY,
                saveLayout(this._layout, x => x),
            )
            .subscribe();
    }

    /** Apply and save a change to the layout */
    private modifyLayout(callback: (b: LayoutBuilder<any>) => void): void {
        const result = LayoutBuilder.from(this.layout).build(callback);
        this.layout = result.unwrap();
    }

    /**
     * Add a new `foo` panel to the given layout builder.
     * @param b the layout builder to use
     * @param id the ID number of this panel, or undefined for the next available
     */
    private addFoo(b: LayoutBuilder<any>, id: number = this.nextMainId): void {
        b.add(b.leaf(`foo${id}`, 'foo', { id }, 'main'));

        this.nextMainId = id + 1;
        while (
            this.layout.findChild(
                c => c.type === LayoutType.Leaf && c.id === `foo${this.nextMainId}`,
            ) !== undefined
        ) {
            this.nextMainId += 1;
        }
    }

    /** Reset the layout to a default value */
    public resetLayout(): void {
        const result = LayoutBuilder.empty<any>().build(b => {
            this.addFoo(b, 0);
            b.add(b.leaf('bar', 'bar', {}, 'right'));
            b.add(b.leaf('toolbar', 'toolbar', {}, 'header'));
        });

        this.layout = result.unwrap();
    }

    /** Add a new main panel */
    public addMain(): void {
        this.modifyLayout(this.addFoo.bind(this));
    }

    /** Open or close the sidebar, depending on if it is already visible */
    public toggleSide(): void {
        this.modifyLayout(b => {
            const childId = b.root.findChild(c => c.type === LayoutType.Leaf && c.id === 'bar');

            if (childId !== undefined) {
                b.sub(childId.stem, childId.stem.withoutChild(childId.index).layout);
            } else {
                b.add(b.leaf('bar', 'bar', {}, 'right'));
            }
        });
    }
}
