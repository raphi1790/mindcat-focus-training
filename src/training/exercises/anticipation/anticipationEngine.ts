import type { Rng } from '../../../platform/rng';

export type AnticipationPhase = 'approaching' | 'catchable' | 'arrived' | 'done';

/** Visible portion of the pond swim in the invisible variant before diving under lily pads. */
export const INVISIBLE_VISIBLE_PROGRESS_LIMIT = 0.38;

/**
 * Dynamische Spuren-Skalierung nach Rueda et al. (2005):
 * Level 1–3: 5 Spuren, Level 4–7: 7 Spuren.
 */
export function lanesForLevel(level: number): number {
  return level >= 4 ? 7 : 5;
}

/**
 * Altersgerechte Schwimmzeit (Rueda 2005):
 * Level 1: 3600 ms -> Level 7: 2400 ms (-200 ms pro Level).
 */
export function travelMsForLevel(level: number): number {
  return Math.max(2400, 3600 - (level - 1) * 200);
}

/**
 * Altersgerechtes Fangfenster am Ufer:
 * Level 1: 1600 ms -> Level 7: 1000 ms (-100 ms pro Level).
 */
export function catchWindowMsForLevel(level: number): number {
  return Math.max(1000, 1600 - (level - 1) * 100);
}

/**
 * Prüft, ob die Ente in ihrer Teich-Spur aktuell sichtbar ist:
 * - Am Ufer (`catchable` / `arrived` / `done`) ist die Ente immer sichtbar.
 * - Während des Anflugs (`approaching`):
 *   - `visible`: durchgehend auf der gesamten Schwimmstrecke sichtbar.
 *   - `invisible`: im oberen Bereich (`progress < 0.38`) sichtbar (Spur & Tempo erkennbar),
 *     taucht ab `progress >= 0.38` unter die Seerosen-Abdeckung ab.
 */
export function isDuckVisibleInPond(
  variant: 'visible' | 'invisible' | boolean,
  phase: AnticipationPhase,
  progress: number,
): boolean {
  const isVisibleVariant = variant === true || variant === 'visible';
  if (phase !== 'approaching') return true;
  if (isVisibleVariant) return true;
  return progress < INVISIBLE_VISIBLE_PROGRESS_LIMIT;
}

export function pickTargetLane(rng: Rng, lanes: number, exclude: number): number {
  let lane: number;
  let guard = 0;
  do {
    lane = rng.int(0, lanes);
    guard += 1;
  } while (lane === exclude && guard < 20);
  return lane;
}
