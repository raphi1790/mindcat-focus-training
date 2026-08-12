import { describe, expect, it } from 'vitest';
import { getExerciseSetForAge } from './exerciseSet';
import { EXERCISE_IDS } from './schema';

describe('getExerciseSetForAge', () => {
  it('4-Jährige: alle Übungen außer Farmer', () => {
    const set = getExerciseSetForAge(4);
    expect(set).not.toContain('farmer');
    expect(set).toHaveLength(EXERCISE_IDS.length - 1);
  });

  it('6-Jährige: alle Übungen inkl. Farmer', () => {
    const set = getExerciseSetForAge(6);
    expect(set).toContain('farmer');
    expect(set).toHaveLength(EXERCISE_IDS.length);
    expect(set).toEqual(EXERCISE_IDS);
  });

  it('Reihenfolge bleibt stabil (aus EXERCISE_IDS abgeleitet)', () => {
    const set = getExerciseSetForAge(4);
    expect(set).toEqual(EXERCISE_IDS.filter((id) => id !== 'farmer'));
  });
});
