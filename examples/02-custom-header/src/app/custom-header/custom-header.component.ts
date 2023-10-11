// tslint:disable component-selector
import { Component, Input, Output } from '@angular/core';
import { headerStyle, PaneHeaderStyle } from '@openopus/angular-pane-manager';
import { BehaviorSubject, Observable } from 'rxjs';

/** A component with a customizable title */
@Component({
    selector: 'app-custom-header',
    template: `<p>
        My custom header is <strong>{{ title }}</strong
        >!
    </p>`,
    styles: [],
})
export class CustomHeaderComponent {
    /** The title to output.  Change this value to update the displayed title. */
    private readonly $title: BehaviorSubject<string> = new BehaviorSubject('');
    /**
     * The header to output.  Avoid changing this value unless you want to
     * update the non-observable properties, as updating it cause the whole
     * header to be destroyed and re-rendered.
     */
    private readonly $header: BehaviorSubject<PaneHeaderStyle> = new BehaviorSubject(
        headerStyle('alwaysTab', this.$title, undefined, false),
    );

    /** Event stream to keep the pane header updated */
    @Output()
    public get header(): Observable<PaneHeaderStyle> {
        return this.$header.asObservable();
    }

    /** The current pane title */
    @Input()
    public get title(): string {
        return this.$title.value;
    }

    public set title(val: string) {
        this.$title.next(val);
    }
}
