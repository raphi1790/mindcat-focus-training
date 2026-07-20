import type { ExerciseId } from '../data/schema';
import type { LevelConfig } from './engine';

/**
 * Studienparameter a/b/c je Übung (Rueda 2005, Plan §6.2) an einer Stelle:
 * a = `levels`, b = `minTrials`, c = `advanceStreak`. Die Übungs-Komponenten
 * importieren ihre Konfiguration von hier; `exerciseConfigs.test.ts` sichert
 * die Werte gegen versehentliche Drift ab (wissenschaftlich bindend).
 *
 * Sonderfälle (in den Übungen selbst umgesetzt, nicht hier):
 * - number-stroop: nur inkongruente Trials zählen zum Streak (c=3 inkongr.).
 * - farmer: mindestens 1 No-Go-Trial im Streak (Qualifier).
 */
export const EXERCISE_CONFIGS: Record<ExerciseId, LevelConfig> = {
  side: { levels: 7, minTrials: 21, advanceStreak: 3 },
  chase: { levels: 7, minTrials: 21, advanceStreak: 3 },
  maze: { levels: 6, minTrials: 6, advanceStreak: 1 },
  'anticipation-visible': { levels: 7, minTrials: 21, advanceStreak: 3 },
  'anticipation-invisible': { levels: 7, minTrials: 21, advanceStreak: 3 },
  discrimination: { levels: 7, minTrials: 21, advanceStreak: 3 },
  'discrimination-delay': { levels: 7, minTrials: 21, advanceStreak: 3 },
  number: { levels: 5, minTrials: 45, advanceStreak: 9 },
  'number-stroop': { levels: 6, minTrials: 18, advanceStreak: 3 },
  farmer: { levels: 7, minTrials: 66, advanceStreak: 6 },
};
