import { describe, expect, it } from 'vitest';
import type { Trial } from '../data/schema';
import { buildRtHistogram } from './histogram';

let idCounter = 0;

function makeTrial(overrides: Partial<Trial> = {}): Trial {
  return {
    index: idCounter,
    block: 1,
    cue: 'none',
    flanker: 'congruent',
    position: 'top',
    targetDir: 'L',
    responseDir: 'L',
    correct: true,
    rt: 1000,
    onsetTs: idCounter++ * 4050,
    fixationMs: 800,
    ...overrides,
  };
}

describe('buildRtHistogram', () => {
  it('liefert null ohne korrekte Trials', () => {
    expect(buildRtHistogram([])).toBeNull();
    expect(buildRtHistogram([makeTrial({ correct: false, rt: null, responseDir: null })])).toBeNull();
  });

  it('zählt congruent und incongruent getrennt in gemeinsame Bins', () => {
    const trials = [
      makeTrial({ flanker: 'congruent', rt: 800 }),
      makeTrial({ flanker: 'congruent', rt: 850 }),
      makeTrial({ flanker: 'incongruent', rt: 1200 }),
    ];
    const histogram = buildRtHistogram(trials, 4);
    expect(histogram).not.toBeNull();
    expect(histogram!.congruentN).toBe(2);
    expect(histogram!.incongruentN).toBe(1);
    expect(histogram!.bins).toHaveLength(4);
    const totalCongruent = histogram!.bins.reduce((sum, b) => sum + b.congruentCount, 0);
    const totalIncongruent = histogram!.bins.reduce((sum, b) => sum + b.incongruentCount, 0);
    expect(totalCongruent).toBe(2);
    expect(totalIncongruent).toBe(1);
  });

  it('ignoriert Misses (rt null) und Fehler', () => {
    const trials = [
      makeTrial({ flanker: 'congruent', rt: 800, correct: true }),
      makeTrial({ flanker: 'congruent', rt: null, correct: null, responseDir: null }),
      makeTrial({ flanker: 'congruent', rt: 900, correct: false }),
    ];
    const histogram = buildRtHistogram(trials);
    expect(histogram!.congruentN).toBe(1);
  });

  it('behandelt identische RTs ohne Division durch 0', () => {
    const trials = [
      makeTrial({ flanker: 'congruent', rt: 1000 }),
      makeTrial({ flanker: 'incongruent', rt: 1000 }),
    ];
    const histogram = buildRtHistogram(trials, 5);
    expect(histogram!.binWidthMs).toBe(1);
    const total = histogram!.bins.reduce((sum, b) => sum + b.congruentCount + b.incongruentCount, 0);
    expect(total).toBe(2);
    expect(histogram!.bins[0]).toMatchObject({ congruentCount: 1, incongruentCount: 1 });
  });

  it('platziert das Maximum im letzten Bin (inklusive obere Grenze)', () => {
    const trials = [
      makeTrial({ flanker: 'congruent', rt: 500 }),
      makeTrial({ flanker: 'congruent', rt: 1500 }),
    ];
    const histogram = buildRtHistogram(trials, 2);
    expect(histogram!.bins[0]!.binStart).toBe(500);
    expect(histogram!.bins[1]!.binEnd).toBe(1500);
    const total = histogram!.bins.reduce((sum, b) => sum + b.congruentCount, 0);
    expect(total).toBe(2);
  });
});
