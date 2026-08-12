import type { ExerciseId, ExerciseResult, PerLevelStats } from '../../data/schema';

/**
 * Verallgemeinerte a/b/c-Level-Logik für alle Trainingsübungen (Plan §6.1/§6.2).
 *
 * a = `levels`, b = `minTrials`, c = `advanceStreak`. Ein Level steigt, sobald
 * `advanceStreak` korrekte Trials in Folge erreicht sind (Fehler setzen den
 * Streak zurück). Auf dem letzten Level schließt die Übung ab, sobald der
 * Streak erneut erreicht ist UND mindestens `minTrials` Trials insgesamt
 * gespielt wurden — reproduziert exakt das Verhalten der bisherigen
 * `TrainingGrid.jsx` (Side: a=7, b=21, c=3).
 *
 * Zwei optionale Flags pro Trial decken Sonderfälle ab, ohne die Engine pro
 * Übung zu forken:
 *  - `countsTowardStreak`: korrekte Trials, die nicht zur trainierten
 *    Fähigkeit zählen (z. B. kongruente Trials bei Number-Stroop), bewegen
 *    den Streak weder vorwärts noch setzen sie ihn zurück.
 *  - `satisfiesQualifier`: mindestens ein Trial im aktuellen Streak muss
 *    diese Bedingung erfüllen, damit der Streak zum Aufstieg zählt (Farmer:
 *    "≥ 1 No-Go-Trial im Streak").
 */

export interface LevelConfig {
  /** Anzahl Level (a). */
  levels: number;
  /** Mindest-Trials zum Abschluss der gesamten Übung (b). */
  minTrials: number;
  /** Korrekte Trials in Folge für einen Level-Aufstieg (c). */
  advanceStreak: number;
}

export type TrialResultKind = 'correct' | 'error' | 'missed';

export interface TrialOutcome {
  result: TrialResultKind;
  /** Default: true. Auf false setzen für Trials, die den Streak nicht bewegen sollen. */
  countsTowardStreak?: boolean;
  /** Default: true. Auf false setzen, wenn dieser Trial die Qualifier-Bedingung nicht erfüllt. */
  satisfiesQualifier?: boolean;
}

export interface ExerciseProgressState {
  /** Aktuelles Level (1-basiert). */
  level: number;
  streak: number;
  qualifierSeenInStreak: boolean;
  totalTrials: number;
  correct: number;
  errors: number;
  missed: number;
  perLevel: PerLevelStats[];
  done: boolean;
}

export function createExerciseProgress(): ExerciseProgressState {
  return {
    level: 1,
    streak: 0,
    qualifierSeenInStreak: false,
    totalTrials: 0,
    correct: 0,
    errors: 0,
    missed: 0,
    perLevel: [{ level: 1, trials: 0, correct: 0, errors: 0 }],
    done: false,
  };
}

export function applyTrialOutcome(
  state: ExerciseProgressState,
  config: LevelConfig,
  outcome: TrialOutcome,
): ExerciseProgressState {
  if (state.done) return state;

  const countsTowardStreak = outcome.countsTowardStreak ?? true;
  const satisfiesQualifier = outcome.satisfiesQualifier ?? true;

  const perLevel = state.perLevel.map((l) => ({ ...l }));
  const currentStats = perLevel[perLevel.length - 1] as PerLevelStats;
  currentStats.trials += 1;

  let { level, streak, qualifierSeenInStreak, correct, errors, missed } = state;
  const totalTrials = state.totalTrials + 1;

  if (outcome.result === 'correct') {
    currentStats.correct += 1;
    correct += 1;
    if (countsTowardStreak) {
      streak += 1;
      qualifierSeenInStreak = qualifierSeenInStreak || satisfiesQualifier;
    }
  } else {
    currentStats.errors += 1;
    if (outcome.result === 'missed') {
      missed += 1;
    } else {
      errors += 1;
    }
    streak = 0;
    qualifierSeenInStreak = false;
  }

  let done = false;
  if (streak >= config.advanceStreak && qualifierSeenInStreak) {
    if (level < config.levels) {
      level += 1;
      streak = 0;
      qualifierSeenInStreak = false;
      perLevel.push({ level, trials: 0, correct: 0, errors: 0 });
    } else if (totalTrials >= config.minTrials) {
      done = true;
    }
  }

  return { level, streak, qualifierSeenInStreak, totalTrials, correct, errors, missed, perLevel, done };
}

export function finalizeExerciseResult(
  exerciseId: ExerciseId,
  state: ExerciseProgressState,
  durationMs: number,
  rawEvents?: Record<string, unknown>[],
): ExerciseResult {
  return {
    exerciseId,
    levelsCompleted: state.level,
    highestLevel: state.level,
    trials: state.totalTrials,
    correct: state.correct,
    errors: state.errors,
    missed: state.missed,
    trialToAdvanceRate: state.level > 0 ? state.totalTrials / state.level : 0,
    durationMs,
    perLevel: state.perLevel,
    rawEvents,
  };
}
