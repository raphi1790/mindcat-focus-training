import { describe, expect, it } from 'vitest';
import { createRng } from '../../../platform/rng';
import { candidateCountForLevel, digitRangeForLevel, generateNumberTrial } from './generator';

describe('generateNumberTrial', () => {
  it('genau ein Kandidat entspricht dem Zieldigit', () => {
    const rng = createRng('number-seed');
    for (let level = 1; level <= 5; level++) {
      const trial = generateNumberTrial(rng, level);
      expect(trial.candidates).toHaveLength(candidateCountForLevel(level));
      expect(trial.candidates[trial.correctIndex]).toBe(trial.target);
      const matches = trial.candidates.filter((c) => c === trial.target);
      expect(matches).toHaveLength(1);
    }
  });

  it('Zieldigit liegt im levelabhängigen Zahlenraum', () => {
    const rng = createRng('range-seed');
    for (let level = 1; level <= 5; level++) {
      const maxDigit = digitRangeForLevel(level);
      for (let i = 0; i < 20; i++) {
        const trial = generateNumberTrial(rng, level);
        expect(trial.target).toBeGreaterThanOrEqual(1);
        expect(trial.target).toBeLessThanOrEqual(maxDigit);
      }
    }
  });

  it('Kandidaten enthalten keine Duplikate', () => {
    const rng = createRng('dup-seed');
    for (let level = 1; level <= 5; level++) {
      const trial = generateNumberTrial(rng, level);
      const unique = new Set(trial.candidates);
      expect(unique.size).toBe(trial.candidates.length);
    }
  });
});
