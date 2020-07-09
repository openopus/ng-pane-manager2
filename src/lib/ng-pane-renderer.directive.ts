import {Directive, ViewContainerRef} from '@angular/core';

@Directive({selector: '[libNgPaneRenderer]'})
export class NgPaneRendererDirective {
    constructor(public viewContainer: ViewContainerRef) {}
}
