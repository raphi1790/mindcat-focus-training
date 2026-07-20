import { describe, expect, it } from 'vitest';
import { resolveDirection } from './useDirectionalInput';

describe('resolveDirection (AP4/Befund E: 4-way für Maze)', () => {
  it('8-way (Standard) lässt Diagonalen unverändert durch', () => {
    expect(resolveDirection(1, 1, '8-way')).toEqual({ dx: 1, dy: 1 });
    expect(resolveDirection(-1, -1, '8-way')).toEqual({ dx: -1, dy: -1 });
    expect(resolveDirection(1, 1)).toEqual({ dx: 1, dy: 1 }); // Default = 8-way
  });

  it('4-way verwirft Diagonalen (kein Move, kein Achsen-Fallback)', () => {
    expect(resolveDirection(1, 1, '4-way')).toBeNull();
    expect(resolveDirection(-1, 1, '4-way')).toBeNull();
    expect(resolveDirection(1, -1, '4-way')).toBeNull();
    expect(resolveDirection(-1, -1, '4-way')).toBeNull();
  });

  it('4-way lässt reine Achsen-Bewegung unverändert durch', () => {
    expect(resolveDirection(1, 0, '4-way')).toEqual({ dx: 1, dy: 0 });
    expect(resolveDirection(-1, 0, '4-way')).toEqual({ dx: -1, dy: 0 });
    expect(resolveDirection(0, 1, '4-way')).toEqual({ dx: 0, dy: 1 });
    expect(resolveDirection(0, -1, '4-way')).toEqual({ dx: 0, dy: -1 });
  });

  it('keine Eingabe liefert in beiden Modi null', () => {
    expect(resolveDirection(0, 0, '4-way')).toBeNull();
    expect(resolveDirection(0, 0, '8-way')).toBeNull();
  });

  it('normalisiert Beträge > 1 auf ±1 (Sign)', () => {
    expect(resolveDirection(5, 0, '4-way')).toEqual({ dx: 1, dy: 0 });
    expect(resolveDirection(-3, 3, '8-way')).toEqual({ dx: -1, dy: 1 });
  });
});
