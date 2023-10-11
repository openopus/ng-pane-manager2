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
 * @param modifiers any modifiers that were pressed when the drag ended
 * @param cancel callback to indicate the drag should be cancelled or aborted
 */
export type DragDeltaHandler = (
    clientX: number,
    clientY: number,
    modifiers: DragModifiers,
    cancel: DragCancelFn,
) => void;

/**
 * Callback for handling the end of a drag.
 * @param isAbort indicates if the current drag ended in an error
 * @param modifiers any modifiers that were pressed when the drag ended
 */
export type DragEndHandler = (isAbort: boolean, modifiers: DragModifiers) => void;

/** Convenience wrapper for modifier keys */
export interface DragModifiers {
    /** The Alt key (Option on Mac) */
    alt: boolean;
    /** The Ctrl key */
    ctrl: boolean;
    /** The Meta key (Win on Windows, Command on Mac) */
    meta: boolean;
    /** The Shift key */
    shift: boolean;
}

/** Common context for all drag operations */
interface DragCtx {
    /** Attempt to run the drag handler */
    tryDelta(x: number, y: number, evt: MouseEvent | TouchEvent): void;

    /**
     * Add cleanup code for when the drag ends.\
     * **NOTE:** Will not store more than one handler!
     */
    catchRelease(handler: () => void): void;

    /** Request a drag end */
    cancel(isAbort: boolean, evt: MouseEvent | TouchEvent): void;
}

const EVT_OPTS: EventListenerOptions & {
    /** Because EventListenerOptions didn't have this */
    passive: boolean;
} = {
    capture: true,
    passive: false,
};

/** Generate a wrapper object for event modifier keys */
function getMods(
    evt: MouseEvent | KeyboardEvent | TouchEvent,
    override?: [string, boolean],
): DragModifiers {
    const ret = {
        alt: evt.altKey,
        ctrl: evt.ctrlKey,
        meta: evt.metaKey,
        shift: evt.shiftKey,
    };

    // Sometimes key events don't have the changed key set correctly in the modifiers.
    // So here we are...
    if (override !== undefined) {
        const [key, val] = override;

        switch (key) {
            case 'Alt':
                ret.alt = val;
                break;
            case 'Ctrl':
                ret.ctrl = val;
                break;
            case 'Meta':
            case 'OS':
                ret.meta = val;
                break;
            case 'Shift':
                ret.shift = val;
                break;
        }
    }

    return Object.freeze(ret);
}

/** Returns true if the given value for `evt.key` is a modifier key */
function isModifier(key: string): boolean {
    switch (key) {
        case 'Alt':
        case 'Control':
        case 'Meta':
        case 'OS':
        case 'Shift':
            return true;
        default:
            return false;
    }
}

