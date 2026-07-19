import { describe, expect, it } from 'vitest';
import type { Assessment, TrainingSession } from '../data/schema';
import { buildFullExportJson, scoresToCsv, sessionsToCsv, slugifyFilename, trialsToCsv } from './exportData';

function makeAssessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    id: 'a1',
    phase: 'baseline',
    ageGroupAtTest: 6,
    rngSeed: 'seed-1',
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
      overallRT: 1000,
      conflictRT: 100,
      alertingRT: 50,
      orientingRT: 30,
      overallErrorRate: 10,
      accuracyByCondition: {},
    },
    quality: { excluded: false, validTrialCount: 1 },
    rawTrials: [
      {
        index: 0,
        block: 1,
        cue: 'none',
        flanker: 'congruent',
        position: 'top',
        targetDir: 'L',
        responseDir: 'L',
        correct: true,
        rt: 900,
        onsetTs: 1234,
        fixationMs: 800,
      },
    ],
    timestamp: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  };
}

function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: 's1',
    sessionDay: 1,
    ageGroupAtTest: 6,
    rngSeed: 'seed-s1',
    exercises: [
      {
        exerciseId: 'side',
        levelsCompleted: 2,
        highestLevel: 2,
        trials: 21,
        correct: 18,
        errors: 2,
        missed: 1,
        trialToAdvanceRate: 5,
        durationMs: 60_000,
        perLevel: [{ level: 1, trials: 21, correct: 18, errors: 2 }],
      },
    ],
    timestamp: new Date('2026-01-02T09:00:00.000Z'),
    ...overrides,
  };
}

describe('trialsToCsv', () => {
  it('erzeugt Header + eine Zeile pro Trial mit Assessment-Kontext', () => {
    const csv = trialsToCsv([makeAssessment()]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'assessmentId,phase,timestamp,rngSeed,trialIndex,block,cue,flanker,position,targetDir,responseDir,correct,rt,onsetTs,fixationMs',
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('a1,baseline,2026-01-01T10:00:00.000Z,seed-1,0,1,none,congruent,top,L,L,true,900,1234,800');
  });

  it('liefert nur die Kopfzeile ohne Assessments', () => {
    const csv = trialsToCsv([]);
    expect(csv.split('\n')).toHaveLength(1);
  });
});

describe('scoresToCsv', () => {
  it('erzeugt eine Zeile pro Assessment mit Scores und Quality', () => {
    const excluded = makeAssessment({
      id: 'a2',
      phase: 'post',
      quality: { excluded: true, reason: 'Fehlerrate 45.0 % > 40 %', validTrialCount: 50 },
    });
    const csv = scoresToCsv([makeAssessment(), excluded]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[2]).toContain('a2,post');
    expect(lines[2]).toContain('Fehlerrate 45.0 % > 40 %');
  });

  it('quotet Feldwerte mit Komma (CSV-Escaping)', () => {
    const withComma = makeAssessment({
      quality: { excluded: true, reason: 'Bedingung A, Bedingung B fehlen', validTrialCount: 0 },
    });
    const csv = scoresToCsv([withComma]);
    expect(csv.split('\n')[1]).toContain('"Bedingung A, Bedingung B fehlen"');
  });
});

describe('sessionsToCsv', () => {
  it('erzeugt eine Zeile pro Übungsergebnis mit Sitzungs-Kontext', () => {
    const csv = sessionsToCsv([makeSession()]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'sessionId,sessionDay,timestamp,exerciseId,levelsCompleted,highestLevel,trials,correct,errors,missed,trialToAdvanceRate,durationMs',
    );
    expect(lines[1]).toBe('s1,1,2026-01-02T09:00:00.000Z,side,2,2,21,18,2,1,5,60000');
  });
});

describe('buildFullExportJson', () => {
  it('serialisiert Kind, Assessments und Sessions inkl. ISO-Zeitstempel', () => {
    const json = buildFullExportJson(
      { displayName: 'Kater Blau', ageGroup: 6, studyGroup: 'trained' },
      [makeAssessment()],
      [makeSession()],
    ) as Record<string, unknown>;

    expect(json.child).toEqual({ displayName: 'Kater Blau', ageGroup: 6, studyGroup: 'trained' });
    expect(Array.isArray(json.assessments)).toBe(true);
    const [assessment] = json.assessments as Record<string, unknown>[];
    expect(assessment!.timestamp).toBe('2026-01-01T10:00:00.000Z');
    const [session] = json.trainingSessions as Record<string, unknown>[];
    expect(session!.timestamp).toBe('2026-01-02T09:00:00.000Z');
  });

  it('setzt studyGroup auf null, wenn nicht gepflegt', () => {
    const json = buildFullExportJson(
      { displayName: 'Kater Grün', ageGroup: 4, studyGroup: undefined },
      [],
      [],
    ) as Record<string, unknown>;
    expect((json.child as Record<string, unknown>).studyGroup).toBeNull();
  });
});

describe('slugifyFilename', () => {
  it('macht aus Anzeigenamen einen dateisicheren Slug', () => {
    expect(slugifyFilename('Kater Blau!')).toBe('kater-blau');
    expect(slugifyFilename('  Émile  ')).toBe('mile');
  });

  it('fällt auf "kind" zurück, wenn nichts übrig bleibt', () => {
    expect(slugifyFilename('!!!')).toBe('kind');
  });
});
