import { describe, expect, it } from 'vitest';
import { EXERCISE_CONFIGS } from './exerciseConfigs';

/**
 * Sichert die a/b/c-Studienparameter (Rueda 2005, Plan §6.2) gegen Drift ab.
 * Änderungen hier sind nur mit Quellenabgleich erlaubt.
 */
describe('EXERCISE_CONFIGS (Plan §6.2)', () => {
  it.each([
    ['side', 7, 21, 3],
    ['chase', 7, 21, 3],
    ['maze', 6, 6, 1],
    ['anticipation-visible', 7, 21, 3],
    ['anticipation-invisible', 7, 21, 3],
    ['discrimination', 7, 21, 3],
    ['discrimination-delay', 7, 21, 3],
    ['number', 5, 45, 9],
    ['number-stroop', 6, 18, 3],
    ['farmer', 7, 66, 6],
  ] as const)('%s: a=%i, b=%i, c=%i', (id, levels, minTrials, advanceStreak) => {
    expect(EXERCISE_CONFIGS[id]).toEqual({ levels, minTrials, advanceStreak });
  });

  it('deckt exakt die 10 Übungs-Ids ab', () => {
    expect(Object.keys(EXERCISE_CONFIGS)).toHaveLength(10);
  });
});
