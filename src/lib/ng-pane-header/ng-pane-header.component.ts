/*****************************************************************************************
 *
 * ng-pane-manager2 - a port of ng-pane-manager to Angular 2+ (ng-pane-header.component.ts)
 * Copyright (C) 2019 Opus Logica
 *
 * ng-pane-manager2 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * ng-pane-manager2 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with ng-pane-manager2.  If not, see <https://www.gnu.org/licenses/>.
 *
 ****************************************************************************************/

import {Component, HostListener, Input} from '@angular/core';

import {NgPaneManagerComponent} from '../ng-pane-manager.component';
import {BranchLayout, LayoutType, PaneLayout} from '../pane-layout';

enum DropOrientation {
    Left,
    Top,
    Right,
    Bottom,
    Tabbed,
}

function computeDropOrientation(evt: MouseEvent, rect: ClientRect): DropOrientation {
    const TAB_RADIUS = 0.15;

    const posX = (evt.clientX - rect.left) / rect.width - 0.5;
    const posY = (evt.clientY - rect.top) / rect.height - 0.5;

    if (posX >= -TAB_RADIUS && posX < TAB_RADIUS && posY >= -TAB_RADIUS && posY < TAB_RADIUS)
        return DropOrientation.Tabbed;

    if (Math.abs(posX) > Math.abs(posY))
        return posX < 0 ? DropOrientation.Left : DropOrientation.Right;
    else
        return posY < 0 ? DropOrientation.Top : DropOrientation.Bottom;
}

@Component({
    selector: 'lib-ng-pane-header',
    template: 'title',
    styleUrls: ['./ng-pane-header.component.scss'],
})
export class NgPaneHeaderComponent {
    @Input() manager: NgPaneManagerComponent;
    @Input() branch: BranchLayout;
    @Input() index: number;

    @HostListener('mousedown', ['$event'])
    private onMouseDown(evt: MouseEvent) {
        const opts = {capture: true};

        let startPos: {x: number, y: number} = {x: evt.clientX, y: evt.clientY};
        let origLayout: PaneLayout           = this.manager.layout;
        let floatingLayout: PaneLayout;
        let dropRatio: number = 0.5; // NB: unlike normal ratios, this is from 0 to 1
        let dropTarget: PaneLayout;
        let dropOrientation: DropOrientation;

        // Disable drag'n'drop if we don't have a parent branch (i.e. we're the
        // root layout node).  This should only happen if the layout consists of
        // a single leaf and nothing else.
        const listener = this.branch ? (evt: MouseEvent) => {
            if (floatingLayout) {
                const rect = this.manager.el.nativeElement.getClientRects()[0];

                const MARGIN = 8;

                if (evt.clientX >= (rect.left + MARGIN) && evt.clientX < (rect.right - MARGIN) &&
                    evt.clientY >= (rect.top + MARGIN) && evt.clientY < (rect.bottom - MARGIN)) {

                    const els = document.elementsFromPoint(evt.clientX, evt.clientY)
                                    .filter(e => this.manager.hitTargets.has(e))
                                    .map(e => [e, this.manager.hitTargets.get(e)] as [Element,
                                                                                      PaneLayout]);

                    const target = els.find(e => e[1].type === LayoutType.Tabbed ||
                                                 e[1].type === LayoutType.Leaf);

                    // TODO: switch tabs if i hold a floating layout over its header for long enough
                    // TODO: interact with tabs to determine what index to insert a tab
                    // TODO: dropping on a header should tabify

                    if (target) {
                        dropTarget      = target[1];
                        dropOrientation = dropTarget.type === LayoutType.Tabbed
                                              ? DropOrientation.Tabbed
                                              : computeDropOrientation(
                                                    evt, target[0].getClientRects()[0]);
                    }
                    else
                        dropTarget = dropOrientation = undefined;
                }
                else {
                    dropTarget      = this.manager.layout;
                    dropOrientation = computeDropOrientation(evt, rect);
                }
            }
            else if (Math.abs(evt.clientX - startPos.x) >= 5 ||
                     Math.abs(evt.clientY - startPos.y) >= 5) {
                const ratioSum = this.branch.ratioSum;
                const {
                    layout: withoutChild,
                    removed,
                    removedRatio,
                } = this.branch.withoutChild(this.index);

                floatingLayout = removed;

                if (removedRatio) dropRatio = removedRatio / ratioSum;

                const transposed = this.manager.layout.transposeDeep(this.branch, withoutChild);

                if (transposed) {
                    this.manager.layout = transposed;

                    // TODO: make the floating child float
                }
                else
                    mouseUpListener(); // Abort if we can't pick up the panel
            }
        } : undefined;

        const selectListener = (evt: Event) => evt.preventDefault();
        const mouseUpListener = () => {
            if (floatingLayout && dropTarget) {
                let replace: PaneLayout;

                // TODO: should gravity/group be inherited?  Gravity probably
                //       shouldn't, but should the group encapsulate the new
                //       parent, or just the split child?

                // TODO: this split strategy puts splits inside tabs, which
                //       should not happen

                switch (dropOrientation) {
                case DropOrientation.Left:
                    replace = BranchLayout.split(LayoutType.Horiz,
                                                 [floatingLayout, dropTarget],
                                                 [dropRatio, 1 - dropRatio]);
                    break;
                case DropOrientation.Top:
                    replace = BranchLayout.split(LayoutType.Vert,
                                                 [floatingLayout, dropTarget],
                                                 [dropRatio, 1 - dropRatio]);
                    break;
                case DropOrientation.Right:
                    replace = BranchLayout.split(LayoutType.Horiz,
                                                 [dropTarget, floatingLayout],
                                                 [1 - dropRatio, dropRatio]);
                    break;
                case DropOrientation.Bottom:
                    replace = BranchLayout.split(LayoutType.Vert,
                                                 [dropTarget, floatingLayout],
                                                 [1 - dropRatio, dropRatio]);
                    break;
                case DropOrientation.Tabbed:
                    replace = BranchLayout.tabbed([dropTarget, floatingLayout], 1);
                    break;
                }

                const transposed = this.manager.layout.transposeDeep(dropTarget, replace);

                if (transposed)
                    this.manager.layout = transposed;
                else {
                    console.error('Failed to insert floating panel into drop target');
                }
            }
            else
                this.manager.layout = origLayout;

            window.removeEventListener('mousemove', listener, opts);
            window.removeEventListener('selectstart', selectListener, opts);
            window.removeEventListener('mouseup', mouseUpListener, opts);
        };

        window.addEventListener('mousemove', listener, opts);
        window.addEventListener('selectstart', selectListener, opts);
        window.addEventListener('mouseup', mouseUpListener, opts);
    }
}