/** Creates a drag context containing common drag logic */
function makeCtx(
    startX: number,
    startY: number,
    delta: DragDeltaHandler | undefined,
    end: DragEndHandler | undefined,
): DragCtx {
    let lastX = startX;
    let lastY = startY;
    let release: (() => void) | undefined;

    // Convenience functions and exports
    let cancel: (isAbort: boolean, modifiers: DragModifiers) => void;
    const tryDelta = (x: number, y: number, modifiers: () => DragModifiers) => {
        if (delta !== undefined) {
            try {
                const mods = modifiers();

                delta(x, y, mods, a => cancel(a, mods));
            } catch (e) {
                console.error(e);
                cancel(true, modifiers());
            }
        }

        lastX = x;
        lastY = y;
    };
    const catchRelease = (handler: () => void) => {
        release = handler;
    };

    // Event handlers
    const selectStart = (evt: Event) => evt.preventDefault();
    const keyDown = (evt: KeyboardEvent) => {
        if (evt.key === 'Escape') {
            cancel(true, getMods(evt, [evt.key, true]));
        } else if (isModifier(evt.key)) {
            tryDelta(lastX, lastY, () => getMods(evt, [evt.key, true]));
        } else {
            return;
        }

        evt.preventDefault();
        evt.stopImmediatePropagation();
    };
    const keyUp = (evt: KeyboardEvent) => {
        if (isModifier(evt.key)) {
            tryDelta(lastX, lastY, () => getMods(evt, [evt.key, false]));
        } else {
            return;
        }

        evt.preventDefault();
        evt.stopImmediatePropagation();
    };

    // The cancel function
    cancel = (isAbort: boolean, modifiers: DragModifiers) => {
        try {
            if (end !== undefined) {
                end(isAbort, modifiers);
            }
        } finally {
            window.removeEventListener('selectstart', selectStart, EVT_OPTS);
            window.removeEventListener('keydown', keyDown, EVT_OPTS);
            window.removeEventListener('keyup', keyUp, EVT_OPTS);
            if (release !== undefined) {
                release();
            }
        }
    };

    window.addEventListener('selectstart', selectStart, EVT_OPTS);
    window.addEventListener('keydown', keyDown, EVT_OPTS);
    window.addEventListener('keyup', keyUp, EVT_OPTS);

    return {
        tryDelta: (x, y, e) => tryDelta(x, y, () => getMods(e)),
        catchRelease,
        cancel: (a, e) => cancel(a, getMods(e)),
    };
}

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
export function beginMouseDrag(
    downEvt: MouseEvent,
    delta: DragDeltaHandler | undefined,
    end?: DragEndHandler,
): void {
    const button = downEvt.button;

    const { tryDelta, catchRelease, cancel } = makeCtx(
        downEvt.clientX,
        downEvt.clientY,
        delta,
        end,
    );

    const mouseDown = (evt: MouseEvent) => {
        evt.preventDefault();
        evt.stopImmediatePropagation();
    };
    const mouseMove = (evt: MouseEvent) => {
        // If no delta handler is specified, just perform a dummy drag
        tryDelta(evt.clientX, evt.clientY, evt);

        evt.preventDefault();
        evt.stopPropagation();
    };
    const mouseUp = (evt: MouseEvent) => {
        if (evt.button !== button) {
            return;
        }

        cancel(false, evt);
    };

    catchRelease(() => {
        window.removeEventListener('mousedown', mouseDown, EVT_OPTS);
        window.removeEventListener('mousemove', mouseMove, EVT_OPTS);
        window.removeEventListener('mouseup', mouseUp, EVT_OPTS);
    });

    window.addEventListener('mousedown', mouseDown, EVT_OPTS);
    window.addEventListener('mousemove', mouseMove, EVT_OPTS);
    window.addEventListener('mouseup', mouseUp, EVT_OPTS);
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
export function beginTouchDrag(
    startEvt: TouchEvent,
    delta: DragDeltaHandler | undefined,
    end?: DragEndHandler,
): void {
    const target = startEvt.target;
    const touches = new Map();

    for (let i = 0; i < startEvt.touches.length; i += 1) {
        const touch = startEvt.touches.item(i) as Touch;
        touches.set(touch.identifier, true);
    }

    const sameTouches = (list: TouchList) => {
        if (list.length !== touches.size) {
            return false;
        }

        for (let i = 0; i < list.length; i += 1) {
            const touch = list.item(i) as Touch;
            if (!touches.has(touch.identifier)) {
                return false;
            }
        }

        return true;
    };

    const [startX, startY] = averageTouchPos(startEvt);
    const { tryDelta, catchRelease, cancel } = makeCtx(startX, startY, delta, end);

    const touchStart = (evt: TouchEvent) => {
        evt.preventDefault();
        evt.stopImmediatePropagation();
    };
    const touchMove = (evt: TouchEvent) => {
        if (!sameTouches(evt.touches)) {
            return;
        }

        const [x, y] = averageTouchPos(evt);
        tryDelta(x, y, evt);

        evt.preventDefault();
        evt.stopPropagation();
    };
    const touchEnd = (evt: TouchEvent) => {
        for (let i = 0; i < evt.changedTouches.length; i += 1) {
            const touch = evt.changedTouches.item(i) as Touch;

            touches.delete(touch.identifier);
        }

        if (touches.size === 0) {
            cancel(false, evt);
        }
    };
    const touchCancel = (evt: TouchEvent) => {
        for (let i = 0; i < evt.changedTouches.length; i += 1) {
            const touch = evt.changedTouches.item(i) as Touch;

            if (touches.has(touch.identifier)) {
                cancel(true, evt);

                return;
            }
        }
    };

    catchRelease(() => {
        window.removeEventListener('touchstart', touchStart, EVT_OPTS);
        window.removeEventListener('touchmove', touchMove, EVT_OPTS);
        window.removeEventListener('touchend', touchEnd, EVT_OPTS);
        window.removeEventListener('touchcancel', touchCancel, EVT_OPTS);
        if (target !== null) {
            target.removeEventListener('touchmove', touchMove as EventListener, EVT_OPTS);
            target.removeEventListener('touchend', touchEnd as EventListener, EVT_OPTS);
            target.removeEventListener('touchcancel', touchCancel as EventListener, EVT_OPTS);
        }
    });

    window.addEventListener('touchstart', touchStart, EVT_OPTS);
    window.addEventListener('touchmove', touchMove, EVT_OPTS);
    window.addEventListener('touchend', touchEnd, EVT_OPTS);
    window.addEventListener('touchcancel', touchCancel, EVT_OPTS);
    if (target !== null) {
        target.addEventListener('touchmove', touchMove as EventListener, EVT_OPTS);
        target.addEventListener('touchend', touchEnd as EventListener, EVT_OPTS);
        target.addEventListener('touchcancel', touchCancel as EventListener, EVT_OPTS);
    }
}
