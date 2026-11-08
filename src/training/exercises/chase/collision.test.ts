import { describe, expect, it } from 'vitest';
import { createRng } from '../../../platform/rng';
import {
  checkChaseCollision,
  fleeProbabilityForLevel,
  stepUmbrella,
  type Pos,
} from './collision';

describe('checkChaseCollision (Continuous Collision Detection)', () => {
  it('erkennt direkten Treffer wenn Katze auf Schirm zieht', () => {
    const catPrev: Pos = { x: 3, y: 4 };
    const catNext: Pos = { x: 4, y: 4 };
    const targetPrev: Pos = { x: 4, y: 4 };
    const targetNext: Pos = { x: 4, y: 4 };

    expect(checkChaseCollision(catPrev, catNext, targetPrev, targetNext)).toBe(true);
  });

  it('erkennt direkten Treffer wenn Schirm auf Katze zieht', () => {
    const catPrev: Pos = { x: 4, y: 4 };
    const catNext: Pos = { x: 4, y: 4 };
    const targetPrev: Pos = { x: 4, y: 5 };
    const targetNext: Pos = { x: 4, y: 4 };

    expect(checkChaseCollision(catPrev, catNext, targetPrev, targetNext)).toBe(true);
  });

  it('erkennt direkten Treffer wenn beide gleichzeitig auf dasselbe Feld ziehen', () => {
    const catPrev: Pos = { x: 3, y: 4 };
    const catNext: Pos = { x: 4, y: 4 };
    const targetPrev: Pos = { x: 5, y: 4 };
    const targetNext: Pos = { x: 4, y: 4 };

    expect(checkChaseCollision(catPrev, catNext, targetPrev, targetNext)).toBe(true);
  });

  it('erkennt horizontalen Counter-Step (Positionstausch auf gleicher Kante)', () => {
    const catPrev: Pos = { x: 3, y: 4 };
    const catNext: Pos = { x: 4, y: 4 };
    const targetPrev: Pos = { x: 4, y: 4 };
    const targetNext: Pos = { x: 3, y: 4 };

    expect(checkChaseCollision(catPrev, catNext, targetPrev, targetNext)).toBe(true);
  });

  it('erkennt vertikalen Counter-Step (Positionstausch auf gleicher Kante)', () => {
    const catPrev: Pos = { x: 2, y: 2 };
    const catNext: Pos = { x: 2, y: 3 };
    const targetPrev: Pos = { x: 2, y: 3 };
    const targetNext: Pos = { x: 2, y: 2 };

    expect(checkChaseCollision(catPrev, catNext, targetPrev, targetNext)).toBe(true);
  });

  it('erkennt diagonalen Swept-Volume-Treffer der Katze über Zwischenfelder', () => {
    // Katze zieht von (4,4) diagonal nach (5,5)
    // Zwischenfelder sind (5,4) und (4,5)
    const catPrev: Pos = { x: 4, y: 4 };
    const catNext: Pos = { x: 5, y: 5 };
    const targetPrev: Pos = { x: 5, y: 4 };
    const targetNext: Pos = { x: 5, y: 4 };

    expect(checkChaseCollision(catPrev, catNext, targetPrev, targetNext)).toBe(true);
  });

  it('erkennt diagonalen Swept-Volume-Treffer des Schirms über Zwischenfelder', () => {
    // Schirm zieht von (2,2) diagonal nach (3,3)
    // Zwischenfelder sind (3,2) und (2,3)
    const targetPrev: Pos = { x: 2, y: 2 };
    const targetNext: Pos = { x: 3, y: 3 };
    const catPrev: Pos = { x: 3, y: 2 };
    const catNext: Pos = { x: 3, y: 2 };

    expect(checkChaseCollision(catPrev, catNext, targetPrev, targetNext)).toBe(true);
  });

  it('erkennt diagonalen X-Kreuzungsschnitt (Cat und Target kreuzen diagonal)', () => {
    // Katze: (3,3) -> (4,4), Schirm: (4,3) -> (3,4)
    const catPrev: Pos = { x: 3, y: 3 };
    const catNext: Pos = { x: 4, y: 4 };
    const targetPrev: Pos = { x: 4, y: 3 };
    const targetNext: Pos = { x: 3, y: 4 };

    expect(checkChaseCollision(catPrev, catNext, targetPrev, targetNext)).toBe(true);
  });

  it('gibt false zurück wenn Bewegungen disjunkt sind', () => {
    const catPrev: Pos = { x: 0, y: 0 };
    const catNext: Pos = { x: 1, y: 0 };
    const targetPrev: Pos = { x: 7, y: 7 };
    const targetNext: Pos = { x: 6, y: 7 };

    expect(checkChaseCollision(catPrev, catNext, targetPrev, targetNext)).toBe(false);
  });

  it('gibt false zurück bei parallelen Bewegungen ohne Überschneidung', () => {
    const catPrev: Pos = { x: 2, y: 2 };
    const catNext: Pos = { x: 3, y: 2 };
    const targetPrev: Pos = { x: 2, y: 4 };
    const targetNext: Pos = { x: 3, y: 4 };

    expect(checkChaseCollision(catPrev, catNext, targetPrev, targetNext)).toBe(false);
  });
});

