export type Pos = { x: number; y: number };

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
