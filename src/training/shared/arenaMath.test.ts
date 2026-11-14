import { describe, expect, it } from 'vitest';
import {
  circleRectOverlap,
  circlesOverlap,
  clampPos,
  slideMoveWithObstacles,
  type Rect,
} from './arenaMath';

describe('clampPos', () => {
  it('begrenzt mit skalaren min/max-Werten', () => {
    expect(clampPos({ x: -10, y: 120 }, 5, 95)).toEqual({ x: 5, y: 95 });
    expect(clampPos({ x: 50, y: 40 }, 5, 95)).toEqual({ x: 50, y: 40 });
  });

  it('begrenzt mit achsenspezifischen Vec2-Grenzen', () => {
    expect(clampPos({ x: 0, y: 100 }, { x: 10, y: 20 }, { x: 80, y: 90 })).toEqual({
      x: 10,
      y: 90,
    });
  });
});

describe('circlesOverlap', () => {
  it('erkennt Überlappung und schließt reine Berührung (Tangente) aus', () => {
    expect(circlesOverlap({ x: 50, y: 50 }, 5, { x: 58, y: 50 }, 5)).toBe(true);
    expect(circlesOverlap({ x: 50, y: 50 }, 5, { x: 60, y: 50 }, 5)).toBe(false);
    expect(circlesOverlap({ x: 50, y: 50 }, 5, { x: 57, y: 57 }, 5)).toBe(true); // hypot(7,7)=9.899 < 10
    expect(circlesOverlap({ x: 50, y: 50 }, 5, { x: 58, y: 58 }, 5)).toBe(false); // hypot(8,8)=11.31 > 10
  });
});

describe('circleRectOverlap', () => {
  const rect: Rect = { x: 20, y: 30, width: 40, height: 20 };

  it('erkennt Mittelpunkt im Inneren und Kanten-/Ecken-Überlappung', () => {
    expect(circleRectOverlap({ x: 40, y: 40 }, 5, rect)).toBe(true);
    expect(circleRectOverlap({ x: 16, y: 40 }, 5, rect)).toBe(true);
    expect(circleRectOverlap({ x: 17, y: 27 }, 5, rect)).toBe(true); // Ecke (20,30), dist=hypot(3,3)=4.24 < 5
  });

  it('liefert false außerhalb oder bei reiner Kantenberührung', () => {
    expect(circleRectOverlap({ x: 15, y: 40 }, 5, rect)).toBe(false); // genau Abstand 5
    expect(circleRectOverlap({ x: 10, y: 10 }, 5, rect)).toBe(false);
    expect(circleRectOverlap({ x: 16, y: 26 }, 5, rect)).toBe(false); // Ecke (20,30), dist=hypot(4,4)=5.66 >= 5
  });
});

describe('slideMoveWithObstacles', () => {
  const wall: Rect = { x: 40, y: 0, width: 20, height: 60 };

  it('hält die Figur innerhalb der Arena-Grenzen', () => {
    const next = slideMoveWithObstacles({ x: 6, y: 6 }, { x: -20, y: -20 }, 5, []);
    expect(next).toEqual({ x: 5, y: 5 });
  });

  it('gleitet bei diagonaler Wand-Kollision sauber entlang der freien Achse', () => {
    const next = slideMoveWithObstacles({ x: 35, y: 20 }, { x: 2, y: 3 }, 5, [wall]);
    expect(next.x).toBeCloseTo(35, 5);
    expect(next.y).toBeCloseTo(23, 5);
  });

  it('erzeugt keinen Quer-Drift an Nähten zwischen gestapelten Wand-Rechtecken', () => {
    const topWall: Rect = { x: 40, y: 0, width: 20, height: 30 };
    const bottomWall: Rect = { x: 40, y: 30, width: 20, height: 30 };
    const next = slideMoveWithObstacles({ x: 35, y: 29.5 }, { x: 2, y: 0 }, 5, [
      bottomWall,
      topWall,
    ]);
    expect(next.x).toBeCloseTo(35, 5);
    expect(next.y).toBeCloseTo(29.5, 5);
  });

  it('nudged an einer Korridor-Ecke vorbei (Corner-Assist)', () => {
    // Wand endet bei y=60; Katze (r=5) steht knapp unterhalb der Ecke auf y=63
    // und drückt rein nach rechts → muss leicht nach unten in den Korridor abgleiten.
    const next = slideMoveWithObstacles({ x: 35, y: 63 }, { x: 2, y: 0 }, 5, [wall]);
    expect(next.x).toBeGreaterThan(35);
    expect(next.y).toBeGreaterThan(63);
    expect(circleRectOverlap(next, 5, wall)).toBe(false);
  });

  it('tunnelt auch bei großem Delta nicht durch eine dünne Wand', () => {
    const thinWall: Rect = { x: 48, y: 0, width: 4, height: 100 };
    const next = slideMoveWithObstacles({ x: 40, y: 50 }, { x: 30, y: 0 }, 4, [thinWall]);
    expect(next.x).toBeLessThanOrEqual(44 + 1e-6);
    expect(circleRectOverlap(next, 4, thinWall)).toBe(false);
  });
});
