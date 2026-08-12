import { describe, expect, it } from 'vitest';
import { createRng } from '../../../platform/rng';
import { generateFarmerTrial, responseWindowMsForLevel } from './generator';

describe('generateFarmerTrial', () => {
  it('isNoGoTrial ist genau für wolf/morph true, für sheep false', () => {
    const rng = createRng('farmer-seed');
    for (let level = 1; level <= 7; level++) {
      for (let i = 0; i < 30; i++) {
        const trial = generateFarmerTrial(rng, level);
        expect(trial.isNoGoTrial).toBe(trial.kind !== 'sheep');
      }
    }
  });

  it('Level 1-2 erzeugen niemals Morph-Trials', () => {
    const rng = createRng('no-morph-seed');
    for (let i = 0; i < 100; i++) {
      expect(generateFarmerTrial(rng, 1).kind).not.toBe('morph');
      expect(generateFarmerTrial(rng, 2).kind).not.toBe('morph');
    }
  });

  it('höhere Level erzeugen irgendwann Morph-Trials', () => {
    const rng = createRng('morph-seed');
    let sawMorph = false;
    for (let i = 0; i < 200; i++) {
      if (generateFarmerTrial(rng, 7).kind === 'morph') sawMorph = true;
    }
    expect(sawMorph).toBe(true);
  });

  it('morphDelayMs ist nur bei kind==="morph" gesetzt', () => {
    const rng = createRng('delay-seed');
    for (let level = 1; level <= 7; level++) {
      for (let i = 0; i < 30; i++) {
        const trial = generateFarmerTrial(rng, level);
        if (trial.kind === 'morph') {
          expect(trial.morphDelayMs).not.toBeNull();
          expect(trial.morphDelayMs!).toBeLessThan(trial.responseWindowMs);
        } else {
          expect(trial.morphDelayMs).toBeNull();
        }
      }
    }
  });

  it('responseWindowMsForLevel schrumpft monoton mit dem Level, nie unter 900ms', () => {
    let previous = Infinity;
    for (let level = 1; level <= 7; level++) {
      const window = responseWindowMsForLevel(level);
      expect(window).toBeLessThanOrEqual(previous);
      expect(window).toBeGreaterThanOrEqual(900);
      previous = window;
    }
  });
});
