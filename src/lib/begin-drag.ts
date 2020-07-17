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

// TODO: investigate backing off on some of the preventDefault/stopPropagation
//       calls in this and beginTouchDrag
/**
 * Helper function for handling drag-and-drop events.  Binds to the window event
 * listeners to provide hassle-free callbacks for drag delta and drag end.
 *
 * This function handles mouse-based events, for touch events see
 * `beginTouchDrag`.
 * @param downEvt the `mousedown` event that initiated the drag
 * @param delta callback for mouse movement
 * @param end callback for the end of the drag
 */
export function beginMouseDrag(downEvt: MouseEvent,
                               delta: DragDeltaHandler|undefined,
                               end?: DragEndHandler): void {
    const opts   = {capture: true, passive: false};
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
            evt.stopImmediatePropagation();
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

/**
 * Compute the average position of all touches in an event.
 * @param evt the touch event to compute the position for
 */
export function averageTouchPos(evt: TouchEvent): [number, number] {
    let x = 0;
    let y = 0;

    for (let i = 0; i < evt.touches.length; i += 1) {
        const touch = evt.touches.item(i) as Touch;
        x += touch.clientX;
        y += touch.clientY;
    }

    return [x / evt.touches.length, y / evt.touches.length];
}

// TODO: differentiate between drag and scroll
/**
 * Helper function for handling drag-and-drop events.  Binds to the window event
 * listeners to provide hassle-free callbacks for drag delta and drag end.
 *
 * This function handles touch-based events, for mouse events see
 * `beginMouseDrag`.
 * @param startEvt the `touchstart` event that initiated the drag
 * @param target the target of the `touchstart` event
 * @param delta callback for touch movement
 * @param end callback for the end of the drag
 */
export function beginTouchDrag(startEvt: TouchEvent,
                               delta: DragDeltaHandler|undefined,
                               end?: DragEndHandler): void {
    const target  = startEvt.target;
    const opts    = {capture: true, passive: false};
    const touches = new Map();

    for (let i = 0; i < startEvt.touches.length; i += 1) {
        const touch = startEvt.touches.item(i) as Touch;
        touches.set(touch.identifier, true);
    }

    const sameTouches = (list: TouchList) => {
        if (list.length !== touches.size) { return false; }

        for (let i = 0; i < list.length; i += 1) {
            const touch = list.item(i) as Touch;
            if (!touches.has(touch.identifier)) { return false; }
        }

        return true;
    };

    let cancel: (isAbort: boolean) => void;
    const touchStart = (evt: TouchEvent) => {
        evt.preventDefault();
        evt.stopImmediatePropagation();
    };
    const touchMove = (evt: TouchEvent) => {
        if (!sameTouches(evt.touches)) { return; }

        // If no delta handler is specified, just perform a dummy drag
        try {
            if (delta !== undefined) {
                const [x, y] = averageTouchPos(evt);
                delta(x, y, cancel);
            }
        }
        catch (e) {
            console.error(e);
            cancel(true);
        }

        evt.preventDefault();
        evt.stopPropagation();
    };
    const selectStart = (evt: Event) => evt.preventDefault();
    const touchEnd = (evt: TouchEvent) => {
        for (let i = 0; i < evt.changedTouches.length; i += 1) {
            const touch = evt.changedTouches.item(i) as Touch;

            touches.delete(touch.identifier);
        }

        if (touches.size === 0) { cancel(false); }
    };
    const touchCancel = (evt: TouchEvent) => {
        for (let i = 0; i < evt.changedTouches.length; i += 1) {
            const touch = evt.changedTouches.item(i) as Touch;

            if (touches.has(touch.identifier)) {
                cancel(true);

                return;
            }
        }
    };
    const keyDown = (evt: KeyboardEvent) => {
        if (evt.key === 'Escape') {
            cancel(true);

            evt.preventDefault();
            evt.stopImmediatePropagation();
        }
    };
    cancel = (isAbort: boolean) => {
        try {
            if (end !== undefined) { end(isAbort); }
        }
        finally {
            window.removeEventListener('touchstart', touchStart, opts);
            window.removeEventListener('touchmove', touchMove, opts);
            window.removeEventListener('selectstart', selectStart, opts);
            window.removeEventListener('touchend', touchEnd, opts);
            window.removeEventListener('touchcancel', touchCancel, opts);
            window.removeEventListener('keydown', keyDown, opts);
            if (target !== null) {
                target.removeEventListener('touchmove', touchMove as EventListener, opts);
                target.removeEventListener('touchend', touchEnd as EventListener, opts);
                target.removeEventListener('touchcancel', touchCancel as EventListener, opts);
            }
        }
    };

    window.addEventListener('touchstart', touchStart, opts);
    window.addEventListener('touchmove', touchMove, opts);
    window.addEventListener('selectstart', selectStart, opts);
    window.addEventListener('touchend', touchEnd, opts);
    window.addEventListener('touchcancel', touchCancel, opts);
    window.addEventListener('keydown', keyDown, opts);
    if (target !== null) {
        target.addEventListener('touchmove', touchMove as EventListener, opts);
        target.addEventListener('touchend', touchEnd as EventListener, opts);
        target.addEventListener('touchcancel', touchCancel as EventListener, opts);
    }
}
