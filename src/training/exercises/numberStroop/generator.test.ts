import { describe, expect, it } from 'vitest';
import { createRng } from '../../../platform/rng';
import { generateAppleTrial, generateDigitTrial, generateStroopTrial } from './generator';

describe('generateAppleTrial', () => {
  it('ist immer neutral (kein Ziffern-Konflikt), correctSide ist die größere Menge', () => {
    const rng = createRng('apple-seed');
    for (let i = 0; i < 30; i++) {
      const trial = generateAppleTrial(rng);
      expect(trial.type).toBe('neutral');
      expect(trial.left.symbol).toBeNull();
      expect(trial.right.symbol).toBeNull();
      expect(trial.left.count).not.toBe(trial.right.count);
      const expected = trial.left.count > trial.right.count ? 'L' : 'R';
      expect(trial.correctSide).toBe(expected);
    }
  });
});

describe('generateDigitTrial', () => {
  it('correctSide folgt immer der Menge, nie dem Ziffernwert', () => {
    const rng = createRng('digit-seed');
    for (let i = 0; i < 60; i++) {
      const trial = generateDigitTrial(rng);
      const expected = trial.left.count > trial.right.count ? 'L' : 'R';
      expect(trial.correctSide).toBe(expected);
      expect(trial.left.symbol).not.toBeNull();
      expect(trial.right.symbol).not.toBeNull();
    }
  });

  it('bei "incongruent" hat die mengenmäßig kleinere Seite die größere Ziffer', () => {
    const rng = createRng('incongr-seed');
    let sawIncongruent = false;
    let sawCongruent = false;
    for (let i = 0; i < 60; i++) {
      const trial = generateDigitTrial(rng);
      const largerCountSide = trial.left.count > trial.right.count ? trial.left : trial.right;
      const smallerCountSide = trial.left.count > trial.right.count ? trial.right : trial.left;
      if (trial.type === 'incongruent') {
        sawIncongruent = true;
        expect(smallerCountSide.symbol!).toBeGreaterThan(largerCountSide.symbol!);
      } else {
        sawCongruent = true;
        expect(largerCountSide.symbol!).toBeGreaterThan(smallerCountSide.symbol!);
      }
    }
    expect(sawIncongruent).toBe(true);
    expect(sawCongruent).toBe(true);
  });
});

describe('generateStroopTrial', () => {
  it('Level 1-2 liefern Apfel-Trials (neutral), ab Level 3 Ziffern-Trials', () => {
    const rng = createRng('level-seed');
    for (let i = 0; i < 10; i++) {
      expect(generateStroopTrial(rng, 1).left.symbol).toBeNull();
      expect(generateStroopTrial(rng, 2).left.symbol).toBeNull();
      expect(generateStroopTrial(rng, 3).left.symbol).not.toBeNull();
      expect(generateStroopTrial(rng, 6).left.symbol).not.toBeNull();
    }
  });
});
