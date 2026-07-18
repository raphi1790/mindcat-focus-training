import { describe, expect, it } from 'vitest';
import { moveGridFocus } from './gridNav';

const RIGHT = { dx: 1, dy: 0 } as const;
const LEFT = { dx: -1, dy: 0 } as const;
const DOWN = { dx: 0, dy: 1 } as const;
const UP = { dx: 0, dy: -1 } as const;
const NONE = { dx: 0, dy: 0 } as const;

describe('moveGridFocus', () => {
  it('bewegt sich innerhalb einer Reihe nach rechts/links', () => {
    expect(moveGridFocus(0, RIGHT, 6, 3)).toBe(1);
    expect(moveGridFocus(1, LEFT, 6, 3)).toBe(0);
  });

  it('bewegt sich zwischen Reihen nach unten/oben', () => {
    // 3 Spalten: Index 0 = (Reihe 0, Spalte 0); Runter → Index 3.
    expect(moveGridFocus(0, DOWN, 6, 3)).toBe(3);
    expect(moveGridFocus(3, UP, 6, 3)).toBe(0);
  });

  it('bleibt am rechten Rand stehen (kein Wrap-Around)', () => {
    expect(moveGridFocus(2, RIGHT, 6, 3)).toBe(2);
  });

  it('bleibt am linken Rand stehen', () => {
    expect(moveGridFocus(0, LEFT, 6, 3)).toBe(0);
  });

  it('bleibt in der obersten/untersten Reihe stehen', () => {
    expect(moveGridFocus(0, UP, 6, 3)).toBe(0);
    expect(moveGridFocus(3, DOWN, 6, 3)).toBe(3); // letzte volle Reihe
  });

  it('klemmt auf den letzten Index bei unvollständiger letzter Reihe', () => {
    // 5 Items, 3 Spalten → letzte Reihe hat nur 2 Einträge (Index 3,4).
    expect(moveGridFocus(4, RIGHT, 5, 3)).toBe(4);
    expect(moveGridFocus(1, DOWN, 5, 3)).toBe(4); // Spalte 1, Reihe 1 existiert nicht → klemmen
  });

  it('keine Richtung → Index bleibt unverändert', () => {
    expect(moveGridFocus(2, NONE, 6, 3)).toBe(2);
  });

  it('leeres Raster → Index bleibt unverändert', () => {
    expect(moveGridFocus(0, RIGHT, 0, 3)).toBe(0);
  });

  it('einzelnes Element → bleibt bei 0', () => {
    expect(moveGridFocus(0, RIGHT, 1, 3)).toBe(0);
    expect(moveGridFocus(0, DOWN, 1, 3)).toBe(0);
  });
});
