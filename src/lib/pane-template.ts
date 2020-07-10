import {TemplateRef} from '@angular/core';
import {Observable} from 'rxjs';

// TODO: prevent tabifying headerless panes
// TODO: add size constraints/no-resize mode?
export const enum PaneHeaderMode {
    Hidden,
    Visible,
    AlwaysTab,
}

export interface PaneHeaderStyle {
    headerMode: PaneHeaderMode;
    title: Observable<string>;
    icon: Observable<string|undefined>;
    closable: boolean;
}

export interface LeafNodeContext {
    header: PaneHeaderStyle;
}

export type LeafNodeTemplate = [TemplateRef<LeafNodeContext>, LeafNodeContext];
