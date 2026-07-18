import { describe, expect, it } from 'vitest';
import { deriveAvatar } from './avatar';

describe('deriveAvatar', () => {
  it('ist deterministisch (gleiche childId → gleicher Avatar)', () => {
    const a = deriveAvatar('child-abc-123');
    const b = deriveAvatar('child-abc-123');
    expect(a).toEqual(b);
  });

  it('liefert für unterschiedliche IDs typischerweise unterschiedliche Avatare', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `child-${i}`);
    const avatars = ids.map(deriveAvatar);
    const uniqueAnimals = new Set(avatars.map((a) => a.animal));
    // Nicht alle 20 sollten auf dasselbe Tier hashen.
    expect(uniqueAnimals.size).toBeGreaterThan(1);
  });

  it('liefert immer ein bekanntes Tier/Farbe-Paar (keine undefined-Werte)', () => {
    const { animal, color } = deriveAvatar('');
    expect(typeof animal).toBe('string');
    expect(animal.length).toBeGreaterThan(0);
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('funktioniert auch mit leerem String / Sonderzeichen', () => {
    expect(() => deriveAvatar('')).not.toThrow();
    expect(() => deriveAvatar('äöü-🐱-!@#')).not.toThrow();
  });
});
