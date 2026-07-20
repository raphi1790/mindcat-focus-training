import { describe, expect, it } from 'vitest';
import { GRID_SIZE, LEVEL_MAPS, getStartPosition } from './maps';

describe('Side — Level-Karten', () => {
  it('hat genau 7 Level, alle GRID_SIZE × GRID_SIZE groß', () => {
    const levels = Object.keys(LEVEL_MAPS).map(Number);
    expect(levels).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const level of levels) {
      const map = LEVEL_MAPS[level]!;
      expect(map).toHaveLength(GRID_SIZE);
      for (const row of map) expect(row).toHaveLength(GRID_SIZE);
    }
  });

  it('jedes Level hat genau ein Start-Tile (3) und mindestens ein Ziel-Tile (2)', () => {
    for (const [level, map] of Object.entries(LEVEL_MAPS)) {
      const flat = map.flat();
      const starts = flat.filter((v) => v === 3).length;
      const targets = flat.filter((v) => v === 2).length;
      expect(starts, `Level ${level}: genau 1 Start-Tile erwartet`).toBe(1);
      expect(targets, `Level ${level}: mindestens 1 Ziel-Tile erwartet`).toBeGreaterThan(0);
    }
  });

  it('getStartPosition findet das Start-Tile jedes Levels', () => {
    for (const [level, map] of Object.entries(LEVEL_MAPS)) {
      const pos = getStartPosition(Number(level));
      expect(map[pos.y]?.[pos.x]).toBe(3);
    }
  });
});
