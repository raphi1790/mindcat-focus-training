import { Timestamp } from 'firebase/firestore';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  assessmentDocSchema,
  assessmentInputSchema,
  childDocSchema,
  childInputSchema,
  exerciseProgressStateSchema,
  trainingSessionDocSchema,
  trainingSessionInputSchema,
  trainingSessionProgressSchema,
  trialSchema,
  type ExerciseProgressStateShape,
} from './index';
import {
  createExerciseProgress,
  type ExerciseProgressState,
} from '../../training/engine/exerciseProgress';

const validTrial = {
  index: 0,
  block: 1,
  cue: 'spatial',
  flanker: 'incongruent',
  position: 'top',
  targetDir: 'L',
  responseDir: 'L',
  correct: true,
  rt: 812.4,
  onsetTs: 123456.7,
  fixationMs: 900,
} as const;

const validAssessmentInput = {
  phase: 'baseline',
  ageGroupAtTest: 4,
  rngSeed: 'seed-abc',
  config: {
    practiceTrials: 24,
    testBlocks: 3,
    trialsPerBlock: 48,
    timings: {
      fixationMinMs: 400,
      fixationMaxMs: 1600,
      cueMs: 150,
      postCueFixationMs: 450,
      targetMaxMs: 1700,
    },
  },
  scores: {
    overallRT: 1620,
    conflictRT: 180,
    alertingRT: 60,
    orientingRT: 40,
    overallErrorRate: 15.3,
    accuracyByCondition: { 'flanker:incongruent': 0.81 },
  },
  quality: { excluded: false, validTrialCount: 122 },
  rawTrials: [validTrial],
} as const;

describe('childInputSchema', () => {
  it('akzeptiert ein gültiges Kind und trimmt den Namen', () => {
    const parsed = childInputSchema.parse({
      displayName: '  Mia  ',
      ageGroup: 4,
      birthMonth: '2022-03',
      studyGroup: 'trained',
    });
    expect(parsed.displayName).toBe('Mia');
  });

  it('lehnt ungültige Altersgruppen ab (nur 4 und 6)', () => {
    expect(() => childInputSchema.parse({ displayName: 'Tim', ageGroup: 5 })).toThrow();
  });

  it('lehnt leeren Namen und falsches birthMonth-Format ab', () => {
    expect(() => childInputSchema.parse({ displayName: '   ', ageGroup: 6 })).toThrow();
    expect(() =>
      childInputSchema.parse({ displayName: 'Tim', ageGroup: 6, birthMonth: '03.2022' }),
    ).toThrow();
  });
});

describe('childDocSchema', () => {
  it('wandelt Firestore-Timestamp in Date um', () => {
    const parsed = childDocSchema.parse({
      displayName: 'Mia',
      ageGroup: 6,
      createdAt: Timestamp.fromDate(new Date('2026-07-01T10:00:00Z')),
      archived: false,
    });
    expect(parsed.createdAt).toBeInstanceOf(Date);
    expect(parsed.createdAt.toISOString()).toBe('2026-07-01T10:00:00.000Z');
  });
});

describe('trialSchema', () => {
  it('akzeptiert einen korrekten Trial', () => {
    expect(trialSchema.parse(validTrial)).toEqual(validTrial);
  });

  it('akzeptiert einen Miss (responseDir/correct/rt = null)', () => {
    const miss = { ...validTrial, responseDir: null, correct: null, rt: null };
    expect(trialSchema.parse(miss)).toEqual(miss);
  });

  it('lehnt unbekannte Cue-/Flanker-Werte ab', () => {
    expect(() => trialSchema.parse({ ...validTrial, cue: 'blink' })).toThrow();
    expect(() => trialSchema.parse({ ...validTrial, flanker: 'mixed' })).toThrow();
  });

  it('lehnt negative RT ab', () => {
    expect(() => trialSchema.parse({ ...validTrial, rt: -5 })).toThrow();
  });
});

describe('assessmentInputSchema / assessmentDocSchema', () => {
  it('akzeptiert einen vollständigen Baseline-Lauf', () => {
    expect(() => assessmentInputSchema.parse(validAssessmentInput)).not.toThrow();
  });

  it('lehnt unbekannte Phasen ab', () => {
    expect(() =>
      assessmentInputSchema.parse({ ...validAssessmentInput, phase: 'midterm' }),
    ).toThrow();
  });

  it('lehnt Fehlerraten außerhalb 0–100 % ab', () => {
    expect(() =>
      assessmentInputSchema.parse({
        ...validAssessmentInput,
        scores: { ...validAssessmentInput.scores, overallErrorRate: 140 },
      }),
    ).toThrow();
  });

  it('Doc-Schema ergänzt den Server-Zeitstempel als Date', () => {
    const doc = assessmentDocSchema.parse({
      ...validAssessmentInput,
      timestamp: Timestamp.fromDate(new Date('2026-07-14T09:00:00Z')),
    });
    expect(doc.timestamp).toBeInstanceOf(Date);
  });
});

