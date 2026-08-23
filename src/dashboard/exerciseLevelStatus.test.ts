import { describe, expect, it } from 'vitest';
import type { ExerciseResult, TrainingSession } from '../data/schema';
import { computeExerciseLevelOverview } from './exerciseLevelStatus';
import { createExerciseProgress } from '../training/engine';

function makeExercise(overrides: Partial<ExerciseResult> = {}): ExerciseResult {
  return {
    exerciseId: 'side',
    levelsCompleted: 2,
    highestLevel: 2,
    trials: 21,
    correct: 18,
    errors: 2,
    missed: 1,
    trialToAdvanceRate: 5,
    durationMs: 60_000,
    perLevel: [
      { level: 1, trials: 10, correct: 9, errors: 1 },
      { level: 2, trials: 11, correct: 9, errors: 1 },
    ],
    ...overrides,
  };
}

function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: 's1',
    sessionDay: 1,
    ageGroupAtTest: 6,
    rngSeed: 'seed-1',
    exercises: [makeExercise()],
    timestamp: new Date(2026, 0, 1),
    status: 'completed',
    ...overrides,
  };
}

describe('computeExerciseLevelOverview', () => {
  it('liefert alle Übungen für 4-Jährige ohne Farmer', () => {
    const overview = computeExerciseLevelOverview([], 4);
    expect(overview.exercises).toHaveLength(9);
    expect(overview.exercises.some((e) => e.exerciseId === 'farmer')).toBe(false);
    expect(overview.activeCheckpoint).toBeNull();
    expect(overview.totalCompletedExercises).toBe(0);

    const side = overview.exercises.find((e) => e.exerciseId === 'side');
    expect(side).toBeDefined();
    expect(side?.highestLevel).toBe(0);
    expect(side?.hasPlayed).toBe(false);
    expect(side?.maxLevel).toBe(7);
  });

  it('liefert alle 10 Übungen für 6-Jährige inkl. Farmer', () => {
    const overview = computeExerciseLevelOverview([], 6);
    expect(overview.exercises).toHaveLength(10);
    expect(overview.exercises.some((e) => e.exerciseId === 'farmer')).toBe(true);
  });

  it('aggregiert erreichte Level und Metriken aus abgeschlossenen Sitzungen', () => {
    const day1 = makeSession({
      sessionDay: 1,
      exercises: [
        makeExercise({ exerciseId: 'side', highestLevel: 4, trials: 25, errors: 3, missed: 1 }),
        makeExercise({ exerciseId: 'maze', highestLevel: 6, trials: 10, errors: 0, missed: 0 }),
      ],
    });
    const day2 = makeSession({
      sessionDay: 2,
      exercises: [
        makeExercise({ exerciseId: 'side', highestLevel: 7, trials: 21, errors: 1, missed: 0 }),
      ],
    });

    const overview = computeExerciseLevelOverview([day1, day2], 6);

    const side = overview.exercises.find((e) => e.exerciseId === 'side');
    expect(side).toMatchObject({
      highestLevel: 7,
      maxLevel: 7,
      isCompletedMax: true,
      hasPlayed: true,
      sessionsCount: 2,
      totalTrials: 46,
      totalErrors: 4,
      totalMissed: 1,
    });

    const maze = overview.exercises.find((e) => e.exerciseId === 'maze');
    expect(maze).toMatchObject({
      highestLevel: 6,
      maxLevel: 6,
      isCompletedMax: true,
      hasPlayed: true,
      sessionsCount: 1,
      totalTrials: 10,
    });

    const chase = overview.exercises.find((e) => e.exerciseId === 'chase');
    expect(chase?.hasPlayed).toBe(false);
    expect(chase?.highestLevel).toBe(0);
  });

  it('erkennt aktiven Checkpoint einer laufenden (in-progress) Sitzung', () => {
    const completed = makeSession({
      sessionDay: 1,
      exercises: [makeExercise({ exerciseId: 'side', highestLevel: 7 })],
    });

    const inProgressSession: TrainingSession = {
      id: 's2',
      sessionDay: 2,
      ageGroupAtTest: 6,
      rngSeed: 'seed-2',
      exercises: [makeExercise({ exerciseId: 'chase', highestLevel: 5, trials: 15, errors: 2 })],
      timestamp: new Date(2026, 0, 2),
      status: 'in-progress',
      checkpoint: {
        exerciseIndex: 1,
        exerciseId: 'maze',
        engineState: {
          ...createExerciseProgress(),
          level: 3,
          totalTrials: 4,
          errors: 1,
          missed: 0,
        },
        updatedAt: new Date(2026, 0, 2, 10, 30),
      },
    };

    const overview = computeExerciseLevelOverview([completed, inProgressSession], 6);

    expect(overview.activeCheckpoint).toMatchObject({
      sessionDay: 2,
      exerciseId: 'maze',
      exerciseLabel: 'Maze (Antizipation/Planung)',
      exerciseIcon: '🧩',
      level: 3,
    });

    const maze = overview.exercises.find((e) => e.exerciseId === 'maze');
    expect(maze?.highestLevel).toBe(3);
    expect(maze?.hasPlayed).toBe(true);
    expect(maze?.activeCheckpoint).toEqual({ sessionDay: 2, level: 3 });
    expect(maze?.totalTrials).toBe(4);
    expect(maze?.totalErrors).toBe(1);

    const chase = overview.exercises.find((e) => e.exerciseId === 'chase');
    expect(chase?.highestLevel).toBe(5);
    expect(chase?.hasPlayed).toBe(true);
  });

  it('ignoriert Checkpoints, deren EngineState als done markiert ist', () => {
    const inProgressSession: TrainingSession = {
      id: 's1',
      sessionDay: 1,
      ageGroupAtTest: 4,
      rngSeed: 'seed-1',
      exercises: [],
      timestamp: new Date(2026, 0, 1),
      status: 'in-progress',
      checkpoint: {
        exerciseIndex: 0,
        exerciseId: 'side',
        engineState: {
          ...createExerciseProgress(),
          level: 7,
          done: true,
        },
      },
    };

    const overview = computeExerciseLevelOverview([inProgressSession], 4);
    expect(overview.activeCheckpoint).toBeNull();
  });

  it('berücksichtigt perLevel-Werte für highestLevel', () => {
    const session = makeSession({
      exercises: [
        makeExercise({
          exerciseId: 'number-stroop',
          highestLevel: 2,
          perLevel: [
            { level: 1, trials: 3, correct: 3, errors: 0 },
            { level: 4, trials: 5, correct: 4, errors: 1 },
          ],
        }),
      ],
    });

    const overview = computeExerciseLevelOverview([session], 4);
    const stroop = overview.exercises.find((e) => e.exerciseId === 'number-stroop');
    expect(stroop?.highestLevel).toBe(4);
    expect(stroop?.maxLevel).toBe(6);
    expect(stroop?.isCompletedMax).toBe(false);
  });
});
