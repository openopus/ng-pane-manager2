/*******************************************************************************
 *
 * angular-pane-manager - a port of ng-pane-manager to Angular 2+ (util.ts)
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

/** A very small number. */
export const EPSILON = 1e-7;

/**
 * Prevent floating point numbers from reaching or going below zero, useful for
 * positive divisors.
 * @param x the number to clamp
 */
export function clipDenormPos(x: number): number {
    if (!isFinite(x) || x > EPSILON) {
        return x;
    }

    return EPSILON;
}

/**
 * Prevent floating point numbers from reaching zero, useful for divisors.
 * @param x the number to clamp
 */
export function clipDenorm(x: number): number {
    if (!isFinite(x) || Math.abs(x) > EPSILON) {
        return x;
    }

    return EPSILON * Math.sign(x);
}
