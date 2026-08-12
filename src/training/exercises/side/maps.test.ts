import { describe, expect, it } from 'vitest';
import { GRID_SIZE, LEVEL_MAPS, getStartPosition } from './maps';

const LEVELS = Object.keys(LEVEL_MAPS).map(Number).sort((a, b) => a - b);

function findCells(map: number[][], value: number): [number, number][] {
  const cells: [number, number][] = [];
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < (map[y]?.length ?? 0); x++) {
      if (map[y]?.[x] === value) cells.push([x, y]);
    }
  }
  return cells;
}

const DIRS8: [number, number][] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

/** BFS über alle nicht-Schlamm-Tiles (8-Wege, wie die Bewegung im Spiel). Optional ein Tile ausklammern. */
function reachesGrass(map: number[][], start: [number, number], blocked?: [number, number]): boolean {
  const key = (x: number, y: number) => `${x},${y}`;
  const blockedKey = blocked ? key(...blocked) : null;
  const seen = new Set([key(...start)]);
  const queue: [number, number][] = [start];
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    if (map[y]?.[x] === 2) return true;
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx;
      const ny = y + dy;
      if (ny < 0 || ny >= map.length || nx < 0 || nx >= (map[ny]?.length ?? 0)) continue;
      if (map[ny]?.[nx] === 1) continue;
      const k = key(nx, ny);
      if (k === blockedKey) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return false;
}

/**
 * Menger-Proxy für "≥ 2 disjunkte Pfade": wenn das Entfernen jedes einzelnen
 * sicheren Pfad-Tiles (0) die Start→Gras-Erreichbarkeit nicht zerstört, gibt
 * es keinen einzelnen Flaschenhals — also kein Ein-Weg-Labyrinth (Befund B).
 */
function hasNoSinglePointBottleneck(map: number[][]): boolean {
  const start = findCells(map, 3)[0];
  if (!start) return false;
  if (!reachesGrass(map, start)) return false;
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < (map[y]?.length ?? 0); x++) {
      if (map[y]?.[x] !== 0) continue; // nur reine Pfad-Tiles sind Kandidaten
      if (!reachesGrass(map, start, [x, y])) return false;
    }
  }
  return true;
}

function countTiles(map: number[][]) {
  let mud = 0;
  let grass = 0;
  let safe = 0;
  for (const row of map) {
    for (const v of row) {
      if (v === 1) mud++;
      else {
        safe++;
        if (v === 2) grass++;
      }
    }
  }
  return { mud, grass, safe };
}

describe('Side — Level-Karten (AP5: wachsender Schlamm statt Labyrinth)', () => {
  it('hat genau 7 Level, alle GRID_SIZE × GRID_SIZE groß', () => {
    expect(LEVELS).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const level of LEVELS) {
      const map = LEVEL_MAPS[level]!;
      expect(map).toHaveLength(GRID_SIZE);
      for (const row of map) expect(row).toHaveLength(GRID_SIZE);
    }
  });

  it('jedes Level hat genau ein Start-Tile (3) und mindestens ein Ziel-Tile (2)', () => {
    for (const level of LEVELS) {
      const map = LEVEL_MAPS[level]!;
      const flat = map.flat();
      expect(flat.filter((v) => v === 3), `Level ${level}: genau 1 Start-Tile erwartet`).toHaveLength(1);
      expect(flat.filter((v) => v === 2).length, `Level ${level}: mindestens 1 Ziel-Tile erwartet`).toBeGreaterThan(0);
    }
  });

  it('getStartPosition findet das Start-Tile jedes Levels', () => {
    for (const level of LEVELS) {
      const pos = getStartPosition(level);
      expect(LEVEL_MAPS[level]![pos.y]?.[pos.x]).toBe(3);
    }
  });

  it('vom Start existiert ein Pfad zum Gras über sichere Tiles, in jedem Level', () => {
    for (const level of LEVELS) {
      const map = LEVEL_MAPS[level]!;
      const start = findCells(map, 3)[0]!;
      expect(reachesGrass(map, start), `Level ${level} sollte lösbar sein`).toBe(true);
    }
  });

  it('kein Level entartet zum Ein-Weg-Labyrinth (mindestens 2 disjunkte Pfade zum Gras)', () => {
    for (const level of LEVELS) {
      const map = LEVEL_MAPS[level]!;
      expect(
        hasNoSinglePointBottleneck(map),
        `Level ${level}: ein einzelnes Pfad-Tile darf Start und Gras nicht trennen können`,
      ).toBe(true);
    }
  });

  it('Schlamm-Tile-Anzahl wächst streng monoton über die Level', () => {
    let prevMud = -1;
    for (const level of LEVELS) {
      const { mud } = countTiles(LEVEL_MAPS[level]!);
      expect(mud, `Level ${level}: Schlamm sollte mehr sein als in Level ${level - 1}`).toBeGreaterThan(prevMud);
      prevMud = mud;
    }
  });

  it('Gras-Tile-Anzahl fällt streng monoton über die Level', () => {
    let prevGrass = Infinity;
    for (const level of LEVELS) {
      const { grass } = countTiles(LEVEL_MAPS[level]!);
      expect(grass, `Level ${level}: Gras sollte weniger sein als in Level ${level - 1}`).toBeLessThan(prevGrass);
      prevGrass = grass;
    }
  });

  it('Freiraum-Quote (sicher begehbare Tiles) liegt bei Level 2 bei ≥ 40 % und bei Level 7 bei ≥ 20 %', () => {
    const totalTiles = GRID_SIZE * GRID_SIZE;
    const level2 = countTiles(LEVEL_MAPS[2]!);
    const level7 = countTiles(LEVEL_MAPS[7]!);
    expect(level2.safe / totalTiles).toBeGreaterThanOrEqual(0.4);
    expect(level7.safe / totalTiles).toBeGreaterThanOrEqual(0.2);
  });
});
