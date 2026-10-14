// @vitest-environment jsdom
import { act } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SideExercise from './SideExercise';
import { createExerciseProgress } from '../../engine';
import { LEVEL_MAPS, getStartPosition } from './maps';

let rafQueue: FrameRequestCallback[] = [];

function flushFrame(timeAdvanceMs = 300) {
  vi.advanceTimersByTime(timeAdvanceMs);
  const queue = rafQueue;
  rafQueue = [];
  for (const cb of queue) cb(performance.now());
}

beforeEach(() => {
  vi.useFakeTimers();
  rafQueue = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const KEY_FOR: Record<string, string> = {
  '1,0': 'ArrowRight',
  '-1,0': 'ArrowLeft',
  '0,1': 'ArrowDown',
  '0,-1': 'ArrowUp',
};

function press(dx: number, dy: number) {
  const key = KEY_FOR[`${dx},${dy}`];
  if (!key) throw new Error(`Keine Taste für Richtung ${dx},${dy}`);
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    flushFrame();
  });
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { key }));
  });
}

describe('SideExercise — Avatar-Spawn & Level-Resume (Issue #25)', () => {
  it('Level 1 Standard-Start: Katze spawnt auf getStartPosition(1) = (4, 4)', () => {
    expect(getStartPosition(1)).toEqual({ x: 4, y: 4 });
    const { container } = render(
      <SideExercise ageGroup={6} seed="test-seed" onComplete={() => {}} onCancel={() => {}} />,
    );

    // GridWorld platziert die Katze mit inline styles: left: 40%, top: 40% (4 * 10%)
    const catContainer = container.querySelector('[style*="left: 40%"][style*="top: 40%"]');
    expect(catContainer).not.toBeNull();
    expect(catContainer?.textContent).toContain('🐱');
  });

  it('Level 5 Resume: Katze spawnt auf getStartPosition(5) = (8, 8) und NICHT im Schlamm (4, 4)', () => {
    // In LEVEL_MAPS[5] ist (4, 4) ein Schlammfeld (Wert 1)!
    // Die korrekte Startposition ist (8, 8) (Wert 3).
    expect(getStartPosition(5)).toEqual({ x: 8, y: 8 });
    expect(LEVEL_MAPS[5]![4]![4]).toBe(1); // Schlamm!
    expect(LEVEL_MAPS[5]![8]![8]).toBe(3); // Start!

    const initialState = { ...createExerciseProgress(5), level: 5 };
    const { container } = render(
      <SideExercise
        ageGroup={6}
        seed="test-seed"
        initialState={initialState}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );

    // Die Katze darf keinesfalls bei 40%, 40% (Schlamm) spawnen
    const mudContainer = container.querySelector('[style*="left: 40%"][style*="top: 40%"]');
    expect(mudContainer).toBeNull();

    // Die Katze MUSS bei 80%, 80% (getStartPosition(5)) spawnen
    const startContainer = container.querySelector('[style*="left: 80%"][style*="top: 80%"]');
    expect(startContainer).not.toBeNull();
    expect(startContainer?.textContent).toContain('🐱');

    // HUD muss Level 5 anzeigen
    expect(container.textContent).toContain('Level 5');
  });

  it('Schritt von Startposition in Level 5 löst keinen Schlammfehler aus', () => {
    const initialState = { ...createExerciseProgress(5), level: 5 };
    const { container } = render(
      <SideExercise
        ageGroup={6}
        seed="test-seed"
        initialState={initialState}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );

    // In Level 5 ist (8, 7) ein sicherer Pfad (0), siehe LEVEL_MAPS[5]
    expect(LEVEL_MAPS[5]![7]![8]).toBe(0);

    // Bewege nach oben (dy: -1)
    press(0, -1);

    // Katze sollte auf (8, 7) stehen -> top: 70%, left: 80%
    const newPos = container.querySelector('[style*="left: 80%"][style*="top: 70%"]');
    expect(newPos).not.toBeNull();

    // Kein Fehler-Emoji (🙀)
    expect(container.textContent).not.toContain('🙀');
  });
});