describe('trainingSessionInputSchema', () => {
  const exercise = {
    exerciseId: 'number-stroop',
    levelsCompleted: 4,
    highestLevel: 5,
    trials: 22,
    correct: 19,
    errors: 2,
    missed: 1,
    trialToAdvanceRate: 5.5,
    durationMs: 240_000,
    perLevel: [{ level: 1, trials: 3, correct: 3, errors: 0 }],
  } as const;

  it('akzeptiert eine gültige Sitzung', () => {
    expect(() =>
      trainingSessionInputSchema.parse({
        sessionDay: 3,
        ageGroupAtTest: 6,
        rngSeed: 'session-seed',
        exercises: [exercise],
      }),
    ).not.toThrow();
  });

  it('akzeptiert eine Standalone-Sitzung mit sessionDay: 0 und mode: standalone', () => {
    const parsed = trainingSessionInputSchema.parse({
      sessionDay: 0,
      mode: 'standalone',
      ageGroupAtTest: 4,
      rngSeed: 'mindcat-v1:practice:side',
      exercises: [],
    });
    expect(parsed.sessionDay).toBe(0);
    expect(parsed.mode).toBe('standalone');
  });

  it('lässt mode optional und setzt Default-Wert für sessionDay (0)', () => {
    const parsed = trainingSessionInputSchema.parse({
      ageGroupAtTest: 6,
      rngSeed: 'seed',
      exercises: [],
    });
    expect(parsed.mode).toBeUndefined();
    expect(parsed.sessionDay).toBe(0);
  });

  it('lehnt sessionDay außerhalb 0–5 und unbekannte Übungs-IDs ab', () => {
    expect(() =>
      trainingSessionInputSchema.parse({
        sessionDay: 6,
        ageGroupAtTest: 6,
        rngSeed: 's',
        exercises: [],
      }),
    ).toThrow();
    expect(() =>
      trainingSessionInputSchema.parse({
        sessionDay: -1,
        ageGroupAtTest: 6,
        rngSeed: 's',
        exercises: [],
      }),
    ).toThrow();
    expect(() =>
      trainingSessionInputSchema.parse({
        sessionDay: 1,
        ageGroupAtTest: 6,
        rngSeed: 's',
        exercises: [{ ...exercise, exerciseId: 'tetris' }],
      }),
    ).toThrow();
  });
});

describe('exerciseProgressStateSchema (AP6)', () => {
  it('parst den frischen Engine-Startzustand', () => {
    expect(() => exerciseProgressStateSchema.parse(createExerciseProgress())).not.toThrow();
  });

  it('spiegelt ExerciseProgressState strukturell (Typ-Gleichheit)', () => {
    // Sichert ab, dass der zod-Spiegel an der Firestore-Grenze nicht vom
    // Engine-Typ abdriftet (sonst würde Resume falsch (de)serialisieren).
    expectTypeOf<ExerciseProgressStateShape>().toEqualTypeOf<ExerciseProgressState>();
  });

  it('lehnt ein Level < 1 ab', () => {
    expect(() =>
      exerciseProgressStateSchema.parse({ ...createExerciseProgress(), level: 0 }),
    ).toThrow();
  });
});

describe('trainingSessionDocSchema (AP6)', () => {
  const baseDoc = {
    sessionDay: 2,
    ageGroupAtTest: 6,
    rngSeed: 'mindcat-v1:day2',
    exercises: [],
    timestamp: Timestamp.fromDate(new Date('2026-07-20T09:00:00Z')),
  } as const;

  it('Alt-Dokument ohne status parst als completed', () => {
    const parsed = trainingSessionDocSchema.parse(baseDoc);
    expect(parsed.status).toBe('completed');
    expect(parsed.checkpoint).toBeUndefined();
  });

  it('laufendes Dokument mit Checkpoint parst und wandelt Zeitstempel um', () => {
    const parsed = trainingSessionDocSchema.parse({
      ...baseDoc,
      status: 'in-progress',
      checkpoint: {
        exerciseIndex: 1,
        exerciseId: 'chase',
        engineState: { ...createExerciseProgress(), level: 3, totalTrials: 12 },
        updatedAt: Timestamp.fromDate(new Date('2026-07-20T09:05:00Z')),
      },
    });
    expect(parsed.status).toBe('in-progress');
    expect(parsed.checkpoint?.exerciseIndex).toBe(1);
    expect(parsed.checkpoint?.engineState.level).toBe(3);
    expect(parsed.checkpoint?.updatedAt).toBeInstanceOf(Date);
  });

  it('lehnt unbekannten status ab', () => {
    expect(() => trainingSessionDocSchema.parse({ ...baseDoc, status: 'paused' })).toThrow();
  });
});

describe('trainingSessionProgressSchema (AP6)', () => {
  it('akzeptiert nur einen Checkpoint (ohne Ergebnisliste)', () => {
    expect(() =>
      trainingSessionProgressSchema.parse({
        checkpoint: { exerciseIndex: 0, exerciseId: 'side', engineState: createExerciseProgress() },
      }),
    ).not.toThrow();
  });

  it('akzeptiert ein leeres Update (beide Felder optional)', () => {
    expect(() => trainingSessionProgressSchema.parse({})).not.toThrow();
  });
});
