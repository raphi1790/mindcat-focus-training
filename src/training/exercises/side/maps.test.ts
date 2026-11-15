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
      for (const r of [...layout.grass, ...layout.mud, ...layout.puddles]) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.width).toBeGreaterThan(0);
        expect(r.height).toBeGreaterThan(0);
        expect(r.x + r.width).toBeLessThanOrEqual(100);
        expect(r.y + r.height).toBeLessThanOrEqual(100);
      }
    }
  });

  it('Level 1–2 haben einen freien Innenbereich (keine Pfützen), Level 1 hat keinen Schlamm', () => {
    const level1 = getSideLayout(1);
    const level2 = getSideLayout(2);
    expect(level1.grass).toHaveLength(4);
    expect(level1.mud).toHaveLength(0);
    expect(level1.puddles).toHaveLength(0);
    expect(level2.puddles).toHaveLength(0);
  });

  it('Grasfläche schrumpft streng monoton über Level 1..7 während Rand-Schlamm wächst', () => {
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

  it('Randstreifen lassen Zentrum frei; innere Pfützen liegen im Innenfeld und wachsen über Level 3..7', () => {
    const centerBox: Rect = {
      x: SIDE_BORDER_THICKNESS,
      y: SIDE_BORDER_THICKNESS,
      width: 100 - 2 * SIDE_BORDER_THICKNESS,
      height: 100 - 2 * SIDE_BORDER_THICKNESS,
    };

    let prevPuddleArea = 0;
    for (const level of LEVELS) {
      const { grass, mud, puddles } = getSideLayout(level);
      for (const g of grass) {
        expect(rectsOverlap(g, centerBox)).toBe(false);
        for (const m of mud) expect(rectsOverlap(g, m)).toBe(false);
        for (const p of puddles) expect(rectsOverlap(g, p)).toBe(false);
      }
      for (const m of mud) {
        expect(rectsOverlap(m, centerBox)).toBe(false);
        for (const p of puddles) expect(rectsOverlap(m, p)).toBe(false);
      }
      for (let i = 0; i < puddles.length; i++) {
        const p = puddles[i]!;
        expect(p.x).toBeGreaterThanOrEqual(centerBox.x);
        expect(p.y).toBeGreaterThanOrEqual(centerBox.y);
        expect(p.x + p.width).toBeLessThanOrEqual(centerBox.x + centerBox.width);
        expect(p.y + p.height).toBeLessThanOrEqual(centerBox.y + centerBox.height);
        for (let j = i + 1; j < puddles.length; j++) {
          expect(rectsOverlap(p, puddles[j]!)).toBe(false);
        }
      }
      if (level >= 3) {
        const puddleArea = puddles.reduce((acc, r) => acc + rectArea(r), 0);
        expect(puddleArea).toBeGreaterThan(prevPuddleArea);
        prevPuddleArea = puddleArea;
      }
    }
  });

  it('Startposition ist in allen Leveln mit Sicherheitsabstand sicher (auch bei Checkpoint-Resume)', () => {
    for (const level of LEVELS) {
      const start = getStartPosition(level);
      expect(isSafeSidePosition(start, level, SIDE_CAT_RADIUS + 4)).toBe(true);
    }
  });

  it('Level 1–2 erlauben direkten Weg; ab Level 3 blockieren Pfützen den direkten Weg zum Gras', () => {
    const hitsDirectPath = (level: number, target: Rect): boolean => {
      const { mud, puddles, start } = getSideLayout(level);
      const tx = Math.max(target.x, Math.min(start.x, target.x + target.width));
      const ty = Math.max(target.y, Math.min(start.y, target.y + target.height));
      const steps = 60;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const pos = { x: start.x + (tx - start.x) * t, y: start.y + (ty - start.y) * t };
        if (circleRectOverlap(pos, SIDE_CAT_RADIUS, target)) return false;
        if ([...mud, ...puddles].some((m) => circleRectOverlap(pos, SIDE_CAT_RADIUS, m))) return true;
      }
      return false;
    };

    for (const level of [1, 2]) {
      const { grass } = getSideLayout(level);
      expect(grass.some((g) => !hitsDirectPath(level, g))).toBe(true);
    }

    for (const level of [3, 4, 5, 6, 7]) {
      const { grass } = getSideLayout(level);
      expect(
        grass.every((g) => hitsDirectPath(level, g)),
        `Level ${level}: direkter Weg zum Gras soll durch Schlammpfütze blockiert sein`,
      ).toBe(true);
    }
  });

  it('in allen Leveln existiert ein passierbarer Umweg mit Korridorbreite >= 2.5 * CAT_RADIUS', () => {
    const safeRadius = SIDE_CAT_RADIUS + 1; // Durchmesser 10 = 2.5 * SIDE_CAT_RADIUS
    for (const level of LEVELS) {
      const { grass, mud, puddles, start } = getSideLayout(level);
      const hazards = [...mud, ...puddles];
      const visited = new Set<string>();
      const queue: Array<{ x: number; y: number }> = [{ x: Math.round(start.x), y: Math.round(start.y) }];
      visited.add(`${Math.round(start.x)},${Math.round(start.y)}`);
      let reachedGrass = false;

      while (queue.length > 0) {
        const cur = queue.shift()!;
        if (grass.some((g) => circleRectOverlap(cur, SIDE_CAT_RADIUS, g))) {
          reachedGrass = true;
          break;
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cur.x + dx;
          const ny = cur.y + dy;
          if (nx < SIDE_CAT_RADIUS || nx > 100 - SIDE_CAT_RADIUS) continue;
          if (ny < SIDE_CAT_RADIUS || ny > 100 - SIDE_CAT_RADIUS) continue;
          const key = `${nx},${ny}`;
          if (visited.has(key)) continue;
          if (hazards.some((h) => circleRectOverlap({ x: nx, y: ny }, safeRadius, h))) continue;
          visited.add(key);
          queue.push({ x: nx, y: ny });
        }
      }

      expect(reachedGrass, `Level ${level}: Umweg zum Gras muss passierbar sein`).toBe(true);
    }
  });
});
