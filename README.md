# `angular-pane-manager`

This project is a spiritual successor to [`ng-pane-manager`], ported for use with modern Angular.

```html
<ng-pane-manager class="ng-theme-default" [layout]="myLayout"></ng-pane-manager>

<div *ngPaneTemplate="let pane named foo">
    <h1>Hello world!</h1>
    <p>Lorem ipsum dolor sit amet</p>
</div>

<div *ngPaneTemplate="let pane named bar">
    <h1>Sidebar</h1>
    <ul>
        <li>File</li>
        <li>Edit</li>
        <li>Format</li>
    </ul>
</div>
```

<!--TODO: create an actual sample project-->
An example of `angular-pane-manager` in action can be found at the repository [`angular-pane-manager-example`].  In addition, the repository contains the encapsulating Angular project used for developing this library.  If you would like to contribute to `angular-pane-manager`, the easiest way to get started is by checking it out.

## Installing

To get started, add `@openopus/angular-pane-manager` to your project with your package manager of choice.

## Styling

<!--TODO: verify this with a new sample project-->
This package comes with a basic cosmetic theme, but it is not applied to the pane manager component by default.  This is intentional—by doing so, you are able to add custom styles to it without having to fight existing CSS importance scores.  To use the default theme from the package, add `class="ng-theme-default"` to your `<ng-pane-manager>` tag, and add the following to your `angular.json`, under the section `projects.[your-project-name].architect.build.options`:

```json
    "styles": [
        "node_modules/@openopus/angular-pane-manager/assets/styles.scss",
        ...
    ]
```

This stylesheet is also a good reference point for creating your own pane manager themes.

## Contributing

To build and test this repository, you can clone the Angular workspace it was originally generated in from the repo [`angular-pane-manager-example`].

[`ng-pane-manager`]: https://github.com/opuslogica/ng-pane-manager
[`angular-pane-manager-example`]: https://github.com/rookie1024/angular-pane-manager-example