describe('stepUmbrella & Flucht-Bias (Issue #44)', () => {
  it('steigert die Flucht-Wahrscheinlichkeit monoton von Level 1 (0 %) bis Level 7 (95 %)', () => {
    expect(fleeProbabilityForLevel(1)).toBe(0);
    expect(fleeProbabilityForLevel(2)).toBe(0.25);
    expect(fleeProbabilityForLevel(3)).toBe(0.45);
    expect(fleeProbabilityForLevel(4)).toBe(0.6);
    expect(fleeProbabilityForLevel(5)).toBe(0.75);
    expect(fleeProbabilityForLevel(6)).toBe(0.85);
    expect(fleeProbabilityForLevel(7)).toBe(0.95);
  });

  it('wählt ab Level 2 niemals Stillstand ({x: 0, y: 0}), auch nicht am Rand oder in der Ecke', () => {
    const rng = createRng('no-standstill-test');
    const positions: Pos[] = [
      { x: 4, y: 4 },
      { x: 0, y: 0 },
      { x: 7, y: 7 },
      { x: 0, y: 4 },
      { x: 7, y: 2 },
    ];
    const catPos: Pos = { x: 3, y: 3 };

    for (let level = 2; level <= 7; level++) {
      for (const pos of positions) {
        for (let i = 0; i < 50; i++) {
          const next = stepUmbrella(pos, catPos, level, rng, 8);
          expect(next.x !== pos.x || next.y !== pos.y).toBe(true);
          expect(next.x).toBeGreaterThanOrEqual(0);
          expect(next.x).toBeLessThan(8);
          expect(next.y).toBeGreaterThanOrEqual(0);
          expect(next.y).toBeLessThan(8);
        }
      }
    }
  });

  it('flieht auf höheren Levels bevorzugt vor der Katze (Distanz vergrößert sich)', () => {
    const rng = createRng('flee-bias-test');
    const catPos: Pos = { x: 4, y: 4 };
    const startPos: Pos = { x: 5, y: 4 };
    const startDistSq = (startPos.x - catPos.x) ** 2 + (startPos.y - catPos.y) ** 2;

    let increasedCountLevel7 = 0;
    let increasedCountLevel1 = 0;
    const trials = 200;

    for (let i = 0; i < trials; i++) {
      const next7 = stepUmbrella(startPos, catPos, 7, rng, 8);
      const dist7 = (next7.x - catPos.x) ** 2 + (next7.y - catPos.y) ** 2;
      if (dist7 > startDistSq) increasedCountLevel7++;

      const next1 = stepUmbrella(startPos, catPos, 1, rng, 8);
      const dist1 = (next1.x - catPos.x) ** 2 + (next1.y - catPos.y) ** 2;
      if (dist1 > startDistSq) increasedCountLevel1++;
    }

    // Auf Level 7 (95 % Flee-Bias) muss die überwiegende Mehrheit (> 90 %) die Distanz vergrößern
    expect(increasedCountLevel7 / trials).toBeGreaterThan(0.9);
    // Und deutlich häufiger als auf Level 1 (0 % Flee-Bias, 5 von 9 Richtungen ≈ 55 %)
    expect(increasedCountLevel7).toBeGreaterThan(increasedCountLevel1 + 40);
  });

  it('hält in einer Ecke bei aktivem Flucht-Bias die Distanz zur Katze maximal', () => {
    const rng = createRng('corner-flee-test');
    const catPos: Pos = { x: 4, y: 4 };
    const cornerPos: Pos = { x: 7, y: 7 };

    // In der Ecke (7,7) sind die Nachbarn (7,6), (6,7) mit distSq=13 und (6,6) mit distSq=8.
    // Mit 100 % Flee-Trigger (wir testen viele Schritte auf Level 7) wird fast nie (6,6) gewählt.
    let steppedIntoCatDiagonal = 0;
    const trials = 100;
    for (let i = 0; i < trials; i++) {
      const next = stepUmbrella(cornerPos, catPos, 7, rng, 8);
      if (next.x === 6 && next.y === 6) steppedIntoCatDiagonal++;
    }
    expect(steppedIntoCatDiagonal).toBeLessThan(10);
  });
});
