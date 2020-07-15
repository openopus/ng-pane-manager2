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

/**
 * Callback to indicate an ongoing drag should be cancelled or aborted.
 * @param isAbort set to `true` if the drag-end handler should be notified the
 *                drag was aborted
 */
export type DragCancelFn = (isAbort: boolean) => void;

/**
 * Callback for handling mouse movement during a drag.
 * @param clientX the client X position of the cursor
 * @param clientY the client Y position of the cursor
 * @param cancel callback to indicate the drag should be cancelled or aborted
 */
export type DragDeltaHandler = (clientX: number, clientY: number, cancel: DragCancelFn) => void;

/**
 * Callback for handling the end of a drag.
 * @param isAbort indicates if the current drag ended in an error
 */
export type DragEndHandler = (isAbort: boolean) => void;

/**
 * Helper function for handling drag-and-drop events.  Binds to the window event
 * listeners to provide hassle-free callbacks for drag delta and drag end.
 * @param downEvt the `mousedown` event that initiated the drag
 * @param delta callback for mouse movement
 * @param end callback for the end of the drag
 */
export function beginMouseDrag(downEvt: MouseEvent,
                               delta: DragDeltaHandler|undefined,
                               end?: DragEndHandler): void {
    const opts   = {capture: true};
    const button = downEvt.button;

    let cancel: (isAbort: boolean) => void;
    const mouseDown = (evt: MouseEvent) => {
        evt.preventDefault();
        evt.stopImmediatePropagation();
    };
    const mouseMove = (evt: MouseEvent) => {
        // If no delta handler is specified, just perform a dummy drag
        try {
            if (delta !== undefined) { delta(evt.clientX, evt.clientY, cancel); }
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
        if (evt.button !== button) { return; }

        cancel(false);
    };
    const keyDown = (evt: KeyboardEvent) => {
        if (evt.key === 'Escape') {
            cancel(true);

            evt.preventDefault();
            evt.stopPropagation();
        }
    };
    cancel = (isAbort: boolean) => {
        try {
            if (end !== undefined) { end(isAbort); }
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
