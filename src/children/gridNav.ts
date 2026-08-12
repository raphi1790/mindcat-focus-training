/**
 * Reine Fokus-Navigation für ein Karten-Raster (Kinder-Auswahl-Screen).
 * Getrennt von React/Input, damit die Kernlogik ohne DOM testbar ist.
 * Verwendet wird sie zusammen mit `useDirectionalInput` (Tastatur+Arcade).
 */
import type { Direction } from '../platform/input';

/**
 * Neuen Fokus-Index aus aktuellem Index + 8-Wege-Richtung berechnen.
 * Bleibt am Rand stehen (kein Wrap-Around) statt zu springen.
 */
export function moveGridFocus(
  currentIndex: number,
  direction: Direction,
  itemCount: number,
  columns: number,
): number {
  if (itemCount <= 0) return currentIndex;
  const clampedCurrent = Math.min(Math.max(currentIndex, 0), itemCount - 1);

  const row = Math.floor(clampedCurrent / columns);
  const col = clampedCurrent % columns;
  const rowCount = Math.ceil(itemCount / columns);

  let nextRow = row + direction.dy;
  let nextCol = col + direction.dx;

  nextRow = Math.min(Math.max(nextRow, 0), rowCount - 1);
  nextCol = Math.min(Math.max(nextCol, 0), columns - 1);

  let nextIndex = nextRow * columns + nextCol;
  // Letzte Reihe kann unvollständig sein — auf den letzten gültigen Index klemmen.
  if (nextIndex >= itemCount) {
    nextIndex = itemCount - 1;
  }
  return nextIndex;
}
