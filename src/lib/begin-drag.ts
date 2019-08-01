/*******************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (begin-drag.ts)
 * Copyright (C) 2019 Opus Logica
 *
 * angular-pane-manager is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * angular-pane-manager is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with angular-pane-manager.  If not, see <https://www.gnu.org/licenses/>.
 *
 ******************************************************************************/

export type DragCancelFn = (isAbort: boolean) => void;
export type DragDeltaHandler = (clientX: number, clientY: number, cancel: DragCancelFn) => void;
export type DragEndHandler = (isAbort: boolean) => void;

export function beginMouseDrag(downEvt: MouseEvent, delta: DragDeltaHandler, end?: DragEndHandler) {
    const opts   = {capture: true};
    const button = downEvt.button;

    const mouseDown = (evt: MouseEvent) => {
        evt.preventDefault();
        evt.stopImmediatePropagation();
    };
    const mouseMove = (evt: MouseEvent) => {
        // If no delta handler is specified, just perform a dummy drag
        try {
            if (delta) delta(evt.clientX, evt.clientY, cancel);
        }
        catch (e) {
            console.error(e);
            cancel(true);
        }

        evt.preventDefault();
        evt.stopPropagation();
    };
    const selectStart = (evt: Event) => evt.preventDefault();
    const mouseUp = (evt: MouseEvent) => {
        if (evt.button !== button) return;

        cancel(false);
    };
    const keyDown = (evt: KeyboardEvent) => {
        if (evt.key === 'Escape') {
            cancel(true);

            evt.preventDefault();
            evt.stopPropagation();
        }
    };
    const cancel = (isAbort: boolean) => {
        try {
            if (end) end(isAbort);
        }
        finally {
            window.removeEventListener('mousedown', mouseDown, opts);
            window.removeEventListener('mousemove', mouseMove, opts);
            window.removeEventListener('selectstart', selectStart, opts);
            window.removeEventListener('mouseup', mouseUp, opts);
            window.removeEventListener('keydown', keyDown, opts);
        }
    };

    window.addEventListener('mousedown', mouseDown, opts);
    window.addEventListener('mousemove', mouseMove, opts);
    window.addEventListener('selectstart', selectStart, opts);
    window.addEventListener('mouseup', mouseUp, opts);
    window.addEventListener('keydown', keyDown, opts);
}

export class MouseDragBehavior {
    constructor(downEvt: MouseEvent) {}
}