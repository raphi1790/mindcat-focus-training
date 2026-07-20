import { describe, expect, it } from 'vitest';
import { moveSelection } from './useArraySelectInput';

describe('moveSelection', () => {
  it('bewegt den Index um dx, klemmt aber an den Rändern (kein Wrap-Around)', () => {
    expect(moveSelection(2, 1, 5)).toBe(3);
    expect(moveSelection(2, -1, 5)).toBe(1);
    expect(moveSelection(4, 1, 5)).toBe(4); // rechter Rand
    expect(moveSelection(0, -1, 5)).toBe(0); // linker Rand
  });

  it('normalisiert dx auf ±1 (Sign), auch bei größeren Werten', () => {
    expect(moveSelection(2, 5, 5)).toBe(3);
    expect(moveSelection(2, -5, 5)).toBe(1);
  });

  it('dx=0 lässt den Index unverändert', () => {
    expect(moveSelection(3, 0, 5)).toBe(3);
  });

  it('leeres/ungültiges Array (count<=0) liefert 0', () => {
    expect(moveSelection(0, 1, 0)).toBe(0);
    expect(moveSelection(2, 1, -1)).toBe(0);
  });
});
