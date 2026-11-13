import type { Rng } from '../../../platform/rng';
import type { Vec2 } from '../../shared/arenaMath';

export type AnticipationPhase = 'approaching' | 'catchable';

/** Sichtbarer Streckenanteil in der Unsichtbar-Variante vor dem Abtauchen. */
export const INVISIBLE_VISIBLE_PROGRESS_LIMIT = 0.35;

export const POND_START_Y = 8;
export const SHORE_TOP_Y = 82;
export const DUCK_TARGET_Y = 86;
export const CAT_SHORE_Y = 90;

export const CAT_SIZE = 10;
export const CAT_RADIUS = CAT_SIZE / 2;
export const DUCK_CATCH_RADIUS = 6;
export const CAT_MIN_X = CAT_RADIUS;
export const CAT_MAX_X = 100 - CAT_RADIUS;

/** Komfortable Ufer-Geschwindigkeit (%/s): volle Arena-Breite in ~1,64 s (< min. travelMs 2,4 s). */
export const CAT_SPEED = 55;

export interface DuckTrajectory {
  start: Vec2;
  target: Vec2;
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
 * Prüft, ob die Ente im Teich aktuell sichtbar ist:
 * - Am Ufer (`catchable`) ist die Ente immer sichtbar.
 * - Während des Anflugs (`approaching`):
 *   - `visible`: durchgehend auf der gesamten Trajektorie sichtbar.
 *   - `invisible`: für die ersten ~35 % sichtbar (Winkel & Tempo erkennbar),
 *     taucht ab `progress >= 0.35` unter die Teichoberfläche ab.
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

/**
 * Wählt deterministisch eine geradlinige Teich-Trajektorie von `start` (oben)
 * zu einem Ufer-Zielpunkt `target`, mit Abstand zur aktuellen Katzen-Position
 * und merklichem Schrägwinkel über den Teich.
 */
export function pickDuckTrajectory(
  rng: Rng,
  excludeCatX: number,
  minCatSeparation = 18,
  minAngleDeltaX = 12,
): DuckTrajectory {
  let targetX = 50;
  for (let i = 0; i < 20; i++) {
    targetX = 12 + rng.next() * 76;
    if (Math.abs(targetX - excludeCatX) >= minCatSeparation) break;
  }

  let startX = 50;
  for (let i = 0; i < 20; i++) {
    startX = 12 + rng.next() * 76;
    if (Math.abs(startX - targetX) >= minAngleDeltaX) break;
  }

  return {
    start: { x: startX, y: POND_START_Y },
    target: { x: targetX, y: DUCK_TARGET_Y },
  };
}

/** Berechnet die lineare Enten-Position auf der Trajektorie bei `progress ∈ [0, 1]`. */
export function duckPositionAt(trajectory: DuckTrajectory, progress: number): Vec2 {
  const p = Math.min(1, Math.max(0, progress));
  return {
    x: trajectory.start.x + (trajectory.target.x - trajectory.start.x) * p,
    y: trajectory.start.y + (trajectory.target.y - trajectory.start.y) * p,
  };
}
