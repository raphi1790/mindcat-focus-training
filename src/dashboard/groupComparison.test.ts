import { describe, expect, it } from 'vitest';
import { computeGroupComparison, type GroupComparisonInput } from './groupComparison';
import type { EffectMetric, EffectSummary } from './effectSummary';

function makeSummary(conflictDelta: number, overallDelta: number): EffectSummary {
  const metrics: EffectMetric[] = [
    { key: 'overallRT', label: 'Overall-RT', unit: 'ms', baseline: 1500, post: 1500 + overallDelta, delta: overallDelta, percentChange: null },
    { key: 'conflictRT', label: 'Conflict-Score', unit: 'ms', baseline: 150, post: 150 + conflictDelta, delta: conflictDelta, percentChange: null },
    { key: 'alertingRT', label: 'Alerting-Score', unit: 'ms', baseline: 50, post: 50, delta: 0, percentChange: null },
    { key: 'orientingRT', label: 'Orienting-Score', unit: 'ms', baseline: 30, post: 30, delta: 0, percentChange: null },
    { key: 'overallErrorRate', label: 'Fehlerrate', unit: '%', baseline: 10, post: 10, delta: 0, percentChange: null },
  ];
  return { baseline: {} as EffectSummary['baseline'], post: {} as EffectSummary['post'], metrics };
}

describe('computeGroupComparison', () => {
  it('liefert leeres Array ohne Einträge', () => {
    expect(computeGroupComparison([])).toEqual([]);
  });

  it('mittelt Δ je Gruppe und zählt n korrekt', () => {
    const entries: GroupComparisonInput[] = [
      { childId: 'c1', studyGroup: 'trained', summary: makeSummary(-80, -300) },
      { childId: 'c2', studyGroup: 'trained', summary: makeSummary(-40, -100) },
      { childId: 'c3', studyGroup: 'control', summary: makeSummary(-10, -20) },
    ];
    const result = computeGroupComparison(entries);
    const trained = result.find((r) => r.studyGroup === 'trained');
    const control = result.find((r) => r.studyGroup === 'control');

    expect(trained).toBeDefined();
    expect(trained!.n).toBe(2);
    expect(trained!.avgDeltaByMetric.conflictRT).toBeCloseTo(-60, 5);
    expect(trained!.avgDeltaByMetric.overallRT).toBeCloseTo(-200, 5);

    expect(control!.n).toBe(1);
    expect(control!.avgDeltaByMetric.conflictRT).toBeCloseTo(-10, 5);
  });

  it('lässt Gruppen ohne Einträge weg', () => {
    const entries: GroupComparisonInput[] = [
      { childId: 'c1', studyGroup: 'trained', summary: makeSummary(-50, -100) },
    ];
    const result = computeGroupComparison(entries);
    expect(result).toHaveLength(1);
    expect(result[0]!.studyGroup).toBe('trained');
  });

  it('ignoriert Kinder ohne studyGroup', () => {
    const entries: GroupComparisonInput[] = [
      { childId: 'c1', studyGroup: undefined, summary: makeSummary(-50, -100) },
    ];
    expect(computeGroupComparison(entries)).toEqual([]);
  });
});
