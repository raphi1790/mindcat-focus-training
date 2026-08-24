import { describe, expect, it } from 'vitest';
import { checkChaseCollision, type Pos } from './collision';

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
