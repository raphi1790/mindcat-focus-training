import type { ExerciseId, TrainingSession } from '../data/schema';

/**
 * Trainingsverlauf über die 5 Tage (Plan §5.3 Punkt 2), analog Studie
 * Tabelle 1: abgeschlossene Übungen, erreichte Level, Trial-to-Advance-Rate,
 * Fehler-/Miss-Rate. Reine Funktion auf den bereits gespeicherten
 * `trainingSessions`-Dokumenten.
 */

export interface DaySummary {
  sessionDay: number;
  exercisesCompleted: number;
  totalTrials: number;
  totalCorrect: number;
  totalErrors: number;
  totalMissed: number;
  /** (Fehler + Misses) / Trials in %. */
  errorRate: number;
  /** Mittelwert der Trial-to-Advance-Rate über die Übungen des Tages. */
  avgTrialToAdvanceRate: number | null;
  highestLevelReached: number;
}

export interface ExerciseAggregate {
  exerciseId: ExerciseId;
  sessionsCount: number;
  totalTrials: number;
  totalErrors: number;
  totalMissed: number;
  highestLevel: number;
}

export interface TrainingSummary {
  /** Ein Eintrag je vorkommendem Trainingstag, aufsteigend sortiert. */
  days: DaySummary[];
  totalExercisesCompleted: number;
  totalDaysCompleted: number;
  avgTrialToAdvanceRate: number | null;
  overallErrorRate: number;
  byExercise: ExerciseAggregate[];
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Höchstes Level über die Per-Level-Stats einer Übung (Fallback: highestLevel-Feld). */
function highestLevelOf(exercise: TrainingSession['exercises'][number]): number {
  return exercise.perLevel.reduce((max, l) => Math.max(max, l.level), exercise.highestLevel);
}

export function computeTrainingSummary(sessions: readonly TrainingSession[]): TrainingSummary {
  const byDay = new Map<number, TrainingSession[]>();
  for (const session of sessions) {
    const list = byDay.get(session.sessionDay) ?? [];
    list.push(session);
    byDay.set(session.sessionDay, list);
  }

  const days: DaySummary[] = [...byDay.keys()]
    .sort((a, b) => a - b)
    .map((sessionDay) => {
      const sessionsOfDay = byDay.get(sessionDay) ?? [];
      const exercises = sessionsOfDay.flatMap((s) => s.exercises);
      const totalTrials = exercises.reduce((sum, e) => sum + e.trials, 0);
      const totalCorrect = exercises.reduce((sum, e) => sum + e.correct, 0);
      const totalErrors = exercises.reduce((sum, e) => sum + e.errors, 0);
      const totalMissed = exercises.reduce((sum, e) => sum + e.missed, 0);
      const highestLevelReached = exercises.reduce((max, e) => Math.max(max, highestLevelOf(e)), 0);
      return {
        sessionDay,
        exercisesCompleted: exercises.length,
        totalTrials,
        totalCorrect,
        totalErrors,
        totalMissed,
        errorRate: totalTrials > 0 ? ((totalErrors + totalMissed) / totalTrials) * 100 : 0,
        avgTrialToAdvanceRate: mean(exercises.map((e) => e.trialToAdvanceRate)),
        highestLevelReached,
      };
    });

  const allExercises = sessions.flatMap((s) => s.exercises);

  const byExerciseMap = new Map<ExerciseId, ExerciseAggregate>();
  for (const exercise of allExercises) {
    const existing = byExerciseMap.get(exercise.exerciseId);
    const highestLevel = highestLevelOf(exercise);
    if (existing) {
      existing.sessionsCount += 1;
      existing.totalTrials += exercise.trials;
      existing.totalErrors += exercise.errors;
      existing.totalMissed += exercise.missed;
      existing.highestLevel = Math.max(existing.highestLevel, highestLevel);
    } else {
      byExerciseMap.set(exercise.exerciseId, {
        exerciseId: exercise.exerciseId,
        sessionsCount: 1,
        totalTrials: exercise.trials,
        totalErrors: exercise.errors,
        totalMissed: exercise.missed,
        highestLevel,
      });
    }
  }

  const totalTrialsOverall = allExercises.reduce((sum, e) => sum + e.trials, 0);
  const totalErrorsOverall = allExercises.reduce((sum, e) => sum + e.errors, 0);
  const totalMissedOverall = allExercises.reduce((sum, e) => sum + e.missed, 0);

  return {
    days,
    totalExercisesCompleted: allExercises.length,
    totalDaysCompleted: byDay.size,
    avgTrialToAdvanceRate: mean(allExercises.map((e) => e.trialToAdvanceRate)),
    overallErrorRate:
      totalTrialsOverall > 0 ? ((totalErrorsOverall + totalMissedOverall) / totalTrialsOverall) * 100 : 0,
    byExercise: [...byExerciseMap.values()],
  };
}
