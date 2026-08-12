import type { Trial } from '../data/schema';

/**
 * RT-Verteilung congruent vs. incongruent (Plan §5.3 Punkt 3) — Transparenz
 * über die Datenqualität hinter dem Conflict-Score. Nur korrekte Trials mit
 * Antwort gehen ein (analog zum Scoring, s. `assessment/ant/scoring.ts`).
 */

export interface HistogramBin {
  binStart: number;
  binEnd: number;
  congruentCount: number;
  incongruentCount: number;
}

export interface RtHistogram {
  bins: HistogramBin[];
  binWidthMs: number;
  congruentN: number;
  incongruentN: number;
}

const DEFAULT_BIN_COUNT = 8;

function correctRts(trials: readonly Trial[], flanker: 'congruent' | 'incongruent'): number[] {
  return trials
    .filter((t): t is Trial & { rt: number } => t.correct === true && t.flanker === flanker && t.rt !== null)
    .map((t) => t.rt);
}

/**
 * Baut gemeinsame Bin-Grenzen über beide Bedingungen (sonst wären die Balken
 * nicht vergleichbar) und zählt congruent/incongruent getrennt pro Bin.
 * Liefert null, wenn keine der beiden Bedingungen korrekte RTs hat.
 */
export function buildRtHistogram(
  trials: readonly Trial[],
  binCount: number = DEFAULT_BIN_COUNT,
): RtHistogram | null {
  const congruentRts = correctRts(trials, 'congruent');
  const incongruentRts = correctRts(trials, 'incongruent');
  const all = [...congruentRts, ...incongruentRts];
  if (all.length === 0) return null;

  const min = Math.min(...all);
  const max = Math.max(...all);
  const binWidthMs = max > min ? (max - min) / binCount : 1;

  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => ({
    binStart: min + i * binWidthMs,
    binEnd: i === binCount - 1 ? max : min + (i + 1) * binWidthMs,
    congruentCount: 0,
    incongruentCount: 0,
  }));

  const binIndexOf = (rt: number): number => {
    if (max === min) return 0;
    return Math.min(binCount - 1, Math.floor((rt - min) / binWidthMs));
  };

  for (const rt of congruentRts) {
    const bin = bins[binIndexOf(rt)];
    if (bin) bin.congruentCount += 1;
  }
  for (const rt of incongruentRts) {
    const bin = bins[binIndexOf(rt)];
    if (bin) bin.incongruentCount += 1;
  }

  return { bins, binWidthMs, congruentN: congruentRts.length, incongruentN: incongruentRts.length };
}
