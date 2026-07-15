import { describe, expect, it } from 'vitest';
import { createRng, generateSeed } from './index';

describe('createRng', () => {
  it('liefert für gleichen Seed exakt dieselbe Sequenz (Determinismus)', () => {
    const a = createRng('assessment-123');
    const b = createRng('assessment-123');
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('liefert für unterschiedliche Seeds unterschiedliche Sequenzen', () => {
    const a = Array.from({ length: 20 }, () => createRng('seed-a').next());
    const b = Array.from({ length: 20 }, () => createRng('seed-b').next());
    expect(a).not.toEqual(b);
  });

  it('next() bleibt in [0, 1)', () => {
    const rng = createRng('range-check');
    for (let i = 0; i < 10_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  describe('int', () => {
    it('bleibt in [min, max) und erreicht beide Randbereiche', () => {
      const rng = createRng('int-check');
      const seen = new Set<number>();
      for (let i = 0; i < 5_000; i++) {
        const v = rng.int(400, 1601); // Fixationsdauer-Bereich des ANT
        expect(v).toBeGreaterThanOrEqual(400);
        expect(v).toBeLessThan(1601);
        seen.add(v);
      }
      expect(seen.has(400)).toBe(true);
      expect(seen.has(1600)).toBe(true);
    });

    it('wirft bei leerem oder nicht-ganzzahligem Bereich', () => {
      const rng = createRng('int-errors');
      expect(() => rng.int(5, 5)).toThrow();
      expect(() => rng.int(5, 4)).toThrow();
      expect(() => rng.int(0.5, 2)).toThrow();
    });
  });

  describe('shuffle', () => {
    it('ist deterministisch bei gleichem Seed', () => {
      const items = Array.from({ length: 48 }, (_, i) => i);
      expect(createRng('s').shuffle(items)).toEqual(createRng('s').shuffle(items));
    });

    it('liefert eine echte Permutation und mutiert die Eingabe nicht', () => {
      const items = Array.from({ length: 48 }, (_, i) => i);
      const frozen = [...items];
      const shuffled = createRng('perm').shuffle(items);
      expect(items).toEqual(frozen); // Eingabe unverändert
      expect([...shuffled].sort((a, b) => a - b)).toEqual(frozen);
      expect(shuffled).not.toEqual(frozen); // bei 48 Elementen praktisch sicher
    });
  });

  it('pick wählt nur Elemente aus dem Array', () => {
    const rng = createRng('pick');
    const items = ['L', 'R'] as const;
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(rng.pick(items));
    }
    expect(() => rng.pick([])).toThrow();
  });
});

describe('generateSeed', () => {
  it('erzeugt eindeutige, nicht-leere Seeds', () => {
    const seeds = new Set(Array.from({ length: 100 }, () => generateSeed()));
    expect(seeds.size).toBe(100);
    for (const s of seeds) expect(s.length).toBeGreaterThan(8);
  });
});
