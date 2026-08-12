import type { Assessment, AntScores } from '../data/schema';

/**
 * Prä-vs-Post-Effektdarstellung (Plan §5.3 Punkt 1): Δ und %-Änderung je
 * ANT-Netzwerk-Score zwischen Baseline- und Post-Test. Reine Funktion ohne
 * Firestore-Zugriff, damit die Auswertung testbar ist.
 */

export type EffectMetricKey = Extract<
  keyof AntScores,
  'overallRT' | 'conflictRT' | 'alertingRT' | 'orientingRT' | 'overallErrorRate'
>;

export interface EffectMetric {
  key: EffectMetricKey;
  label: string;
  unit: 'ms' | '%';
  baseline: number;
  post: number;
  /** post − baseline (in der Einheit der Metrik). */
  delta: number;
  /** null, wenn Baseline 0 ist (Division durch 0 nicht definiert). */
  percentChange: number | null;
}

export interface EffectSummary {
  baseline: Assessment;
  post: Assessment;
  metrics: EffectMetric[];
}

const METRIC_DEFS: readonly { key: EffectMetricKey; label: string; unit: 'ms' | '%' }[] = [
  { key: 'overallRT', label: 'Overall-RT', unit: 'ms' },
  { key: 'conflictRT', label: 'Conflict-Score', unit: 'ms' },
  { key: 'alertingRT', label: 'Alerting-Score', unit: 'ms' },
  { key: 'orientingRT', label: 'Orienting-Score', unit: 'ms' },
  { key: 'overallErrorRate', label: 'Fehlerrate', unit: '%' },
];

/**
 * Letzter gültiger (nicht ausgeschlossener) Lauf einer Phase. `assessments`
 * kommt aus `listAssessments` aufsteigend nach Zeitstempel sortiert — bei
 * einem wiederholten Test (nach Exclusion) zählt der neueste gültige Lauf.
 */
function latestValid(
  assessments: readonly Assessment[],
  phase: 'baseline' | 'post',
): Assessment | undefined {
  const matches = assessments.filter((a) => a.phase === phase && !a.quality.excluded);
  return matches[matches.length - 1];
}

/**
 * Berechnet die Prä/Post-Effektdarstellung. Liefert null, solange kein
 * gültiges Baseline/Post-Paar vorliegt (z. B. Training noch nicht
 * abgeschlossen, oder beide Läufe wegen Fehlerrate > 40 % ausgeschlossen).
 */
export function computeEffectSummary(assessments: readonly Assessment[]): EffectSummary | null {
  const baseline = latestValid(assessments, 'baseline');
  const post = latestValid(assessments, 'post');
  if (!baseline || !post) return null;

  const metrics = METRIC_DEFS.map((def) => {
    const baselineValue = baseline.scores[def.key];
    const postValue = post.scores[def.key];
    const delta = postValue - baselineValue;
    const percentChange = baselineValue !== 0 ? (delta / Math.abs(baselineValue)) * 100 : null;
    return { ...def, baseline: baselineValue, post: postValue, delta, percentChange };
  });

  return { baseline, post, metrics };
}
