# `angular-pane-manager`

This project is a spiritual successor to [`ng-pane-manager`], ported for use with modern Angular.

![screenshot](https://raw.githubusercontent.com/rookie1024/angular-pane-manager-example/master/etc/screenshot.png)

Demos of `angular-pane-manager` can be found in the [`examples` folder], showcasing different uses of the library.

The repository [`angular-pane-manager-example`] houses the original Angular workspace for this project, and shows off some more complex examples used to test and develop features of the library itself.

## Getting Started

To install this library, add `@openopus/angular-pane-manager` to your project with your package manager of choice.  A tutorial on how to get started with the library can be found under `examples/01-simple`.

## Styling

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
[`examples` folder]: https://github.com/openopus/ng-pane-manager2/tree/master/examples
[`angular-pane-manager-example`]: https://github.com/rookie1024/angular-pane-manager-example