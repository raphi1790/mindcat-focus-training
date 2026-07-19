import { describe, expect, it } from 'vitest';
import type { Assessment, AntScores, AssessmentPhase } from '../data/schema';
import { computeEffectSummary } from './effectSummary';

let idCounter = 0;

function makeAssessment(
  phase: AssessmentPhase,
  scores: Partial<AntScores>,
  { excluded = false, timestamp = new Date(2026, 0, ++idCounter) }: { excluded?: boolean; timestamp?: Date } = {},
): Assessment {
  return {
    id: `a${idCounter}`,
    phase,
    ageGroupAtTest: 6,
    rngSeed: `seed-${idCounter}`,
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
      ...scores,
    },
    quality: { excluded, validTrialCount: 100 },
    rawTrials: [],
    timestamp,
  };
}

describe('computeEffectSummary', () => {
  it('liefert null ohne Baseline oder ohne Post', () => {
    expect(computeEffectSummary([])).toBeNull();
    expect(computeEffectSummary([makeAssessment('baseline', {})])).toBeNull();
    expect(computeEffectSummary([makeAssessment('post', {})])).toBeNull();
  });

  it('ignoriert ausgeschlossene Läufe', () => {
    const assessments = [
      makeAssessment('baseline', {}, { excluded: true }),
      makeAssessment('post', {}),
    ];
    expect(computeEffectSummary(assessments)).toBeNull();
  });

  it('berechnet Δ und %-Änderung je Metrik', () => {
    const baseline = makeAssessment('baseline', {
      overallRT: 1600,
      conflictRT: 200,
      alertingRT: 60,
      orientingRT: 40,
      overallErrorRate: 15,
    });
    const post = makeAssessment('post', {
      overallRT: 1200,
      conflictRT: 120,
      alertingRT: 55,
      orientingRT: 35,
      overallErrorRate: 5,
    });
    const summary = computeEffectSummary([baseline, post]);
    expect(summary).not.toBeNull();
    const byKey = Object.fromEntries(summary!.metrics.map((m) => [m.key, m]));

    expect(byKey.overallRT).toMatchObject({ baseline: 1600, post: 1200, delta: -400 });
    expect(byKey.overallRT!.percentChange).toBeCloseTo(-25, 5);
    expect(byKey.conflictRT).toMatchObject({ baseline: 200, post: 120, delta: -80 });
    expect(byKey.overallErrorRate).toMatchObject({ baseline: 15, post: 5, delta: -10 });
  });

  it('setzt percentChange auf null bei Baseline 0', () => {
    const baseline = makeAssessment('baseline', { alertingRT: 0 });
    const post = makeAssessment('post', { alertingRT: 10 });
    const summary = computeEffectSummary([baseline, post]);
    const alerting = summary!.metrics.find((m) => m.key === 'alertingRT');
    expect(alerting!.delta).toBe(10);
    expect(alerting!.percentChange).toBeNull();
  });

  it('verwendet bei mehreren gültigen Läufen den neuesten (Wiederholung nach Exclusion)', () => {
    const oldBaseline = makeAssessment('baseline', { overallRT: 1800 }, { timestamp: new Date(2026, 0, 1) });
    const retryBaseline = makeAssessment('baseline', { overallRT: 1500 }, { timestamp: new Date(2026, 0, 2) });
    const post = makeAssessment('post', { overallRT: 1000 });
    const summary = computeEffectSummary([oldBaseline, retryBaseline, post]);
    const overall = summary!.metrics.find((m) => m.key === 'overallRT');
    expect(overall!.baseline).toBe(1500);
  });
});
