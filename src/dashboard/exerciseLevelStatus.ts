import { getExerciseSetForAge } from '../data/exerciseSet';
import type { AgeGroup, ExerciseId, TrainingSession } from '../data/schema';
import { EXERCISE_CONFIGS } from '../training/exerciseConfigs';
import { EXERCISE_ICONS, EXERCISE_LABELS } from '../training/labels';

/**
 * Status und erreichter Level-Stand einer einzelnen Übung (AP6, Fix-Plan Testrunde 2).
 * Berücksichtigt abgeschlossene Sitzungen sowie aktive Resume-Checkpoints
 * laufender (in-progress) Sitzungen für maximale Persistenz-Transparenz.
 */
export interface ExerciseLevelItem {
  exerciseId: ExerciseId;
  label: string;
  icon: string;
  maxLevel: number;
  highestLevel: number; // 0 wenn noch nie gespielt, sonst 1..maxLevel
  isCompletedMax: boolean;
  totalTrials: number;
  totalErrors: number;
  totalMissed: number;
  sessionsCount: number;
  hasPlayed: boolean;
  activeCheckpoint?: {
    sessionDay: number;
    level: number;
  };
}

export interface ActiveCheckpointInfo {
  sessionDay: number;
  exerciseId: ExerciseId;
  exerciseLabel: string;
  exerciseIcon: string;
  level: number;
  updatedAt?: Date;
}

export interface ExerciseLevelOverview {
  exercises: ExerciseLevelItem[];
  activeCheckpoint: ActiveCheckpointInfo | null;
  totalCompletedExercises: number;
}

/** Höchstes Level über die Per-Level-Stats einer Übung (Fallback: highestLevel-Feld). */
function highestLevelOfExercise(exercise: TrainingSession['exercises'][number]): number {
  return exercise.perLevel.reduce((max, l) => Math.max(max, l.level), exercise.highestLevel);
}

/**
 * Ermittelt den Level-Stand je Übung für das Dashboard.
 * Reine Funktion ohne Seiteneffekte (einfach und isoliert testbar).
 */
export function computeExerciseLevelOverview(
  sessions: readonly TrainingSession[],
  ageGroup: AgeGroup,
): ExerciseLevelOverview {
  const allowedExerciseIds = getExerciseSetForAge(ageGroup);
  const inProgressSessions = sessions.filter((s) => s.status === 'in-progress');
  const latestInProgress = inProgressSessions.length > 0 ? inProgressSessions[inProgressSessions.length - 1]! : null;

  let activeCheckpoint: ActiveCheckpointInfo | null = null;
  if (latestInProgress?.checkpoint && !latestInProgress.checkpoint.engineState.done) {
    const cp = latestInProgress.checkpoint;
    activeCheckpoint = {
      sessionDay: latestInProgress.sessionDay,
      exerciseId: cp.exerciseId,
      exerciseLabel: EXERCISE_LABELS[cp.exerciseId] ?? cp.exerciseId,
      exerciseIcon: EXERCISE_ICONS[cp.exerciseId] ?? '🎮',
      level: cp.engineState.level,
      updatedAt: cp.updatedAt,
    };
  }

  let totalCompletedExercises = 0;

  const exercises: ExerciseLevelItem[] = allowedExerciseIds.map((exerciseId) => {
    let highestLevel = 0;
    let totalTrials = 0;
    let totalErrors = 0;
    let totalMissed = 0;
    let sessionsCount = 0;

    for (const session of sessions) {
      for (const ex of session.exercises) {
        if (ex.exerciseId === exerciseId) {
          sessionsCount += 1;
          totalTrials += ex.trials;
          totalErrors += ex.errors;
          totalMissed += ex.missed;
          highestLevel = Math.max(highestLevel, highestLevelOfExercise(ex));
          if (session.status !== 'in-progress') {
            totalCompletedExercises += 1;
          }
        }
      }
    }

    let itemActiveCheckpoint: { sessionDay: number; level: number } | undefined = undefined;
    if (activeCheckpoint && activeCheckpoint.exerciseId === exerciseId) {
      itemActiveCheckpoint = {
        sessionDay: activeCheckpoint.sessionDay,
        level: activeCheckpoint.level,
      };
      highestLevel = Math.max(highestLevel, activeCheckpoint.level);
      const cpState = latestInProgress?.checkpoint?.engineState;
      if (cpState) {
        totalTrials += cpState.totalTrials;
        totalErrors += cpState.errors;
        totalMissed += cpState.missed;
      }
    }

    const maxLevel = EXERCISE_CONFIGS[exerciseId]?.levels ?? 7;
    const hasPlayed = highestLevel > 0 || totalTrials > 0;
    const isCompletedMax = highestLevel >= maxLevel;

    return {
      exerciseId,
      label: EXERCISE_LABELS[exerciseId] ?? exerciseId,
      icon: EXERCISE_ICONS[exerciseId] ?? '🎮',
      maxLevel,
      highestLevel,
      isCompletedMax,
      totalTrials,
      totalErrors,
      totalMissed,
      sessionsCount,
      hasPlayed,
      activeCheckpoint: itemActiveCheckpoint,
    };
  });

  return {
    exercises,
    activeCheckpoint,
    totalCompletedExercises,
  };
}
