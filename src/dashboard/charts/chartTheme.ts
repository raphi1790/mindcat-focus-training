/**
 * Palette + Mark-Helfer für die Dashboard-Charts (dataviz-Skill,
 * validierte Default-Palette). Kategoriale Slots werden in fester
 * Reihenfolge vergeben (nie nach Rang/Filter neu zugeordnet).
 */

export const CHART_COLORS = {
  /** Kategorial Slot 1 (blau) — z. B. congruent, Kind A / Gruppe "trained". */
  seriesBlue: '#2a78d6',
  /** Kategorial Slot 2 (aqua) — z. B. Gruppe "control". */
  seriesAqua: '#1baf7a',
  /** Kategorial Slot 6 (rot) — z. B. incongruent. */
  seriesRed: '#e34948',
  ink: '#0b0b0b',
  inkSecondary: '#52514e',
  inkMuted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  surface: '#fcfcfb',
  successText: '#006300',
} as const;

/** Rundet auf eine "schöne" Obergrenze für Achsen (0/1000/2000-Stil). */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

/** Vorzeichenbehaftete Kurzform, z. B. "−80 ms" / "+3.2 %". */
export function formatSigned(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±';
  return `${sign}${Math.abs(rounded)}${unit}`;
}

/**
 * SVG-Pfad für einen Balken mit **oben abgerundeten, unten eckigen** Ecken
 * (Mark-Spec: "4px rounded data-end, square at the baseline"). Ein reines
 * <rect rx> würde alle vier Ecken runden.
 */
export function roundedTopBarPath(x: number, y: number, width: number, height: number, radius = 4): string {
  if (height <= 0 || width <= 0) return '';
  const r = Math.min(radius, width / 2, height);
  return [
    `M${x},${y + height}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${y + height}`,
    'Z',
  ].join(' ');
}
