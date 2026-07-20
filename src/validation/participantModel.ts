import { createRng, type Rng } from '../platform/rng';
import type { AntConfig, ResponseDirection, Trial } from '../data/schema';
import { ANT_CONFIG, ANT_TIMINGS } from '../assessment/ant/config';
import { generatePracticeBlock, generateTestBlock, type PlannedTrial } from '../assessment/ant/trials';
import { scoreAnt, type AntScoringResult } from '../assessment/ant/scoring';

/**
 * Simuliertes Antwortverhalten für den Pilotlauf (Plan §9 Phase 6).
 *
 * WICHTIG — das ist ein Mess-*Simulator*, kein Messgerät: Die Kennzahlen sind
 * so parametrisiert, dass sie in die Plausibilitätsbereiche der Studie (§10)
 * fallen, aber sie sind gesetzt, nicht erhoben. Der Zweck ist, die gesamte
 * Datenpipeline (Trial-Generierung → Scoring → Exclusion → zod-Schema) mit
 * realistischem Volumen end-to-end durchlaufen zu lassen und zu prüfen, dass
 * die Dokumente, die in Firestore landen würden, gültig und plausibel sind.
 *
 * Reproduzierbarkeit: Die Trial-Sequenz wird mit demselben Seed und denselben
 * Generatoren wie in der App erzeugt (`createRng(seed)`), die Antworten aus
 * einem separaten, abgeleiteten Strom (`createRng(seed + ':resp')`) — so bleibt
 * die präsentierte Sequenz identisch zu einem echten App-Lauf mit diesem Seed.
 */
export interface ResponderParams {
  /** Median-Basis-RT (kongruent, double-cue) in ms. */
  baseRT: number;
  /** Zusatz-RT bei inkongruenten Flankern (→ Conflict-Score). */
  conflictEffect: number;
  /** Zusatz-RT bei no-cue ggü. double-cue (→ Alerting-Score). */
  alertingEffect: number;
  /** Zusatz-RT bei central-cue ggü. spatial-cue (→ Orienting-Score). */
  orientingEffect: number;
  /**
   * Symmetrisches Rauschen ±jitter (ms). Bewusst niedriger als menschliche
   * Trial-Streuung: Der Simulator modelliert Bedingungs-*Mittelwerte*, nicht
   * die RT-Varianz einzelner Kinder — so bleiben die aus ~48 Trials je
   * Bedingung geschätzten Netzwerk-Scores gut bestimmt (der schmale
   * Conflict-Bereich der 6-Jährigen ist sonst nicht stabil schätzbar).
   */
  rtJitter: number;
  /** Basis-Fehlerwahrscheinlichkeit. */
  errorBase: number;
  /** Zusätzliche Fehlerwahrscheinlichkeit bei inkongruenten Trials. */
  errorIncongruent: number;
  /** Wahrscheinlichkeit für gar keine Antwort (Miss). */
  missProb: number;
}

const opposite = (dir: ResponseDirection): ResponseDirection => (dir === 'L' ? 'R' : 'L');

/** RT-Offset je Cue relativ zur double-/spatial-Basis (0). */
function cueOffset(cue: PlannedTrial['cue'], params: ResponderParams): number {
  if (cue === 'none') return params.alertingEffect;
  if (cue === 'central') return params.orientingEffect;
  return 0; // double, spatial
}

function respond(
  rng: Rng,
  plan: PlannedTrial,
  params: ResponderParams,
  index: number,
  block: number,
  onsetTs: number,
): Trial {
  const base = {
    index,
    block,
    cue: plan.cue,
    flanker: plan.flanker,
    position: plan.position,
    targetDir: plan.targetDir,
    fixationMs: plan.fixationMs,
    onsetTs,
  };

  if (rng.next() < params.missProb) {
    return { ...base, responseDir: null, correct: null, rt: null };
  }

  const errProb = params.errorBase + (plan.flanker === 'incongruent' ? params.errorIncongruent : 0);
  const wrong = rng.next() < errProb;
  const responseDir = wrong ? opposite(plan.targetDir) : plan.targetDir;

  let rt = params.baseRT + cueOffset(plan.cue, params);
  if (plan.flanker === 'incongruent') rt += params.conflictEffect;
  rt += (rng.next() * 2 - 1) * params.rtJitter;
  rt = Math.max(150, Math.round(rt));

  return { ...base, responseDir, correct: responseDir === plan.targetDir, rt };
}

export interface SimulatedAssessment {
  rngSeed: string;
  config: AntConfig;
  rawTrials: Trial[];
  scoring: AntScoringResult;
}

/**
 * Führt einen vollständigen Child-ANT-Lauf durch (Übungsblock + 3 Testblöcke),
 * exakt wie `ChildAnt` strukturiert: Der Übungsblock verbraucht den Generator-
 * RNG, wird aber nicht geloggt; nur die Testblöcke landen in `rawTrials`.
 */
export function simulateAssessment(seed: string, params: ResponderParams): SimulatedAssessment {
  const genRng = createRng(seed);
  const respRng = createRng(`${seed}:resp`);
  const rawTrials: Trial[] = [];
  let index = 0;

  for (let block = 0; block <= ANT_CONFIG.testBlocks; block++) {
    const planned = block === 0 ? generatePracticeBlock(genRng) : generateTestBlock(genRng);
    if (block === 0) continue; // Übungsblock wird präsentiert, aber nicht geloggt.
    for (const plan of planned) {
      const onsetTs = index * ANT_TIMINGS.totalTrialMs + 1;
      rawTrials.push(respond(respRng, plan, params, index, block, onsetTs));
      index += 1;
    }
  }

  return { rngSeed: seed, config: ANT_CONFIG, rawTrials, scoring: scoreAnt(rawTrials) };
}

/**
 * Parametersätze je Altersgruppe/Phase. Baseline liegt in den §10-Bereichen;
 * Post bildet einen Trainingseffekt ab (v. a. kleinerer Conflict-Score und
 * etwas schnellere Overall-RT — der in der Studie deutlichste Effekt).
 */
export const RESPONDER_PRESETS = {
  4: {
    baseline: {
      baseRT: 1680,
      conflictEffect: 190,
      alertingEffect: 55,
      orientingEffect: 35,
      rtJitter: 90,
      errorBase: 0.11,
      errorIncongruent: 0.07,
      missProb: 0.008,
    },
    post: {
      baseRT: 1500,
      conflictEffect: 110,
      alertingEffect: 50,
      orientingEffect: 35,
      rtJitter: 90,
      errorBase: 0.07,
      errorIncongruent: 0.05,
      missProb: 0.006,
    },
  },
  6: {
    baseline: {
      baseRT: 985,
      conflictEffect: 70,
      alertingEffect: 38,
      orientingEffect: 24,
      rtJitter: 45,
      errorBase: 0.021,
      errorIncongruent: 0.02,
      missProb: 0.004,
    },
    post: {
      baseRT: 920,
      conflictEffect: 34,
      alertingEffect: 35,
      orientingEffect: 22,
      rtJitter: 45,
      errorBase: 0.016,
      errorIncongruent: 0.015,
      missProb: 0.003,
    },
  },
} as const satisfies Record<4 | 6, { baseline: ResponderParams; post: ResponderParams }>;

/** Zufalls-Antworter (~50 % korrekt) — provoziert die Exclusion-Regel (>40 %). */
export const RANDOM_RESPONDER: ResponderParams = {
  baseRT: 1200,
  conflictEffect: 0,
  alertingEffect: 0,
  orientingEffect: 0,
  rtJitter: 400,
  errorBase: 0.5,
  errorIncongruent: 0,
  missProb: 0.02,
};
