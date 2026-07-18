import { describe, expect, it } from 'vitest';
import {
  choiceFromGamepad,
  confirmPressedFromGamepad,
  directionFromGamepad,
  type GamepadLike,
} from './gamepad';

function pad(overrides: Partial<{ axes: number[]; pressed: number[] }> = {}): GamepadLike {
  const buttons = Array.from({ length: 17 }, (_, i) => ({
    pressed: overrides.pressed?.includes(i) ?? false,
  }));
  return { axes: overrides.axes ?? [0, 0], buttons };
}

describe('directionFromGamepad', () => {
  it('neutraler Zustand → keine Bewegung', () => {
    expect(directionFromGamepad(pad())).toEqual({ dx: 0, dy: 0 });
  });

  it('Analog-Stick respektiert die Deadzone', () => {
    expect(directionFromGamepad(pad({ axes: [0.29, -0.29] }))).toEqual({ dx: 0, dy: 0 });
    expect(directionFromGamepad(pad({ axes: [0.31, 0] }))).toEqual({ dx: 1, dy: 0 });
    expect(directionFromGamepad(pad({ axes: [-0.31, 0] }))).toEqual({ dx: -1, dy: 0 });
    expect(directionFromGamepad(pad({ axes: [0, -0.31] }))).toEqual({ dx: 0, dy: -1 });
    expect(directionFromGamepad(pad({ axes: [0, 0.31] }))).toEqual({ dx: 0, dy: 1 });
  });

  it('Diagonale aus Stick-Achsen', () => {
    expect(directionFromGamepad(pad({ axes: [0.8, 0.8] }))).toEqual({ dx: 1, dy: 1 });
  });

  it('D-Pad (Buttons 12–15)', () => {
    expect(directionFromGamepad(pad({ pressed: [12] }))).toEqual({ dx: 0, dy: -1 });
    expect(directionFromGamepad(pad({ pressed: [13] }))).toEqual({ dx: 0, dy: 1 });
    expect(directionFromGamepad(pad({ pressed: [14] }))).toEqual({ dx: -1, dy: 0 });
    expect(directionFromGamepad(pad({ pressed: [15] }))).toEqual({ dx: 1, dy: 0 });
  });

  it('Arcade-Buttons: 1/3 → links, 0/2 → rechts', () => {
    expect(directionFromGamepad(pad({ pressed: [1] }))).toEqual({ dx: -1, dy: 0 });
    expect(directionFromGamepad(pad({ pressed: [3] }))).toEqual({ dx: -1, dy: 0 });
    expect(directionFromGamepad(pad({ pressed: [0] }))).toEqual({ dx: 1, dy: 0 });
    expect(directionFromGamepad(pad({ pressed: [2] }))).toEqual({ dx: 1, dy: 0 });
  });

  it('fehlende Achsen/Buttons (kurze Arrays) crashen nicht', () => {
    const minimal: GamepadLike = { axes: [], buttons: [] };
    expect(directionFromGamepad(minimal)).toEqual({ dx: 0, dy: 0 });
  });
});

describe('choiceFromGamepad', () => {
  it('neutral → null', () => {
    expect(choiceFromGamepad(pad())).toBeNull();
  });

  it('Stick links/rechts → L/R (mit Deadzone)', () => {
    expect(choiceFromGamepad(pad({ axes: [-0.8, 0] }))).toBe('L');
    expect(choiceFromGamepad(pad({ axes: [0.8, 0] }))).toBe('R');
    expect(choiceFromGamepad(pad({ axes: [0.2, 0] }))).toBeNull();
  });

  it('D-Pad links/rechts → L/R', () => {
    expect(choiceFromGamepad(pad({ pressed: [14] }))).toBe('L');
    expect(choiceFromGamepad(pad({ pressed: [15] }))).toBe('R');
  });

  it('Arcade-Buttons → L/R', () => {
    expect(choiceFromGamepad(pad({ pressed: [1] }))).toBe('L');
    expect(choiceFromGamepad(pad({ pressed: [3] }))).toBe('L');
    expect(choiceFromGamepad(pad({ pressed: [0] }))).toBe('R');
    expect(choiceFromGamepad(pad({ pressed: [2] }))).toBe('R');
  });

  it('widersprüchliche Eingabe (L+R gleichzeitig) → null', () => {
    expect(choiceFromGamepad(pad({ pressed: [1, 0] }))).toBeNull();
    expect(choiceFromGamepad(pad({ pressed: [14, 15] }))).toBeNull();
  });
});

describe('confirmPressedFromGamepad', () => {
  it('neutral → false', () => {
    expect(confirmPressedFromGamepad(pad())).toBe(false);
  });

  it('jeder der vier Arcade-Buttons (0-3) bestätigt', () => {
    expect(confirmPressedFromGamepad(pad({ pressed: [0] }))).toBe(true);
    expect(confirmPressedFromGamepad(pad({ pressed: [1] }))).toBe(true);
    expect(confirmPressedFromGamepad(pad({ pressed: [2] }))).toBe(true);
    expect(confirmPressedFromGamepad(pad({ pressed: [3] }))).toBe(true);
  });

  it('D-Pad allein bestätigt nicht', () => {
    expect(confirmPressedFromGamepad(pad({ pressed: [12, 13, 14, 15] }))).toBe(false);
  });

  it('fehlende Buttons (kurzes Array) crashen nicht', () => {
    const minimal: GamepadLike = { axes: [], buttons: [] };
    expect(confirmPressedFromGamepad(minimal)).toBe(false);
  });
});
