import type { AntScores, AssessmentQuality, Trial } from '../../data/schema';

/**
 * ANT-Scoring nach Rueda et al. (2004): Median-RT ausschließlich korrekter
 * Trials je Bedingung, daraus die drei Netzwerk-Scores. Misses (keine
 * Antwort) zählen wie Fehler in die Fehlerrate, liefern aber keine RT.
 *
 * Exclusion-Regel der Studie: Fehlerrate > 40 % → Lauf wird als
 * ausgeschlossen markiert (Qualitätsflag, keine Löschung — Plan §5.1).
 */

/** Median; für die leere Menge nicht definiert → null. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** Fehlerrate-Schwelle der Studie (in %), ab der ein Lauf ausgeschlossen wird. */
export const EXCLUSION_ERROR_RATE_PERCENT = 40;

export interface AntScoringResult {
  scores: AntScores;
  quality: AssessmentQuality;
}

const rtsOf = (trials: readonly Trial[]): number[] =>
  trials.filter((t): t is Trial & { rt: number } => t.rt !== null).map((t) => t.rt);

function accuracyPercent(trials: readonly Trial[]): number {
  if (trials.length === 0) return 0;
  const correct = trials.filter((t) => t.correct === true).length;
  return (correct / trials.length) * 100;
}

/**
 * Berechnet Scores + Qualitätsflag aus dem vollständigen Test-Trial-Log.
 *
 * Fehlen in einer für die Netzwerk-Scores nötigen Bedingung korrekte Trials,
 * ist der zugehörige Median nicht definiert; der Score wird dann 0 gesetzt
 * und der Lauf zusätzlich als ausgeschlossen markiert (mit Begründung) —
 * solche Läufe sind statistisch ohnehin unbrauchbar.
 */
export function scoreAnt(trials: readonly Trial[]): AntScoringResult {
  const correctTrials = trials.filter((t) => t.correct === true);

  const conditionRts: Record<string, number | null> = {
    'cue:none': median(rtsOf(correctTrials.filter((t) => t.cue === 'none'))),
    'cue:double': median(rtsOf(correctTrials.filter((t) => t.cue === 'double'))),
    'cue:central': median(rtsOf(correctTrials.filter((t) => t.cue === 'central'))),
    'cue:spatial': median(rtsOf(correctTrials.filter((t) => t.cue === 'spatial'))),
    'flanker:incongruent': median(rtsOf(correctTrials.filter((t) => t.flanker === 'incongruent'))),
    'flanker:congruent': median(rtsOf(correctTrials.filter((t) => t.flanker === 'congruent'))),
  };
  const missingConditions = Object.keys(conditionRts).filter((k) => conditionRts[k] === null);
  const rt = (key: string): number => conditionRts[key] ?? 0;

  const wrong = trials.filter((t) => t.correct === false).length;
  const missed = trials.filter((t) => t.correct === null).length;
  const overallErrorRate = trials.length > 0 ? ((wrong + missed) / trials.length) * 100 : 0;

  const scores: AntScores = {
    overallRT: median(rtsOf(correctTrials)) ?? 0,
    conflictRT: rt('flanker:incongruent') - rt('flanker:congruent'),
    alertingRT: rt('cue:none') - rt('cue:double'),
    orientingRT: rt('cue:central') - rt('cue:spatial'),
    overallErrorRate,
    accuracyByCondition: {
      'cue:none': accuracyPercent(trials.filter((t) => t.cue === 'none')),
      'cue:central': accuracyPercent(trials.filter((t) => t.cue === 'central')),
      'cue:double': accuracyPercent(trials.filter((t) => t.cue === 'double')),
      'cue:spatial': accuracyPercent(trials.filter((t) => t.cue === 'spatial')),
      'flanker:neutral': accuracyPercent(trials.filter((t) => t.flanker === 'neutral')),
      'flanker:congruent': accuracyPercent(trials.filter((t) => t.flanker === 'congruent')),
      'flanker:incongruent': accuracyPercent(trials.filter((t) => t.flanker === 'incongruent')),
    },
  };

  let excluded = false;
  const reasons: string[] = [];
  if (overallErrorRate > EXCLUSION_ERROR_RATE_PERCENT) {
    excluded = true;
    reasons.push(
      `Fehlerrate ${overallErrorRate.toFixed(1)} % > ${EXCLUSION_ERROR_RATE_PERCENT} % (Studien-Exclusion-Regel)`,
    );
  }
  if (missingConditions.length > 0) {
    excluded = true;
    reasons.push(`Keine korrekten Trials in Bedingung(en): ${missingConditions.join(', ')}`);
  }

  const quality: AssessmentQuality = {
    excluded,
    ...(reasons.length > 0 ? { reason: reasons.join('; ') } : {}),
    validTrialCount: correctTrials.length,
  };

  return { scores, quality };
}
