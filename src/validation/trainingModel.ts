import { createRng, type Rng } from '../platform/rng';
import type { AgeGroup, ExerciseId, ExerciseResult, TrainingSessionInput } from '../data/schema';
import { buildTrainingPlan } from '../training/scheduler';
import { EXERCISE_CONFIGS } from '../training/exerciseConfigs';
import {
  applyTrialOutcome,
  createExerciseProgress,
  finalizeExerciseResult,
  type LevelConfig,
  type TrialOutcome,
  type TrialResultKind,
} from '../training/engine';

/**
 * Simuliert das 5-Tage-Trainingsprogramm für den Pilotlauf (Plan §9 Phase 6),
 * indem der echte Scheduler (`buildTrainingPlan`), die echten a/b/c-Konfigs
 * (`EXERCISE_CONFIGS`) und der echte Advancement-Reducer (`applyTrialOutcome`)
 * mit einem simulierten Spieler durchlaufen werden.
 *
 * Der simulierte Spieler ist adaptiv-erfolgreich: Da die Übungen streak-basiert
 * aufsteigen, schließt er jede Übung über alle Level ab; die Altersgruppe steuert
 * nur seine Trefferquote (→ Trial-to-Advance-Rate, Studie Tabelle 1).
 */

/** Wie viele Sekunden ein Trial im Schnitt „dauert" (nur für durationMs-Plausibilität). */
const MS_PER_TRIAL = 1500;

/** Übungen mit Sonderfall-Flags im Advancement (vgl. exerciseProgress-Doku). */
type SpecialCase = 'number-stroop' | 'farmer' | 'none';

function specialCaseOf(exerciseId: ExerciseId): SpecialCase {
  if (exerciseId === 'number-stroop') return 'number-stroop';
  if (exerciseId === 'farmer') return 'farmer';
  return 'none';
}

function drawOutcome(rng: Rng, accuracy: number, special: SpecialCase): TrialOutcome {
  const roll = rng.next();
  let result: TrialResultKind;
  if (roll < accuracy) result = 'correct';
  else if (roll < accuracy + (1 - accuracy) * 0.7) result = 'error';
  else result = 'missed';

  const outcome: TrialOutcome = { result };
  // number-stroop: nur inkongruente Trials (~70 %) zählen zum Streak.
  if (special === 'number-stroop') outcome.countsTowardStreak = rng.next() < 0.7;
  // farmer: ~35 % der Trials sind No-Go (Qualifier); ≥1 muss im Streak liegen.
  if (special === 'farmer') outcome.satisfiesQualifier = rng.next() < 0.35;
  return outcome;
}

/** Sicherheitsnetz gegen Nicht-Termination bei pathologisch schlechten Seeds. */
const MAX_TRIALS_PER_EXERCISE = 5000;

export function simulateExercise(
  exerciseId: ExerciseId,
  rng: Rng,
  accuracy: number,
): ExerciseResult {
  const config: LevelConfig = EXERCISE_CONFIGS[exerciseId];
  const special = specialCaseOf(exerciseId);
  let state = createExerciseProgress();

  let guard = 0;
  while (!state.done) {
    if (guard++ >= MAX_TRIALS_PER_EXERCISE) {
      throw new Error(
        `Übung ${exerciseId} terminierte nicht in ${MAX_TRIALS_PER_EXERCISE} Trials ` +
          `(Level ${state.level}/${config.levels}) — Advancement-Konfiguration prüfen.`,
      );
    }
    state = applyTrialOutcome(state, config, drawOutcome(rng, accuracy, special));
  }

  return finalizeExerciseResult(exerciseId, state, state.totalTrials * MS_PER_TRIAL);
}

/** Trefferquote je Altersgruppe (6-J. präziser als 4-J., vgl. Studie). */
const ACCURACY_BY_AGE: Record<AgeGroup, number> = { 4: 0.82, 6: 0.9 };

export interface SimulatedTrainingDay {
  sessionDay: number;
  input: TrainingSessionInput;
}

/**
 * Simuliert alle 5 Trainingstage einer Altersgruppe und liefert je Tag ein
 * fertiges `TrainingSessionInput` (so, wie es der `TrainingSessionRunner`
 * persistieren würde).
 */
export function simulateTrainingProgram(ageGroup: AgeGroup, seed: string): SimulatedTrainingDay[] {
  const plan = buildTrainingPlan(ageGroup);
  const accuracy = ACCURACY_BY_AGE[ageGroup];

  return plan.map((exerciseIds, dayIndex) => {
    const sessionDay = dayIndex + 1;
    const sessionSeed = `${seed}:day${sessionDay}`;
    const exercises = exerciseIds.map((exerciseId) => {
      const rng = createRng(`${sessionSeed}:${exerciseId}`);
      return simulateExercise(exerciseId, rng, accuracy);
    });
    return {
      sessionDay,
      input: { sessionDay, ageGroupAtTest: ageGroup, rngSeed: sessionSeed, exercises },
    };
  });
}
