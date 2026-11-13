/**
 * Maze-Übung: Katze durch ein Labyrinth zum Futter/Gras führen.
 * 0 = Pfad, 1 = Wand (blockiert nur die Bewegung — kein Fehler, kein Reset;
 * vgl. AP4/Befund E), 2 = Ziel, 3 = Start.
 * 6 Level (Plan §6.2: a=6, b=6, c=1) mit progressiv wachsendem Raster:
 * - Level 1–2: 7×7 (große, sehr übersichtliche Kacheln zum Einstieg)
 * - Level 3–4: 9×9 (mittlere Kachelgröße, mehr Kurven und Sackgassen)
 * - Level 5–6: 11×11 (komplexere Labyrinthe mit Verzweigungen)
 */
export const START_POS = { x: 1, y: 1 } as const;

export const GOAL_POS: Record<number, { x: number; y: number }> = {
  1: { x: 5, y: 5 },
  2: { x: 5, y: 5 },
  3: { x: 7, y: 7 },
  4: { x: 4, y: 7 },
  5: { x: 7, y: 9 },
  6: { x: 5, y: 9 },
};

export const LEVEL_MAPS: Record<number, number[][]> = {
  1: [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 3, 0, 0, 1, 1, 1],
    [1, 1, 1, 0, 1, 1, 1],
    [1, 1, 1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 0, 1],
    [1, 1, 1, 1, 1, 2, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ],
  2: [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 3, 0, 0, 0, 0, 1],
    [1, 1, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 1, 1],
    [1, 0, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 2, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ],
  3: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 3, 0, 0, 0, 1, 0, 0, 1],
    [1, 1, 1, 1, 0, 1, 0, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 1, 1],
    [1, 0, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 1, 1],
    [1, 1, 1, 0, 1, 1, 0, 1, 1],
    [1, 0, 0, 0, 1, 1, 0, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  4: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 3, 1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 1, 1, 0, 1, 0, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 1, 1, 0, 1],
    [1, 0, 0, 1, 2, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  5: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 3, 0, 0, 1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 1, 2, 1, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  6: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 3, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 1, 2, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
};

import type { Rect, Vec2 } from '../../shared/arenaMath';

export interface MazeArenaLayout {
  gridSize: number;
  tileSize: number;
  walls: Rect[];
  startPos: Vec2;
  goalPos: Vec2;
  catSize: number;
  catRadius: number;
  goalRadius: number;
}

export function getGridSizeForLevel(level: number): number {
  return LEVEL_MAPS[level]?.length ?? LEVEL_MAPS[1]!.length;
}

export function getStartPosition(level: number): { x: number; y: number } {
  const map = LEVEL_MAPS[level];
  if (map) {
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < (map[y]?.length ?? 0); x++) {
        if (map[y]?.[x] === 3) return { x, y };
      }
    }
  }
  return { ...START_POS };
}

/**
 * Konvertiert die Raster-Karte eines Levels in Prozent-Koordinaten (`0..100`)
 * für `ArenaWorld` + `slideMoveWithObstacles`. Zusammenhängende horizontale
 * Wand-Kacheln werden je Zeile zu einem Rechteck zusammengefasst.
 */
export function getMazeArenaLayout(level: number): MazeArenaLayout {
  const map = LEVEL_MAPS[level] ?? LEVEL_MAPS[1]!;
  const gridSize = map.length;
  const tileSize = 100 / gridSize;
  const walls: Rect[] = [];

  for (let y = 0; y < gridSize; y++) {
    const row = map[y] ?? [];
    let runStart = -1;
    for (let x = 0; x <= gridSize; x++) {
      const isWall = x < gridSize && row[x] === 1;
      if (isWall && runStart === -1) {
        runStart = x;
      } else if (!isWall && runStart !== -1) {
        walls.push({
          x: runStart * tileSize,
          y: y * tileSize,
          width: (x - runStart) * tileSize,
          height: tileSize,
        });
        runStart = -1;
      }
    }
  }

  const start = getStartPosition(level);
  const goal = GOAL_POS[level] ?? GOAL_POS[1]!;
  const catSize = tileSize * 0.72;

  return {
    gridSize,
    tileSize,
    walls,
    startPos: { x: (start.x + 0.5) * tileSize, y: (start.y + 0.5) * tileSize },
    goalPos: { x: (goal.x + 0.5) * tileSize, y: (goal.y + 0.5) * tileSize },
    catSize,
    catRadius: catSize / 2,
    goalRadius: tileSize * 0.34,
  };
}
