import type { ExerciseId, ExerciseResult } from '../data/schema';
import { EXERCISE_CONFIGS } from './exerciseConfigs';

/**
 * Sterne-Belohnung je abgeschlossener Übung (Plan §6.3 „Belohnungsschleifen
 * zwischen Übungen"). Rein kosmetische Meta-Belohnung — beeinflusst weder
 * Trial-Struktur noch Level-Advancement noch die persistierten Daten.
 *
 * Grundlage ist die Effizienz: wie nah liegt die tatsächliche Trial-Zahl an
 * der minimal möglichen (fehlerfreien) Trial-Zahl. Abschluss gibt immer
 * mindestens 1 Stern (kindgerecht: kein „leeres" Ergebnis).
 */

/** Minimal mögliche Trial-Zahl einer fehlerfreien Durchführung. */
export function perfectTrialCount(exerciseId: ExerciseId): number {
  const config = EXERCISE_CONFIGS[exerciseId];
  return Math.max(config.minTrials, config.levels * config.advanceStreak);
}

export type StarCount = 1 | 2 | 3;

export function starsForResult(result: Pick<ExerciseResult, 'exerciseId' | 'trials'>): StarCount {
  const ratio = result.trials / perfectTrialCount(result.exerciseId);
  if (ratio <= 1.2) return 3;
  if (ratio <= 1.75) return 2;
  return 1;
}
