# Example 3: `dynamic-templates`

<!-- TODO: proofread and add screenshots -->

This tutorial builds on the code of the `simple` demo, extending it with dynamically-updated leaf node templates.

## Remove the Static Templates

This demo showcases registering leaf node templates without using the `ngPaneTemplate` directive.  So, to start, remove the leaf template `foo` from the template for `AppComponent`:

```diff
+++ app.component.html

-    <div *ngPaneTemplate="let pane named 'foo' withHeader fooHeader">
-        <h1>Hello world!</h1>
-    </div>
```

Likewise, remove `fooHeader` from the definition of `AppComponent`:

```diff
+++ app.component.ts

-    fooHeader: PaneHeaderStyle = headerStyle('visible', 'Foo', undefined, false);
```

## Update the Layout

Change the leaf node `foo` to use a new template, called `dynamic`:

```ts
// app.component.ts

constructor() {
    const result = LayoutBuilder.empty<any>().build(b => {
        b.add(b.leaf('foo', 'dynamic', {}, 'main'));
        b.add(b.leaf('bar', 'bar', {}, 'right'));
        b.add(b.leaf('toolbar', 'toolbar', {}, 'header'));
    });

    this.layout = result.unwrap();
}
```

In order to register your own leaf node template, you'll first need a `TemplateRef`.  To create a `TemplateRef`, use the `ng-template` tag:

```html
<!-- app.component.html -->

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
</ng-template>
```

Then, to access these templates from the component, use the `@ViewChild` directive to store them in fields:

```ts
// app.component.ts

import { TemplateRef, ViewChild } from '@angular/core';
...

export class AppComponent {
    @ViewChild('foo', {static: true})
    private readonly fooTemplate!: TemplateRef<any>;

    @ViewChild('bar', {static: true})
    private readonly barTemplate!: TemplateRef<any>;

    @ViewChild('baz', {static: true})
    private readonly bazTemplate!: TemplateRef<any>;

    ...
}
```

In order to register leaf templates, you'll need to inject the `NgPaneLeafTemplateService` in the constructor of `AppComponent`:

```ts
import { NgPaneLeafTemplateService } from '@openopus/angular-pane-manager';
...

export class AppComponent {
    constructor(private readonly templateService: NgPaneLeafTemplateService<any>) {
    ...
```

Finally, inject the `NgPaneLeafTemplateService` from the constructor of `AppComponent`, and use it to register a different template for `dynamic` on a timer:

```ts
import { AfterContentInit } from '@angular/core';
import { timer } from 'rxjs';
...

export class AppComponent implements AfterContentInit {
    ngAfterContentInit() {
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
```

And now, the main panel changes every two seconds.  While this specific use case would be served by using an overridden pane header combined with the `ngTemplateOutlet` directive, the template service can be used to allow for more complex leaf template loading logic.
