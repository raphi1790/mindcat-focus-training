import { describe, expect, it } from 'vitest';
import { createRng } from '../../platform/rng';
import {
  ACCESSORY_COUNT,
  EYE_COLOR_COUNT,
  FUR_COLOR_COUNT,
  PATTERN_COUNT,
  countDifferingAttributes,
  generateDiscriminationTrial,
  makeDistractor,
  portraitsEqual,
  randomPortrait,
} from './portraits';

describe('randomPortrait', () => {
  it('liefert Attribute innerhalb der gültigen Bereiche', () => {
    const rng = createRng('portrait-seed');
    for (let i = 0; i < 50; i++) {
      const p = randomPortrait(rng);
      expect(p.furColor).toBeGreaterThanOrEqual(0);
      expect(p.furColor).toBeLessThan(FUR_COLOR_COUNT);
      expect(p.eyeColor).toBeLessThan(EYE_COLOR_COUNT);
      expect(p.pattern).toBeLessThan(PATTERN_COUNT);
      expect(p.accessory).toBeLessThan(ACCESSORY_COUNT);
    }
  });
});

describe('makeDistractor', () => {
  it('unterscheidet sich vom Template in genau diffCount Attributen', () => {
    const rng = createRng('distractor-seed');
    const template = randomPortrait(rng);
    for (const diffCount of [1, 2, 3, 4]) {
      const distractor = makeDistractor(rng, template, diffCount);
      expect(countDifferingAttributes(template, distractor)).toBe(diffCount);
      expect(portraitsEqual(template, distractor)).toBe(false);
    }
  });

  it('klemmt diffCount auf die Anzahl vorhandener Attribute (max 4)', () => {
    const rng = createRng('clamp-seed');
    const template = randomPortrait(rng);
    const distractor = makeDistractor(rng, template, 99);
    expect(countDifferingAttributes(template, distractor)).toBe(4);
  });
});

describe('generateDiscriminationTrial', () => {
  it('genau ein Kandidat entspricht exakt dem Template', () => {
    const rng = createRng('trial-seed');
    const trial = generateDiscriminationTrial(rng, 2, 5);
    expect(trial.candidates).toHaveLength(5);
    expect(portraitsEqual(trial.candidates[trial.correctIndex]!, trial.template)).toBe(true);
    const exactMatches = trial.candidates.filter((c) => portraitsEqual(c, trial.template));
    expect(exactMatches).toHaveLength(1);
  });

  it('alle Distraktoren unterscheiden sich vom Template', () => {
    const rng = createRng('trial-seed-2');
    const trial = generateDiscriminationTrial(rng, 3, 6);
    trial.candidates.forEach((c, i) => {
      if (i === trial.correctIndex) return;
      expect(portraitsEqual(c, trial.template)).toBe(false);
    });
  });
});
