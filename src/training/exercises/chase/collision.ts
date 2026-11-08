import type { Rng } from '../../../platform/rng';

export type Pos = { x: number; y: number };

const MOVE_DIRECTIONS: readonly Pos[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
];

const LEVEL_1_STEP_OPTIONS: readonly Pos[] = [...MOVE_DIRECTIONS, { x: 0, y: 0 }];

export const FLEE_PROBABILITY_BY_LEVEL: Record<number, number> = {
  1: 0,
  2: 0.25,
  3: 0.45,
  4: 0.6,
  5: 0.75,
  6: 0.85,
  7: 0.95,
};

export function fleeProbabilityForLevel(level: number): number {
  const clamped = Math.min(Math.max(Math.floor(level), 1), 7);
  return FLEE_PROBABILITY_BY_LEVEL[clamped] ?? 0;
}

export function stepIntervalForLevel(level: number): number {
  return Math.max(220, 700 - (level - 1) * 75);
}

function distSq(a: Pos, b: Pos): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Berechnet den nächsten Schritt des Regenschirms (Issue #44).
 * - Level 1: 0 % Flucht-Bias, zufällige Wahl inkl. Stillstand {0, 0}.
 * - Ab Level 2: Kein Stillstand mehr (nur echte Schritte innerhalb des Gitters)
 *   und steigende Flucht-Wahrscheinlichkeit (Flee-Bias), bei der Felder gewählt
 *   werden, die die Distanz zur Katze vergrößern bzw. maximal halten.
 */
export function stepUmbrella(
  pos: Pos,
  catPos: Pos,
  level: number,
  rng: Rng,
  gridSize = 8,
): Pos {
  if (level <= 1) {
    const choice = rng.pick(LEVEL_1_STEP_OPTIONS);
    return {
      x: Math.min(Math.max(pos.x + choice.x, 0), gridSize - 1),
      y: Math.min(Math.max(pos.y + choice.y, 0), gridSize - 1),
    };
  }

  const validNeighbors: Pos[] = [];
  for (const d of MOVE_DIRECTIONS) {
    const nx = pos.x + d.x;
    const ny = pos.y + d.y;
    if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
      validNeighbors.push({ x: nx, y: ny });
    }
  }

  if (validNeighbors.length === 0) return pos;

  const fleeProb = fleeProbabilityForLevel(level);
  if (rng.next() < fleeProb) {
    const currentDist = distSq(pos, catPos);
    const increasing = validNeighbors.filter((n) => distSq(n, catPos) > currentDist);
    if (increasing.length > 0) {
      return rng.pick(increasing);
    }
    const maxDist = Math.max(...validNeighbors.map((n) => distSq(n, catPos)));
    const best = validNeighbors.filter((n) => distSq(n, catPos) === maxDist);
    return rng.pick(best);
  }

  return rng.pick(validNeighbors);
}

/**
 * Kontinuierliche Kollisionserkennung zwischen Katze und Schirm (Issue #12).
 * Erkennt:
 * 1. Direkte Treffer: Katze landet auf Schirm oder Schirm zieht auf Katze
 * 2. Counter-Step / Swap: Katze und Schirm kreuzen denselben Pfad (Gegenbewegung auf gleicher Kante)
 * 3. Diagonale Swept Volume: Katze oder Schirm streifen das jeweils andere Objekt
 *    über die überstrichenen orthogonalen Zwischenfelder bei Diagonalschritten.
 */
export function checkChaseCollision(
  catPrev: Pos,
  catNext: Pos,
  targetPrev: Pos,
  targetNext: Pos,
): boolean {
  // 1. Direkter Treffer am Zielpunkt (oder Schirm zieht auf Katze)
  if (catNext.x === targetNext.x && catNext.y === targetNext.y) {
    return true;
  }

  // 2. Positionstausch / Gegenbewegung (Head-on Counter-Step auf gleicher Kante)
  if (
    catNext.x === targetPrev.x &&
    catNext.y === targetPrev.y &&
    targetNext.x === catPrev.x &&
    targetNext.y === catPrev.y
  ) {
    return true;
  }

  // 3. Diagonaler Swept-Volume-Check der Katze über orthogonale Zwischenfelder
  const catDx = catNext.x - catPrev.x;
  const catDy = catNext.y - catPrev.y;
  if (catDx !== 0 && catDy !== 0) {
    const inter1 = { x: catPrev.x + catDx, y: catPrev.y };
    const inter2 = { x: catPrev.x, y: catPrev.y + catDy };

    if (
      (inter1.x === targetNext.x && inter1.y === targetNext.y) ||
      (inter2.x === targetNext.x && inter2.y === targetNext.y) ||
      (inter1.x === targetPrev.x && inter1.y === targetPrev.y) ||
      (inter2.x === targetPrev.x && inter2.y === targetPrev.y)
    ) {
      return true;
    }
  }

  // 4. Diagonaler Swept-Volume-Check des Schirms über orthogonale Zwischenfelder
  const targetDx = targetNext.x - targetPrev.x;
  const targetDy = targetNext.y - targetPrev.y;
  if (targetDx !== 0 && targetDy !== 0) {
    const tInter1 = { x: targetPrev.x + targetDx, y: targetPrev.y };
    const tInter2 = { x: targetPrev.x, y: targetPrev.y + targetDy };

    if (
      (tInter1.x === catNext.x && tInter1.y === catNext.y) ||
      (tInter2.x === catNext.x && tInter2.y === catNext.y) ||
      (tInter1.x === catPrev.x && tInter1.y === catPrev.y) ||
      (tInter2.x === catPrev.x && tInter2.y === catPrev.y)
    ) {
      return true;
    }
  }

  return false;
}
