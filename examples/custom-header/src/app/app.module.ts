import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {AngularPaneManagerModule} from '@openopus/angular-pane-manager';

import {AppComponent} from './app.component';
import {CustomHeaderComponent} from './custom-header/custom-header.component';

/** The root module */
@NgModule({
    declarations: [AppComponent, CustomHeaderComponent],
    imports: [BrowserModule, AngularPaneManagerModule],
    providers: [],
    bootstrap: [AppComponent],
})
export class AppModule {
}
