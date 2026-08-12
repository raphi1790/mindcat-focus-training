import { describe, expect, it } from 'vitest';
import {
  assessmentInputSchema,
  trainingSessionInputSchema,
  type AgeGroup,
} from '../data/schema';
import { EXERCISE_CONFIGS } from '../training/exerciseConfigs';
import { getExerciseSetForAge } from '../data/exerciseSet';
import { EXCLUSION_ERROR_RATE_PERCENT } from '../assessment/ant/scoring';
import { formatPilotReport, runPilot, type PilotChildReport } from './pilot';

/**
 * Phase 6 — End-to-End-Pilotlauf. Prüft, dass der komplette Ablauf
 * (Baseline → 5 Trainingstage → Post) für beide Altersgruppen schema-gültige
 * Dokumente in den Plausibilitätsbereichen der Studie (§10) erzeugt.
 */

const report = runPilot();

/** Plausibilitätsbereiche aus Plan §10 (Größenordnungen, nicht Zielwerte). */
const PLAUSIBILITY: Record<AgeGroup, { overall: [number, number]; conflict: [number, number] }> = {
  4: { overall: [1500, 1900], conflict: [130, 260] },
  6: { overall: [900, 1100], conflict: [34, 86] },
};

function inRange(value: number, [min, max]: [number, number]): boolean {
  return value >= min && value <= max;
}

describe('Pilotlauf — Determinismus & Vollständigkeit', () => {
  it('ist deterministisch (gleicher Seed → gleicher Report)', () => {
    expect(formatPilotReport(runPilot('x'))).toBe(formatPilotReport(runPilot('x')));
  });

  it('liefert genau ein Kind je Altersgruppe (4 und 6)', () => {
    expect(report.children.map((c) => c.ageGroup)).toEqual([4, 6]);
  });
});

describe.each(report.children)('Kind Altersgruppe $ageGroup', (child: PilotChildReport) => {
  const { ageGroup, baseline, post, effect, training } = child;
  const ranges = PLAUSIBILITY[ageGroup];

  it('Baseline- und Post-Assessment sind schema-gültig', () => {
    expect(() => assessmentInputSchema.parse(baseline)).not.toThrow();
    expect(() => assessmentInputSchema.parse(post)).not.toThrow();
  });

  it('loggt vollständig 3×48 = 144 Test-Trials mit fortlaufendem Index', () => {
    for (const run of [baseline, post]) {
      expect(run.rawTrials).toHaveLength(144);
      expect(run.rawTrials.map((t) => t.index)).toEqual([...Array(144).keys()]);
      expect(run.rawTrials.every((t) => t.block >= 1 && t.block <= 3)).toBe(true);
    }
  });

  it('ist nicht ausgeschlossen und liegt unter der Fehler-Schwelle', () => {
    expect(baseline.quality.excluded).toBe(false);
    expect(post.quality.excluded).toBe(false);
    expect(baseline.scores.overallErrorRate).toBeLessThan(EXCLUSION_ERROR_RATE_PERCENT);
  });

  it('Overall- und Conflict-RT liegen in den Studien-Plausibilitätsbereichen (§10)', () => {
    expect(inRange(baseline.scores.overallRT, ranges.overall)).toBe(true);
    expect(inRange(baseline.scores.conflictRT, ranges.conflict)).toBe(true);
    // Alerting/Orienting sind positiv (no-cue langsamer als double, central als spatial).
    expect(baseline.scores.alertingRT).toBeGreaterThan(0);
    expect(baseline.scores.orientingRT).toBeGreaterThan(0);
  });

  it('zeigt einen Trainingseffekt: kleinere Conflict- und Overall-RT im Post', () => {
    const conflict = effect.metrics.find((m) => m.key === 'conflictRT')!;
    const overall = effect.metrics.find((m) => m.key === 'overallRT')!;
    expect(conflict.delta).toBeLessThan(0);
    expect(overall.delta).toBeLessThan(0);
  });

  it('absolviert alle 5 Trainingstage mit dem altersrichtigen Übungsset', () => {
    expect(training.sessions.map((s) => s.sessionDay)).toEqual([1, 2, 3, 4, 5]);

    const expectedSet = getExerciseSetForAge(ageGroup);
    const playedSet = training.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId));
    expect([...playedSet].sort()).toEqual([...expectedSet].sort());

    // Farmer nur für 6-Jährige.
    const hasFarmer = playedSet.includes('farmer');
    expect(hasFarmer).toBe(ageGroup === 6);
  });

  it('jeder Trainingstag ist schema-gültig und schließt alle Level jeder Übung ab', () => {
    for (const session of training.sessions) {
      expect(() => trainingSessionInputSchema.parse(session)).not.toThrow();
      for (const ex of session.exercises) {
        const config = EXERCISE_CONFIGS[ex.exerciseId];
        expect(ex.highestLevel).toBe(config.levels); // Abschluss ⇒ letztes Level erreicht
        expect(ex.trials).toBeGreaterThanOrEqual(config.minTrials);
        expect(ex.correct + ex.errors + ex.missed).toBe(ex.trials);
        expect(ex.trialToAdvanceRate).toBeGreaterThan(0);
      }
    }
  });
});

describe('Exclusion-Regel greift end-to-end', () => {
  it('markiert einen Zufalls-Antworter (>40 % Fehler) als ausgeschlossen', () => {
    const { exclusionDemo } = report;
    expect(exclusionDemo.scores.overallErrorRate).toBeGreaterThan(EXCLUSION_ERROR_RATE_PERCENT);
    expect(exclusionDemo.quality.excluded).toBe(true);
    expect(exclusionDemo.quality.reason).toMatch(/Fehlerrate/);
  });
});

describe('Pilot-Report (zur Sichtprüfung im Testlog)', () => {
  it('druckt eine Zusammenfassung', () => {
    console.log('\n' + formatPilotReport(report) + '\n');
    expect(report.children).toHaveLength(2);
  });
});
