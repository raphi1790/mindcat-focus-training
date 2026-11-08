import { describe, expect, it } from 'vitest';
import { GOAL_POS, LEVEL_MAPS, START_POS, getGridSizeForLevel, getStartPosition } from './maps';

function isSolvableFromStartToGoal(
  map: number[][],
  start: { x: number; y: number },
  goal: { x: number; y: number },
): boolean {
  const size = map.length;
  if (start.y < 0 || start.y >= size || start.x < 0 || start.x >= (map[start.y]?.length ?? 0)) return false;
  if (goal.y < 0 || goal.y >= size || goal.x < 0 || goal.x >= (map[goal.y]?.length ?? 0)) return false;
  if (map[start.y]?.[start.x] === 1 || map[goal.y]?.[goal.x] === 1) return false;

  const seen = new Set<string>([`${start.x},${start.y}`]);
  const queue: [number, number][] = [[start.x, start.y]];
  const dirs: [number, number][] = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    if (x === goal.x && y === goal.y) return true;
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (ny < 0 || ny >= size || nx < 0 || nx >= (map[ny]?.length ?? 0)) continue;
      if (map[ny]?.[nx] === 1) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return false;
}

describe('Maze — Level-Karten (progressives Raster nach Rueda et al., 2005)', () => {
  const EXPECTED_SIZES: Record<number, number> = {
    1: 7,
    2: 7,
    3: 9,
    4: 9,
    5: 11,
    6: 11,
  };

  it('hat genau 6 Level (a=6) mit progressiv wachsenden quadratischen Rastern (7×7, 9×9, 11×11)', () => {
    const levels = Object.keys(LEVEL_MAPS).map(Number);
    expect(levels).toEqual([1, 2, 3, 4, 5, 6]);

    for (const level of levels) {
      const expectedSize = EXPECTED_SIZES[level]!;
      const map = LEVEL_MAPS[level]!;
      expect(getGridSizeForLevel(level), `Level ${level} gridSize`).toBe(expectedSize);
      expect(map, `Level ${level} rows`).toHaveLength(expectedSize);
      for (const row of map) {
        expect(row, `Level ${level} cols`).toHaveLength(expectedSize);
      }
    }
  });

  it('besitzt in jedem Level einen geschlossenen Außenrand aus Wänden (1)', () => {
    for (const [levelStr, map] of Object.entries(LEVEL_MAPS)) {
      const size = map.length;
      for (let i = 0; i < size; i++) {
        expect(map[0]![i], `Level ${levelStr} top (${i},0)`).toBe(1);
        expect(map[size - 1]![i], `Level ${levelStr} bottom (${i},${size - 1})`).toBe(1);
        expect(map[i]![0], `Level ${levelStr} left (0,${i})`).toBe(1);
        expect(map[i]![size - 1], `Level ${levelStr} right (${size - 1},${i})`).toBe(1);
      }
    }
  });

  it('jedes Level hat genau ein Start-Tile (START_POS) und ein Ziel-Tile (GOAL_POS) innerhalb des Rasters', () => {
    for (const [levelStr, map] of Object.entries(LEVEL_MAPS)) {
      const level = Number(levelStr);
      const size = map.length;
      const goal = GOAL_POS[level]!;
      const flat = map.flat();

      expect(flat.filter((v) => v === 3), `Level ${level} Start-Tiles`).toHaveLength(1);
      expect(flat.filter((v) => v === 2), `Level ${level} Ziel-Tiles`).toHaveLength(1);

      expect(map[START_POS.y]?.[START_POS.x], `Level ${level} START_POS`).toBe(3);
      expect(getStartPosition(level), `Level ${level} getStartPosition`).toEqual(START_POS);

      expect(goal.x).toBeGreaterThanOrEqual(1);
      expect(goal.x).toBeLessThanOrEqual(size - 2);
      expect(goal.y).toBeGreaterThanOrEqual(1);
      expect(goal.y).toBeLessThanOrEqual(size - 2);
      expect(map[goal.y]?.[goal.x], `Level ${level} GOAL_POS`).toBe(2);
    }
  });

  it('jedes Level ist per BFS von START_POS zu GOAL_POS[level] über freie Pfad-Felder (0) erreichbar', () => {
    for (const [levelStr, map] of Object.entries(LEVEL_MAPS)) {
      const level = Number(levelStr);
      const goal = GOAL_POS[level]!;
      expect(isSolvableFromStartToGoal(map, START_POS, goal), `Level ${level} sollte lösbar sein`).toBe(true);
    }
  });
});
