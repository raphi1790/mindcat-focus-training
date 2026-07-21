import {
  assessmentInputSchema,
  trainingSessionInputSchema,
  type AgeGroup,
  type Assessment,
  type AssessmentInput,
  type TrainingSession,
} from '../data/schema';
import { computeEffectSummary, type EffectSummary } from '../dashboard/effectSummary';
import { computeTrainingSummary, type TrainingSummary } from '../dashboard/trainingSummary';
import {
  RESPONDER_PRESETS,
  simulateAssessment,
  type SimulatedAssessment,
} from './participantModel';
import { simulateTrainingProgram, type SimulatedTrainingDay } from './trainingModel';

/**
 * End-to-End-Pilotlauf (Plan §9 Phase 6, Abnahme §5.2/§6.2): Für je ein Kind
 * der Altersgruppen 4 und 6 wird der komplette wissenschaftliche Ablauf
 * durchgespielt — Baseline-ANT → 5 Trainingstage → Post-ANT — ausschließlich
 * über die echten Produktionsmodule (Trial-Generatoren, Scoring, Scheduler,
 * Advancement-Engine, Dashboard-Auswertung). Jedes erzeugte Dokument wird
 * durch sein zod-Schema validiert (dieselbe Grenze wie beim Firestore-Write),
 * sodass der Lauf beweist, dass die produzierten Daten schema-gültig und in
 * den Plausibilitätsbereichen der Studie liegen.
 *
 * Da der automatisierte Browser rAF nicht ausführt (visibilityState dauerhaft
 * 'hidden') und die Gitter-Übungen damit nicht per Tastatur durchspielbar sind,
 * ist dies der belastbarste maschinell reproduzierbare E2E-Weg. Ein manueller
 * Playtest mit echter Hardware bleibt als visuelle Ergänzung sinnvoll.
 */

function buildAssessmentInput(
  phase: 'baseline' | 'post',
  ageGroup: AgeGroup,
  sim: SimulatedAssessment,
): AssessmentInput {
  return {
    phase,
    ageGroupAtTest: ageGroup,
    rngSeed: sim.rngSeed,
    config: sim.config,
    scores: sim.scoring.scores,
    quality: sim.scoring.quality,
    rawTrials: sim.rawTrials,
  };
}

/** Validiertes Input → Domänenobjekt (id/timestamp wie nach einem Firestore-Read). */
function toAssessment(input: AssessmentInput, id: string, timestamp: Date): Assessment {
  return { id, timestamp, ...assessmentInputSchema.parse(input) };
}

function toTrainingSession(day: SimulatedTrainingDay, id: string, timestamp: Date): TrainingSession {
  return { id, timestamp, status: 'completed', ...trainingSessionInputSchema.parse(day.input) };
}

export interface PilotChildReport {
  ageGroup: AgeGroup;
  baseline: Assessment;
  post: Assessment;
  effect: EffectSummary;
  training: {
    sessions: TrainingSession[];
    summary: TrainingSummary;
  };
}

export interface PilotReport {
  seed: string;
  children: PilotChildReport[];
  /** Beweis, dass die Exclusion-Regel (>40 % Fehler) end-to-end greift. */
  exclusionDemo: Assessment;
}

function runChild(ageGroup: AgeGroup, seed: string, clock: Date): PilotChildReport {
  const childSeed = `${seed}:age${ageGroup}`;
  const presets = RESPONDER_PRESETS[ageGroup];

  const baselineInput = buildAssessmentInput(
    'baseline',
    ageGroup,
    simulateAssessment(`${childSeed}:baseline`, presets.baseline),
  );
  const baseline = toAssessment(baselineInput, `${childSeed}:baseline`, new Date(clock));

  const days = simulateTrainingProgram(ageGroup, `${childSeed}:training`);
  const sessions = days.map((day) =>
    toTrainingSession(day, `${childSeed}:day${day.sessionDay}`, new Date(clock.getTime() + day.sessionDay * 86_400_000)),
  );

  const postInput = buildAssessmentInput(
    'post',
    ageGroup,
    simulateAssessment(`${childSeed}:post`, presets.post),
  );
  const post = toAssessment(postInput, `${childSeed}:post`, new Date(clock.getTime() + 6 * 86_400_000));

  const effect = computeEffectSummary([baseline, post]);
  if (!effect) {
    // Kann nur passieren, wenn ein Lauf ausgeschlossen wurde — im Pilot ein Fehler.
    throw new Error(`Kein gültiges Baseline/Post-Paar für Altersgruppe ${ageGroup}`);
  }

  return {
    ageGroup,
    baseline,
    post,
    effect,
    training: { sessions, summary: computeTrainingSummary(sessions) },
  };
}

