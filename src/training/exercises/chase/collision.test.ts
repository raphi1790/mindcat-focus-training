import { describe, expect, it } from 'vitest';
import { createRng } from '../../../platform/rng';
import {
  CAT_RADIUS,
  CAT_SPEED,
  CHASE_CENTER,
  UMBRELLA_BOUNDS,
  UMBRELLA_RADIUS,
  checkChaseOverlap,
  chooseUmbrellaDirection,
  fleeProbabilityForLevel,
  spawnUmbrellaPos,
  stepIntervalForLevel,
  stepUmbrellaContinuous,
  timeLimitForLevel,
  umbrellaSpeedForLevel,
} from './collision';

describe('checkChaseOverlap (Hitbox-Radius-Überlappung)', () => {
  it('erkennt Überlappung bei Abstand < rCat + rUmbrella und lehnt getrennte Positionen ab', () => {
    expect(checkChaseOverlap({ x: 50, y: 50 }, { x: 58, y: 50 })).toBe(true);
    expect(checkChaseOverlap({ x: 50, y: 50 }, { x: 60, y: 50 })).toBe(false);
    expect(checkChaseOverlap({ x: 50, y: 50 }, { x: 50 + CAT_RADIUS + UMBRELLA_RADIUS, y: 50 })).toBe(false);
  });
});

describe('Chase-Level-Progression (Issue #44 & #52)', () => {
  it('steigert Flucht-Wahrscheinlichkeit monoton von Level 1 (0 %) bis Level 7 (95 %)', () => {
    expect(fleeProbabilityForLevel(1)).toBe(0);
    expect(fleeProbabilityForLevel(2)).toBe(0.25);
    expect(fleeProbabilityForLevel(3)).toBe(0.45);
    expect(fleeProbabilityForLevel(4)).toBe(0.6);
    expect(fleeProbabilityForLevel(5)).toBe(0.75);
    expect(fleeProbabilityForLevel(6)).toBe(0.85);
    expect(fleeProbabilityForLevel(7)).toBe(0.95);
  });

  it('verkürzt Vektor-Intervall und Zeitlimit während die Schirm-Geschwindigkeit unterhalb der Katze wächst', () => {
    for (let level = 1; level < 7; level++) {
      expect(stepIntervalForLevel(level + 1)).toBeLessThanOrEqual(stepIntervalForLevel(level));
      expect(timeLimitForLevel(level + 1)).toBeLessThan(timeLimitForLevel(level));
      expect(umbrellaSpeedForLevel(level + 1)).toBeGreaterThan(umbrellaSpeedForLevel(level));
    }
    expect(umbrellaSpeedForLevel(7)).toBeLessThan(CAT_SPEED);
  });
});

describe('spawnUmbrellaPos & chooseUmbrellaDirection', () => {
  it('spawnt deterministisch mit Mindestabstand zur Katze innerhalb der Arena', () => {
    const p1 = spawnUmbrellaPos(CHASE_CENTER, createRng('spawn-a'));
    const p2 = spawnUmbrellaPos(CHASE_CENTER, createRng('spawn-a'));
    expect(p1).toEqual(p2);
    expect(Math.hypot(p1.x - CHASE_CENTER.x, p1.y - CHASE_CENTER.y)).toBeGreaterThanOrEqual(20);
    expect(p1.x).toBeGreaterThanOrEqual(10);
    expect(p1.x).toBeLessThanOrEqual(90);
    expect(p1.y).toBeGreaterThanOrEqual(10);
    expect(p1.y).toBeLessThanOrEqual(90);
  });

  it('liefert normierte Einheitsvektoren und flieht in hohen Leveln bevorzugt weg von der Katze', () => {
    const rng = createRng('flee-bias-continuous');
    const catPos = { x: 50, y: 50 };
    const pos = { x: 60, y: 50 };

    let awayLevel7 = 0;
    let awayLevel1 = 0;
    const samples = 200;

    for (let i = 0; i < samples; i++) {
      const dir7 = chooseUmbrellaDirection(pos, catPos, 7, rng);
      expect(Math.hypot(dir7.x, dir7.y)).toBeCloseTo(1, 6);
      if (dir7.x > 0) awayLevel7++;

      const dir1 = chooseUmbrellaDirection(pos, catPos, 1, rng);
      expect(Math.hypot(dir1.x, dir1.y)).toBeCloseTo(1, 6);
      if (dir1.x > 0) awayLevel1++;
    }

    expect(awayLevel7 / samples).toBeGreaterThan(0.9);
    expect(awayLevel7).toBeGreaterThan(awayLevel1 + 50);
  });

  it('produziert auch bei identischer Katze/Schirm-Position keinen NaN-Vektor', () => {
    const dir = chooseUmbrellaDirection({ x: 50, y: 50 }, { x: 50, y: 50 }, 7, createRng('same-pos'));
    expect(Number.isFinite(dir.x)).toBe(true);
    expect(Number.isFinite(dir.y)).toBe(true);
    expect(Math.hypot(dir.x, dir.y)).toBeCloseTo(1, 6);
  });
});

describe('stepUmbrellaContinuous (Kontinuierliche Bewegung & Abprallen)', () => {
  it('bewegt sich kontinuierlich entlang des Vektors und prallt an Arena-Rändern ab', () => {
    const rng = createRng('bounce-test');
    const res = stepUmbrellaContinuous(
      { x: UMBRELLA_BOUNDS.maxX - 0.2, y: 50 },
      { x: 1, y: 0 },
      CHASE_CENTER,
      1,
      50,
      0,
      rng,
    );
    expect(res.pos.x).toBeLessThanOrEqual(UMBRELLA_BOUNDS.maxX);
    expect(res.pos.x).toBeGreaterThanOrEqual(UMBRELLA_BOUNDS.minX);
    expect(res.vel.x).toBeLessThan(0); // nach links abgeprallt
  });

  it('passt den Vektor deterministisch nach stepIntervalForLevel(level) an', () => {
    const rngA = createRng('turn-det');
    const rngB = createRng('turn-det');
    const interval = stepIntervalForLevel(3);

    const a1 = stepUmbrellaContinuous({ x: 40, y: 40 }, { x: 1, y: 0 }, CHASE_CENTER, 3, interval, 0, rngA);
    const b1 = stepUmbrellaContinuous({ x: 40, y: 40 }, { x: 1, y: 0 }, CHASE_CENTER, 3, interval, 0, rngB);
    expect(a1).toEqual(b1);
    expect(a1.turnTimerMs).toBe(0);
    expect(a1.vel).not.toEqual({ x: 1, y: 0 });
  });
});
