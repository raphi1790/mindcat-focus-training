import { describe, expect, it } from 'vitest';
import { circleRectOverlap, type Rect } from '../../shared/arenaMath';
import {
  SIDE_BORDER_THICKNESS,
  SIDE_CAT_RADIUS,
  SIDE_LEVELS,
  getSideLayout,
  getStartPosition,
  isSafeSidePosition,
} from './maps';

const LEVELS = Object.keys(SIDE_LEVELS).map(Number).sort((a, b) => a - b);

function rectArea(r: Rect): number {
  return r.width * r.height;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

describe('Side — Level-Layouts (Rueda 2005, kontinuierliche Arena)', () => {
  it('hat genau 7 Level (1..7) mit gültiger Geometrie im Bereich 0..100', () => {
    expect(LEVELS).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const level of LEVELS) {
      const layout = getSideLayout(level);
      expect(layout.grass.length).toBeGreaterThan(0);
      for (const r of [...layout.grass, ...layout.mud]) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.width).toBeGreaterThan(0);
        expect(r.height).toBeGreaterThan(0);
        expect(r.x + r.width).toBeLessThanOrEqual(100);
        expect(r.y + r.height).toBeLessThanOrEqual(100);
      }
    }
  });

  it('Level 1 hat Gras an allen 4 Seiten und keinen Schlamm', () => {
    const level1 = getSideLayout(1);
    expect(level1.grass).toHaveLength(4);
    expect(level1.mud).toHaveLength(0);
  });

  it('Grasfläche schrumpft streng monoton über Level 1..7 während Schlamm wächst', () => {
    let prevGrass = Infinity;
    let prevMud = -1;
    const expectedBorderArea = 100 * 100 - (100 - 2 * SIDE_BORDER_THICKNESS) ** 2;

    for (const level of LEVELS) {
      const { grass, mud } = getSideLayout(level);
      const grassArea = grass.reduce((acc, r) => acc + rectArea(r), 0);
      const mudArea = mud.reduce((acc, r) => acc + rectArea(r), 0);

      expect(grassArea).toBeLessThan(prevGrass);
      expect(mudArea).toBeGreaterThan(prevMud);
      expect(grassArea + mudArea).toBe(expectedBorderArea);

      prevGrass = grassArea;
      prevMud = mudArea;
    }
  });

  it('Gras- und Schlammstreifen überlappen einander nicht und lassen das Zentrum frei', () => {
    const centerBox: Rect = {
      x: SIDE_BORDER_THICKNESS,
      y: SIDE_BORDER_THICKNESS,
      width: 100 - 2 * SIDE_BORDER_THICKNESS,
      height: 100 - 2 * SIDE_BORDER_THICKNESS,
    };

    for (const level of LEVELS) {
      const { grass, mud } = getSideLayout(level);
      for (const g of grass) {
        expect(rectsOverlap(g, centerBox)).toBe(false);
        for (const m of mud) expect(rectsOverlap(g, m)).toBe(false);
      }
      for (const m of mud) {
        expect(rectsOverlap(m, centerBox)).toBe(false);
      }
    }
  });

  it('Startposition ist in allen Leveln sicher (auch bei Checkpoint-Resume)', () => {
    for (const level of LEVELS) {
      const start = getStartPosition(level);
      expect(isSafeSidePosition(start, level)).toBe(true);
    }
  });

  it('mindestens ein Grasfeld ist vom Start aus auf direktem geradem Weg ohne Schlamm erreichbar', () => {
    for (const level of LEVELS) {
      const { grass, mud, start } = getSideLayout(level);
      const reachable = grass.some((target) => {
        const tx = target.x + target.width / 2;
        const ty = target.y + target.height / 2;
        const steps = 40;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const pos = { x: start.x + (tx - start.x) * t, y: start.y + (ty - start.y) * t };
          if (circleRectOverlap(pos, SIDE_CAT_RADIUS, target)) return true;
          if (mud.some((m) => circleRectOverlap(pos, SIDE_CAT_RADIUS, m))) return false;
        }
        return false;
      });
      expect(reachable, `Level ${level}: direkter Pfad zum Gras erwartet`).toBe(true);
    }
  });
});
