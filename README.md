# `angular-pane-manager`

This project is a spiritual successor to [`ng-pane-manager`], ported for use with modern Angular.

![screenshot](https://raw.githubusercontent.com/rookie1024/angular-pane-manager-example/master/etc/screenshot.png)

Demos of `angular-pane-manager` can be found in the [`examples` folder], showcasing different uses of the library.

The repository [`angular-pane-manager-example`] houses the original Angular workspace for this project, and shows off some more complex examples used to test and develop features of the library itself.

## Getting Started

To install this library, add `@openopus/angular-pane-manager` to your project with your package manager of choice.  A tutorial on how to get started with the library can be found under `examples/01-simple`.

## Styling

This package comes with basic cosmetic themes, but none are applied to the pane manager component by default.  This is intentional — by doing so, you are able to add custom styles to it without having to fight existing CSS importance scores.  To use the default themes from the package, add the following to your `angular.json`, under the section `projects.[your-project-name].architect.build.options`:

```json
    "styles": [
        "node_modules/@openopus/angular-pane-manager/assets/styles.scss",
        ...
    ]
```

This stylesheet comes pre-packaged with two visual themes, dark and light.  To enable them, add either `class="ng-theme-default"` or `class="ng-theme-light"` to the pane manager component instance.  To design a custom color variant of these themes, you can `@import` the above stylesheet into your root stylesheet and use the `pane-manager-theme-colors` mixin like so:

```scss
ng-pane-manager.my-theme {
    @include pane-manager-theme-colors(
        ...
    );
}
```

To use these colors, add the class `ng-theme-default-layout` to the pane manager, as well as the selectors for your custom style.  To see a list of available color arguments for the mixin (or to get a reference point for designing a custom theme from the ground up), see the source code of the stylesheet.

## Contributing

To build and test this repository, you can clone the Angular workspace it was originally generated in from the repo [`angular-pane-manager-example`].

[`ng-pane-manager`]: https://github.com/opuslogica/ng-pane-manager
[`examples` folder]: https://github.com/openopus/ng-pane-manager2/tree/master/examples
[`angular-pane-manager-example`]: https://github.com/rookie1024/angular-pane-manager-example