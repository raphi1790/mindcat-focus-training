/**
 * Pure Gamepad-/Arcade-Auswertung — von den React-Hooks getrennt, damit die
 * Mapping-Logik ohne DOM testbar ist.
 *
 * Unterstützte Hardware (Scope-Entscheidung: Tastatur + Arcade):
 *  - Analog-Stick (Achsen 0/1) mit Deadzone
 *  - D-Pad (Standard-Mapping, Buttons 12–15)
 *  - Arcade-Buttons (Speedlink-Mapping):
 *      Buttons 1, 3 (links rund/dreieckig)  → LINKS
 *      Buttons 0, 2 (rechts rund/dreieckig) → RECHTS
 */

export type Axis = -1 | 0 | 1;

export interface Direction {
  dx: Axis;
  dy: Axis;
}

export type Choice = 'L' | 'R';

export const DEFAULT_DEADZONE = 0.3;

/** Minimale strukturelle Sicht auf ein Gamepad (erleichtert Tests). */
export interface GamepadLike {
  axes: ReadonlyArray<number>;
  buttons: ReadonlyArray<{ pressed: boolean }>;
}

const DPAD = { up: 12, down: 13, left: 14, right: 15 } as const;
const ARCADE_LEFT = [1, 3] as const;
const ARCADE_RIGHT = [0, 2] as const;

function pressed(gp: GamepadLike, index: number): boolean {
  return gp.buttons[index]?.pressed === true;
}

/**
 * 8-Wege-Richtung aus einem Gamepad (für Navigations-Übungen).
 * Priorität: Analog-Stick → D-Pad → Arcade-Buttons (nur horizontal).
 */
export function directionFromGamepad(
  gp: GamepadLike,
  deadzone: number = DEFAULT_DEADZONE,
): Direction {
  let dx = 0;
  let dy = 0;

  const xAxis = gp.axes[0] ?? 0;
  const yAxis = gp.axes[1] ?? 0;
  if (xAxis < -deadzone) dx = -1;
  if (xAxis > deadzone) dx = 1;
  if (yAxis < -deadzone) dy = -1;
  if (yAxis > deadzone) dy = 1;

  if (pressed(gp, DPAD.up)) dy = -1;
  if (pressed(gp, DPAD.down)) dy = 1;
  if (pressed(gp, DPAD.left)) dx = -1;
  if (pressed(gp, DPAD.right)) dx = 1;

  if (ARCADE_LEFT.some((i) => pressed(gp, i))) dx = -1;
  if (ARCADE_RIGHT.some((i) => pressed(gp, i))) dx = 1;

  return { dx: Math.sign(dx) as Axis, dy: Math.sign(dy) as Axis };
}

/**
 * Binäre L/R-Wahl aus einem Gamepad (für den ANT).
 * Bei gleichzeitigem L+R (widersprüchlich) → null.
 */
export function choiceFromGamepad(
  gp: GamepadLike,
  deadzone: number = DEFAULT_DEADZONE,
): Choice | null {
  const xAxis = gp.axes[0] ?? 0;
  const left =
    xAxis < -deadzone || pressed(gp, DPAD.left) || ARCADE_LEFT.some((i) => pressed(gp, i));
  const right =
    xAxis > deadzone || pressed(gp, DPAD.right) || ARCADE_RIGHT.some((i) => pressed(gp, i));

  if (left && right) return null;
  if (left) return 'L';
  if (right) return 'R';
  return null;
}

/** Alle verbundenen Gamepads (null-bereinigt); getrennt für Testbarkeit. */
export function connectedGamepads(): GamepadLike[] {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
  return Array.from(navigator.getGamepads()).filter((gp): gp is Gamepad => gp !== null);
}
