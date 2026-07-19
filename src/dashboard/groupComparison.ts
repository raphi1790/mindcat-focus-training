import type { StudyGroup } from '../data/schema';
import type { EffectMetricKey, EffectSummary } from './effectSummary';

/**
 * Gruppenvergleich trained vs. control (Plan §5.3 Punkt 4, optional — nur
 * relevant, wenn `studyGroup` gepflegt ist). Mittelt die Prä/Post-Δ mehrerer
 * Kinder je Gruppe; reine Funktion auf bereits berechneten EffectSummaries.
 */

export interface GroupComparisonInput {
  childId: string;
  studyGroup: StudyGroup | undefined;
  summary: EffectSummary;
}

export interface GroupComparisonEntry {
  studyGroup: StudyGroup;
  /** Anzahl Kinder mit gültigem Baseline/Post-Paar in dieser Gruppe. */
  n: number;
  avgDeltaByMetric: Record<EffectMetricKey, number>;
}

const METRIC_KEYS: readonly EffectMetricKey[] = [
  'overallRT',
  'conflictRT',
  'alertingRT',
  'orientingRT',
  'overallErrorRate',
];

const GROUPS: readonly StudyGroup[] = ['trained', 'control'];

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function computeGroupComparison(
  entries: readonly GroupComparisonInput[],
): GroupComparisonEntry[] {
  return GROUPS.map((studyGroup) => {
    const summaries = entries.filter((e) => e.studyGroup === studyGroup).map((e) => e.summary);
    const avgDeltaByMetric = Object.fromEntries(
      METRIC_KEYS.map((key) => [
        key,
        mean(summaries.map((s) => s.metrics.find((m) => m.key === key)?.delta ?? 0)),
      ]),
    ) as Record<EffectMetricKey, number>;
    return { studyGroup, n: summaries.length, avgDeltaByMetric };
  }).filter((entry) => entry.n > 0);
}
