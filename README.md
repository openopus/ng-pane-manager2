# `angular-pane-manager`

This project is a spiritual successor to [`ng-pane-manager`], ported for use with modern Angular.

```html
<ng-pane-manager [layout]="myLayout"></ng-pane-manager>

<div *ngPaneTemplate="let panel named foo withHeader fooHeader">
    <h1>Hello world!</h1>
    <p>Lorem ipsum dolor sit amet</p>
</div>

<div *ngPaneTemplate="let panel named bar withHeader barHeader">
    <h1>Sidebar</h1>
    <ul>
        <li>File</li>
        <li>Edit</li>
        <li>Format</li>
    </ul>
</div>
```

<!--TODO: create an actual sample project-->
An example of how to use this project can be found at the repository [`angular-pane-manager-example`].  In addition, the repository contains the encapsulating Angular project used for developing this library.  If you would like to contribute to `angular-pane-manager`, the easiest way to get started is by checking it out.

## Contributing

To build and test this repository, you can clone the Angular workspace it was originally generated in from the repo [`angular-pane-manager-example`].

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).

[`ng-pane-manager`]: https://github.com/opuslogica/ng-pane-manager
[`angular-pane-manager-example`]: https://github.com/rookie1024/angular-pane-manager-example