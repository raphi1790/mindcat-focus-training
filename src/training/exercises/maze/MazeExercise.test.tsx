// @vitest-environment jsdom
import { act } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExerciseResult } from '../../../data/schema';
import MazeExercise from './MazeExercise';
import { LEVEL_MAPS } from './maps';

/**
 * useDirectionalInput treibt Bewegung über eine rAF-Schleife; jsdom kennt kein
 * requestAnimationFrame. Manuelle Frame-Steuerung (vgl.
 * platform/timing/timing.test.ts) statt echter Wartezeit hält den Test
 * synchron und schnell.
 */
let rafQueue: FrameRequestCallback[] = [];

function flushFrame(timeAdvanceMs = 200) {
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

/** BFS von Start (3) zu Ziel (2) über orthogonale Schritte — wie es die 4-Wege-Eingabe (AP4) verlangt. */
function findPath(map: number[][]): { dx: number; dy: number }[] {
  let start: [number, number] | null = null;
  let target: [number, number] | null = null;
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < (map[y]?.length ?? 0); x++) {
      if (map[y]?.[x] === 3) start = [x, y];
      if (map[y]?.[x] === 2) target = [x, y];
    }
  }
  if (!start || !target) throw new Error('Start/Ziel fehlt');

  const key = (x: number, y: number) => `${x},${y}`;
  const cameFrom = new Map<string, [number, number, number, number]>();
  const seen = new Set([key(start[0], start[1])]);
  const queue: [number, number][] = [start];
  const dirs: [number, number][] = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    if (x === target[0] && y === target[1]) break;
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (ny < 0 || ny >= map.length || nx < 0 || nx >= (map[ny]?.length ?? 0)) continue;
      if (map[ny]?.[nx] === 1) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      cameFrom.set(k, [x, y, dx, dy]);
      queue.push([nx, ny]);
    }
  }

  const path: { dx: number; dy: number }[] = [];
  const startKey = key(start[0], start[1]);
  let cur = key(target[0], target[1]);
  while (cur !== startKey) {
    const entry = cameFrom.get(cur);
    if (!entry) throw new Error('Kein Pfad gefunden — Level nicht lösbar?');
    const [px, py, dx, dy] = entry;
    path.push({ dx, dy });
    cur = key(px, py);
  }
  path.reverse();
  return path;
}

describe('MazeExercise — Wände blockieren statt bestrafen (AP4/Befund E)', () => {
  it('Wandkontakt stoppt nur die Bewegung, ohne Trial-Ende oder Reset', () => {
    const { container } = render(
      <MazeExercise ageGroup={6} seed="ap4-test-seed" onComplete={() => {}} onCancel={() => {}} />,
    );

    const before = container.textContent;

    // Level 1: direkt südlich vom Start ist eine Wand (Sackgasse) — vgl.
    // LEVEL_MAPS[1] in maps.ts. Der Bump darf weder die Katze bewegen noch
    // den Trial beenden (kein Fehler-Flash, kein Reset).
    press(0, 1);

    expect(container.textContent).toBe(before);
    expect(container.textContent).toContain('Labyrinth 0 / 6 geschafft');
  });

  it('4-way-Eingabe: Diagonalen bewegen die Katze nicht (kein Move gegen die Ecke)', () => {
    const { container } = render(
      <MazeExercise ageGroup={6} seed="ap4-test-seed" onComplete={() => {}} onCancel={() => {}} />,
    );
    const before = container.textContent;

    // ArrowUp + ArrowLeft gleichzeitig halten (Diagonale) — im 4-way-Modus
    // (Maze) darf das keinen Move auslösen (weder Bump-Sound noch Bewegung).
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      flushFrame();
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }));
    });

    expect(container.textContent).toBe(before);
  });

  it('alle 6 Level lösen schließt die Übung ab; Wand-Bumps landen als rawEvents', () => {
    let result: ExerciseResult | undefined;
    render(
      <MazeExercise
        ageGroup={6}
        seed="ap4-test-seed"
        onComplete={(r) => {
          result = r;
        }}
        onCancel={() => {}}
      />,
    );

    // Ein bewusster Bump vor dem ersten Level, damit rawEvents mindestens
    // einen wallBump enthält (Abnahme-Kriterium AP4).
    press(0, 1);

    for (let level = 1; level <= 6; level++) {
      const map = LEVEL_MAPS[level]!;
      const path = findPath(map);
      for (const step of path) press(step.dx, step.dy);

      // Erfolgs-Flash (FLASH_MS) abwarten, bevor der nächste Level startet.
      act(() => {
        vi.advanceTimersByTime(600);
      });
    }

    expect(result).toBeDefined();
    expect(result!.trials).toBe(6);
    expect(result!.errors).toBe(0);
    expect(result!.levelsCompleted).toBe(6);
    expect(result!.rawEvents?.some((e) => e.type === 'wallBump')).toBe(true);
  });
});
