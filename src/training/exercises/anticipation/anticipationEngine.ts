import type { Rng } from '../../../platform/rng';

/**
 * Dynamische Spuren-Skalierung nach Rueda et al. (2005):
 * Level 1–3: 5 Spuren, Level 4–7: 7 Spuren.
 */
export function lanesForLevel(level: number): number {
  return level >= 4 ? 7 : 5;
}

export function travelMsForLevel(level: number): number {
  return Math.max(1500, 3600 - (level - 1) * 350);
}

export function catchWindowMsForLevel(level: number): number {
  return Math.max(600, 1400 - (level - 1) * 120);
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
