import { describe, expect, it } from 'vitest';
import { createRng } from '../../../../platform/rng';
import {
  catchWindowMsForLevel,
  INVISIBLE_VISIBLE_PROGRESS_LIMIT,
  isDuckVisibleInPond,
  lanesForLevel,
  pickTargetLane,
  travelMsForLevel,
} from '../anticipationEngine';

describe('anticipationEngine — Rueda (2005) Parameter & Sichtbarkeit', () => {
  it('lanesForLevel liefert 5 Spuren für Level 1–3 und 7 Spuren für Level 4–7', () => {
    expect(lanesForLevel(1)).toBe(5);
    expect(lanesForLevel(2)).toBe(5);
    expect(lanesForLevel(3)).toBe(5);
    expect(lanesForLevel(4)).toBe(7);
    expect(lanesForLevel(5)).toBe(7);
    expect(lanesForLevel(6)).toBe(7);
    expect(lanesForLevel(7)).toBe(7);
  });

  it('travelMsForLevel skaliert von 3600ms (Level 1) auf 2400ms (Level 7)', () => {
    expect(travelMsForLevel(1)).toBe(3600);
    expect(travelMsForLevel(2)).toBe(3400);
    expect(travelMsForLevel(3)).toBe(3200);
    expect(travelMsForLevel(4)).toBe(3000);
    expect(travelMsForLevel(5)).toBe(2800);
    expect(travelMsForLevel(6)).toBe(2600);
    expect(travelMsForLevel(7)).toBe(2400);
  });

  it('catchWindowMsForLevel skaliert von 1600ms (Level 1) auf 1000ms (Level 7)', () => {
    expect(catchWindowMsForLevel(1)).toBe(1600);
    expect(catchWindowMsForLevel(2)).toBe(1500);
    expect(catchWindowMsForLevel(3)).toBe(1400);
    expect(catchWindowMsForLevel(4)).toBe(1300);
    expect(catchWindowMsForLevel(5)).toBe(1200);
    expect(catchWindowMsForLevel(6)).toBe(1100);
    expect(catchWindowMsForLevel(7)).toBe(1000);
  });

  it('isDuckVisibleInPond zeigt die Ente in visible durchgehend und in invisible nur bis progress < 0.38 sowie bei Ankunft', () => {
    for (const p of [0, 0.2, 0.37, 0.38, 0.7, 0.99]) {
      expect(isDuckVisibleInPond('visible', 'approaching', p)).toBe(true);
    }
    expect(isDuckVisibleInPond('visible', 'catchable', 1)).toBe(true);
    expect(isDuckVisibleInPond('visible', 'arrived', 1)).toBe(true);

    expect(isDuckVisibleInPond('invisible', 'approaching', 0)).toBe(true);
    expect(isDuckVisibleInPond('invisible', 'approaching', 0.2)).toBe(true);
    expect(isDuckVisibleInPond('invisible', 'approaching', INVISIBLE_VISIBLE_PROGRESS_LIMIT - 0.01)).toBe(true);
    expect(isDuckVisibleInPond('invisible', 'approaching', INVISIBLE_VISIBLE_PROGRESS_LIMIT)).toBe(false);
    expect(isDuckVisibleInPond('invisible', 'approaching', 0.75)).toBe(false);
    expect(isDuckVisibleInPond('invisible', 'catchable', 1)).toBe(true);
    expect(isDuckVisibleInPond('invisible', 'arrived', 1)).toBe(true);
    expect(isDuckVisibleInPond('invisible', 'done', 1)).toBe(true);
  });

  it('pickTargetLane wählt Zielspuren im gültigen Bereich [0, lanes) ungleich exclude', () => {
    const rng = createRng('engine-unit-test');
    for (let i = 0; i < 40; i++) {
      const t5 = pickTargetLane(rng, 5, 2);
      expect(t5).toBeGreaterThanOrEqual(0);
      expect(t5).toBeLessThan(5);
      expect(t5).not.toBe(2);
    }
  });
});
