import { describe, expect, it } from 'vitest';
import type { ExerciseResult, TrainingSession } from '../data/schema';
import { computeTrainingSummary } from './trainingSummary';

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

function makeSession(sessionDay: number, exercises: ExerciseResult[]): TrainingSession {
  return {
    id: `s${sessionDay}`,
    sessionDay,
    ageGroupAtTest: 6,
    rngSeed: `seed-${sessionDay}`,
    exercises,
    timestamp: new Date(2026, 0, sessionDay),
    status: 'completed',
  };
}

describe('computeTrainingSummary', () => {
  it('liefert leere Zusammenfassung ohne Sitzungen', () => {
    const summary = computeTrainingSummary([]);
    expect(summary.days).toEqual([]);
    expect(summary.totalExercisesCompleted).toBe(0);
    expect(summary.totalDaysCompleted).toBe(0);
    expect(summary.avgTrialToAdvanceRate).toBeNull();
    expect(summary.overallErrorRate).toBe(0);
    expect(summary.byExercise).toEqual([]);
  });

  it('aggregiert pro Tag und gesamt über mehrere Übungen', () => {
    const day1 = makeSession(1, [
      makeExercise({ exerciseId: 'side', trials: 21, errors: 2, missed: 1, trialToAdvanceRate: 4 }),
      makeExercise({ exerciseId: 'maze', trials: 6, errors: 1, missed: 0, trialToAdvanceRate: 1, highestLevel: 3 }),
    ]);
    const day2 = makeSession(2, [
      makeExercise({ exerciseId: 'side', trials: 21, errors: 0, missed: 0, trialToAdvanceRate: 3, highestLevel: 3 }),
    ]);

    const summary = computeTrainingSummary([day1, day2]);

    expect(summary.days).toHaveLength(2);
    expect(summary.days[0]).toMatchObject({
      sessionDay: 1,
      exercisesCompleted: 2,
      totalTrials: 27,
      totalErrors: 3,
      totalMissed: 1,
    });
    expect(summary.days[0]!.errorRate).toBeCloseTo((4 / 27) * 100, 5);
    expect(summary.days[0]!.avgTrialToAdvanceRate).toBeCloseTo((4 + 1) / 2, 5);

    expect(summary.totalDaysCompleted).toBe(2);
    expect(summary.totalExercisesCompleted).toBe(3);

    const side = summary.byExercise.find((e) => e.exerciseId === 'side');
    expect(side).toMatchObject({ sessionsCount: 2, totalTrials: 42, totalErrors: 2, highestLevel: 3 });
  });

  it('sortiert Tage aufsteigend unabhängig von der Eingabereihenfolge', () => {
    const day3 = makeSession(3, [makeExercise()]);
    const day1 = makeSession(1, [makeExercise()]);
    const summary = computeTrainingSummary([day3, day1]);
    expect(summary.days.map((d) => d.sessionDay)).toEqual([1, 3]);
  });

  it('fasst mehrere Sitzungen am selben Tag zusammen', () => {
    const s1 = makeSession(1, [makeExercise({ exerciseId: 'side' })]);
    const s2 = makeSession(1, [makeExercise({ exerciseId: 'maze' })]);
    const summary = computeTrainingSummary([s1, s2]);
    expect(summary.days).toHaveLength(1);
    expect(summary.days[0]!.exercisesCompleted).toBe(2);
  });

  it('ignoriert laufende (in-progress) Sitzungen (AP6)', () => {
    const completed = makeSession(1, [makeExercise({ exerciseId: 'side' })]);
    const running: TrainingSession = {
      ...makeSession(2, [makeExercise({ exerciseId: 'maze' })]),
      status: 'in-progress',
    };
    const summary = computeTrainingSummary([completed, running]);
    expect(summary.days.map((d) => d.sessionDay)).toEqual([1]);
    expect(summary.totalDaysCompleted).toBe(1);
    expect(summary.totalExercisesCompleted).toBe(1);
    expect(summary.byExercise.map((e) => e.exerciseId)).toEqual(['side']);
  });

  it('nutzt perLevel für highestLevelReached, falls höher als highestLevel-Feld', () => {
    const session = makeSession(1, [
      makeExercise({
        highestLevel: 2,
        perLevel: [
          { level: 1, trials: 5, correct: 5, errors: 0 },
          { level: 3, trials: 5, correct: 4, errors: 1 },
        ],
      }),
    ]);
    const summary = computeTrainingSummary([session]);
    expect(summary.days[0]!.highestLevelReached).toBe(3);
  });

  it('ignoriert freie Standalone-Sitzungen (mode: standalone, sessionDay: 0)', () => {
    const protocolDay1 = makeSession(1, [makeExercise({ exerciseId: 'side' })]);
    const standaloneSession: TrainingSession = {
      id: 'standalone-1',
      sessionDay: 0,
      mode: 'standalone',
      ageGroupAtTest: 6,
      rngSeed: 'mindcat-v1:practice:maze',
      exercises: [makeExercise({ exerciseId: 'maze' })],
      timestamp: new Date(2026, 0, 5),
      status: 'completed',
    };
    const summary = computeTrainingSummary([protocolDay1, standaloneSession]);
    expect(summary.days.map((d) => d.sessionDay)).toEqual([1]);
    expect(summary.totalDaysCompleted).toBe(1);
  });
});
