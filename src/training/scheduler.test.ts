import { describe, expect, it } from 'vitest';
import { getExerciseSetForAge } from '../data/exerciseSet';
import { buildTrainingPlan } from './scheduler';

describe('buildTrainingPlan', () => {
  it('liefert genau 5 Tage', () => {
    expect(buildTrainingPlan(4)).toHaveLength(5);
    expect(buildTrainingPlan(6)).toHaveLength(5);
  });

  it('jede Übung des Altersgruppen-Sets kommt genau einmal vor, in kanonischer Reihenfolge', () => {
    for (const ageGroup of [4, 6] as const) {
      const plan = buildTrainingPlan(ageGroup);
      const flat = plan.flat();
      expect(flat).toEqual(getExerciseSetForAge(ageGroup));
    }
  });

  it('Farmer kommt nur bei Altersgruppe 6 vor', () => {
    expect(buildTrainingPlan(4).flat()).not.toContain('farmer');
    expect(buildTrainingPlan(6).flat()).toContain('farmer');
  });

  it('kein späterer Tag hat mehr Übungen als ein früherer (Rest geht an frühe Tage)', () => {
    for (const ageGroup of [4, 6] as const) {
      const plan = buildTrainingPlan(ageGroup);
      for (let i = 1; i < plan.length; i++) {
        expect(plan[i]!.length).toBeLessThanOrEqual(plan[i - 1]!.length);
      }
    }
  });
});
