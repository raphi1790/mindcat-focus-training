import { circleRectOverlap, type Rect, type Vec2 } from '../../shared/arenaMath';

/**
 * Side-Übung nach Rueda et al. (2005): motorische Kontrolle in einer offenen Arena (`0..100 %`).
 * - Katze startet in der sicheren Arena-Mitte `{ x: 50, y: 50 }` (auch bei Level-Resume).
 * - Randstreifen (Gras = Ziel, Schlamm = Fehler) umgeben das offene Zentrum.
 * - Level 1: Gras an allen 4 Seiten (kein Schlamm).
 * - Level 2–7: Grasfläche schrumpft streng monoton bis zu einem schmalen Zielfeld,
 *   während Schlamm streng monoton wächst.
 */

export const SIDE_CAT_SIZE = 10;
export const SIDE_CAT_RADIUS = 4;
export const SIDE_BORDER_THICKNESS = 10;
export const SIDE_START_POS: Vec2 = { x: 50, y: 50 };

export interface SideLevelLayout {
  level: number;
  grass: readonly Rect[];
  mud: readonly Rect[];
  start: Vec2;
}

const B = SIDE_BORDER_THICKNESS;
const EDGE_TOP: Rect = { x: 0, y: 0, width: 100, height: B };
const EDGE_BOTTOM: Rect = { x: 0, y: 100 - B, width: 100, height: B };
const EDGE_LEFT: Rect = { x: 0, y: B, width: B, height: 100 - 2 * B };
const EDGE_RIGHT: Rect = { x: 100 - B, y: B, width: B, height: 100 - 2 * B };

export const SIDE_LEVELS: Record<number, SideLevelLayout> = {
  // Level 1: Gras auf allen 4 Seiten (Fläche 3600), kein Schlamm (0)
  1: {
    level: 1,
    grass: [EDGE_TOP, EDGE_BOTTOM, EDGE_LEFT, EDGE_RIGHT],
    mud: [],
    start: SIDE_START_POS,
  },
  // Level 2: Gras auf 3 Seiten (2600), Schlamm unten (1000)
  2: {
    level: 2,
    grass: [EDGE_TOP, EDGE_LEFT, EDGE_RIGHT],
    mud: [EDGE_BOTTOM],
    start: SIDE_START_POS,
  },
  // Level 3: Gras auf 2 Seiten (1800), Schlamm auf 2 Seiten (1800)
  3: {
    level: 3,
    grass: [EDGE_TOP, EDGE_RIGHT],
    mud: [EDGE_BOTTOM, EDGE_LEFT],
    start: SIDE_START_POS,
  },
  // Level 4: Gras auf 1 ganzen Seite unten (1000), Schlamm auf 3 Seiten (2600)
  4: {
    level: 4,
    grass: [EDGE_BOTTOM],
    mud: [EDGE_TOP, EDGE_LEFT, EDGE_RIGHT],
    start: SIDE_START_POS,
  },
  // Level 5: 60 % Gras links (600), Rest Schlamm (3000)
  5: {
    level: 5,
    grass: [{ x: 0, y: 20, width: B, height: 60 }],
    mud: [
      EDGE_TOP,
      EDGE_BOTTOM,
      EDGE_RIGHT,
      { x: 0, y: B, width: B, height: 20 - B },
      { x: 0, y: 80, width: B, height: 90 - 80 },
    ],
    start: SIDE_START_POS,
  },
  // Level 6: 40 % Gras rechts (400), Rest Schlamm (3200)
  6: {
    level: 6,
    grass: [{ x: 100 - B, y: 30, width: B, height: 40 }],
    mud: [
      EDGE_TOP,
      EDGE_BOTTOM,
      EDGE_LEFT,
      { x: 100 - B, y: B, width: B, height: 30 - B },
      { x: 100 - B, y: 70, width: B, height: 90 - 70 },
    ],
    start: SIDE_START_POS,
  },
  // Level 7: 20 % Gras oben mittig (200), Rest Schlamm (3400)
  7: {
    level: 7,
    grass: [{ x: 40, y: 0, width: 20, height: B }],
    mud: [
      EDGE_BOTTOM,
      EDGE_LEFT,
      EDGE_RIGHT,
      { x: 0, y: 0, width: 40, height: B },
      { x: 60, y: 0, width: 40, height: B },
    ],
    start: SIDE_START_POS,
  },
};

export function getSideLayout(level: number): SideLevelLayout {
  const clamped = Math.min(Math.max(Math.floor(level), 1), 7);
  return SIDE_LEVELS[clamped] ?? SIDE_LEVELS[1]!;
}

export function getStartPosition(level: number): Vec2 {
  return { ...getSideLayout(level).start };
}

/** Prüft, ob eine Position sicher (ohne Gras- oder Schlamm-Kontakt) liegt. */
export function isSafeSidePosition(pos: Vec2, level: number, radius = SIDE_CAT_RADIUS): boolean {
  const layout = getSideLayout(level);
  return (
    !layout.grass.some((r) => circleRectOverlap(pos, radius, r)) &&
    !layout.mud.some((r) => circleRectOverlap(pos, radius, r))
  );
}