/**
 * Führt den vollständigen Pilotlauf deterministisch aus. Derselbe Seed liefert
 * exakt denselben Report (wissenschaftliche Reproduzierbarkeit).
 */
export function runPilot(seed = 'pilot-2026'): PilotReport {
  const clock = new Date('2026-07-20T09:00:00.000Z');
  const children = ([4, 6] as const).map((age) => runChild(age, seed, clock));

  const exclusionSim = simulateAssessment(`${seed}:exclusion`, {
    baseRT: 1200,
    conflictEffect: 0,
    alertingEffect: 0,
    orientingEffect: 0,
    rtJitter: 400,
    errorBase: 0.5,
    errorIncongruent: 0,
    missProb: 0.02,
  });
  const exclusionDemo = toAssessment(
    buildAssessmentInput('baseline', 6, exclusionSim),
    `${seed}:exclusion`,
    new Date(clock),
  );

  return { seed, children, exclusionDemo };
}

/** Menschlich lesbarer Report für den CLI-/Testausdruck. */
export function formatPilotReport(report: PilotReport): string {
  const lines: string[] = [];
  const ms = (n: number) => `${Math.round(n)} ms`;
  const pct = (n: number) => `${n.toFixed(1)} %`;

  lines.push(`═══ Pilotlauf (Seed: ${report.seed}) ═══`);

  for (const child of report.children) {
    const { baseline, post, effect, training } = child;
    lines.push('');
    lines.push(`── Kind, Altersgruppe ${child.ageGroup} ──`);
    lines.push(
      `  Baseline: overall ${ms(baseline.scores.overallRT)}, conflict ${ms(baseline.scores.conflictRT)}, ` +
        `alerting ${ms(baseline.scores.alertingRT)}, orienting ${ms(baseline.scores.orientingRT)}, ` +
        `Fehler ${pct(baseline.scores.overallErrorRate)} (${baseline.quality.validTrialCount}/${baseline.rawTrials.length} gültig)`,
    );
    lines.push(
      `  Post:     overall ${ms(post.scores.overallRT)}, conflict ${ms(post.scores.conflictRT)}, ` +
        `alerting ${ms(post.scores.alertingRT)}, orienting ${ms(post.scores.orientingRT)}, ` +
        `Fehler ${pct(post.scores.overallErrorRate)}`,
    );
    lines.push('  Trainingseffekt (Post − Baseline):');
    for (const m of effect.metrics) {
      const change = m.percentChange === null ? '—' : `${m.percentChange > 0 ? '+' : ''}${m.percentChange.toFixed(1)} %`;
      const delta = `${m.delta > 0 ? '+' : ''}${Math.round(m.delta)} ${m.unit}`;
      lines.push(`    ${m.label.padEnd(16)} ${delta.padStart(10)}  (${change})`);
    }
    lines.push(
      `  Training: ${training.summary.totalDaysCompleted} Tage, ` +
        `${training.summary.totalExercisesCompleted} Übungen abgeschlossen, ` +
        `Ø Trial-to-Advance ${training.summary.avgTrialToAdvanceRate?.toFixed(2) ?? '—'}, ` +
        `Fehlerrate ${pct(training.summary.overallErrorRate)}`,
    );
    for (const day of training.summary.days) {
      lines.push(
        `    Tag ${day.sessionDay}: ${day.exercisesCompleted} Übungen, ${day.totalTrials} Trials, ` +
          `Fehler ${pct(day.errorRate)}, Ø Advance ${day.avgTrialToAdvanceRate?.toFixed(2) ?? '—'}`,
      );
    }
  }

  lines.push('');
  lines.push('── Exclusion-Nachweis (Zufalls-Antworter) ──');
  lines.push(
    `  Fehlerrate ${pct(report.exclusionDemo.scores.overallErrorRate)} → ausgeschlossen: ` +
      `${report.exclusionDemo.quality.excluded ? 'JA' : 'NEIN'} (${report.exclusionDemo.quality.reason ?? '—'})`,
  );

  return lines.join('\n');
}
