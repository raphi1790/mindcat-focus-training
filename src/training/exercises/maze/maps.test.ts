import { describe, expect, it } from 'vitest';
import { GRID_SIZE, LEVEL_MAPS, getStartPosition } from './maps';

function isSolvable(map: number[][]): boolean {
  let start: [number, number] | null = null;
  let target: [number, number] | null = null;
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < (map[y]?.length ?? 0); x++) {
      if (map[y]?.[x] === 3) start = [x, y];
      if (map[y]?.[x] === 2) target = [x, y];
    }
  }
  if (!start || !target) return false;

  const seen = new Set<string>([`${start[0]},${start[1]}`]);
  const queue: [number, number][] = [start];
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    if (x === target[0] && y === target[1]) return true;
    const dirs: [number, number][] = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (ny < 0 || ny >= map.length || nx < 0 || nx >= (map[ny]?.length ?? 0)) continue;
      if (map[ny]?.[nx] === 1) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return false;
}

describe('Maze — Level-Karten', () => {
  it('hat genau 6 Level (a=6), alle GRID_SIZE × GRID_SIZE groß', () => {
    const levels = Object.keys(LEVEL_MAPS).map(Number);
    expect(levels).toEqual([1, 2, 3, 4, 5, 6]);
    for (const level of levels) {
      const map = LEVEL_MAPS[level]!;
      expect(map).toHaveLength(GRID_SIZE);
      for (const row of map) expect(row).toHaveLength(GRID_SIZE);
    }
  });

  it('jedes Level hat genau ein Start- und ein Ziel-Tile', () => {
    for (const [level, map] of Object.entries(LEVEL_MAPS)) {
      const flat = map.flat();
      expect(flat.filter((v) => v === 3), `Level ${level}`).toHaveLength(1);
      expect(flat.filter((v) => v === 2), `Level ${level}`).toHaveLength(1);
    }
  });

  it('jedes Level ist vom Start zum Ziel lösbar', () => {
    for (const [level, map] of Object.entries(LEVEL_MAPS)) {
      expect(isSolvable(map), `Level ${level} sollte lösbar sein`).toBe(true);
    }
  });

  it('getStartPosition findet das Start-Tile jedes Levels', () => {
    for (const [level, map] of Object.entries(LEVEL_MAPS)) {
      const pos = getStartPosition(Number(level));
      expect(map[pos.y]?.[pos.x]).toBe(3);
    }
  });

  it('Level 1–3 haben durchgehend mindestens 2 Felder breite Korridore (AP3)', () => {
    const isWalkable = (map: number[][], x: number, y: number) => {
      if (y < 0 || y >= map.length || x < 0 || x >= (map[y]?.length ?? 0)) return false;
      return map[y]![x] !== 1;
    };

    const has2TileCorridors = (map: number[][]) => {
      for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < (map[y]?.length ?? 0); x++) {
          if (!isWalkable(map, x, y)) continue;
          const hasHorizontal = isWalkable(map, x - 1, y) || isWalkable(map, x + 1, y);
          const hasVertical = isWalkable(map, x, y - 1) || isWalkable(map, x, y + 1);
          if (!hasHorizontal || !hasVertical) return false;
        }
      }
      return true;
    };

    expect(has2TileCorridors(LEVEL_MAPS[1]!), 'Level 1 hat 2-Feld-breite Korridore').toBe(true);
    expect(has2TileCorridors(LEVEL_MAPS[2]!), 'Level 2 hat 2-Feld-breite Korridore').toBe(true);
    expect(has2TileCorridors(LEVEL_MAPS[3]!), 'Level 3 hat 2-Feld-breite Korridore').toBe(true);

    // Höhere Level (4–6) besitzen schmalere 1-Feld-Korridore
    expect(has2TileCorridors(LEVEL_MAPS[4]!)).toBe(false);
  });
});
