// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExerciseResult } from '../../../data/schema';
import { soundManager } from '../../../ui';
import { createExerciseProgress } from '../../engine';
import MazeExercise from './MazeExercise';
import { LEVEL_MAPS, getMazeArenaLayout } from './maps';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const KEY_FOR: Record<string, string> = {
  '1,0': 'ArrowRight',
  '-1,0': 'ArrowLeft',
  '0,1': 'ArrowDown',
  '0,-1': 'ArrowUp',
};

function findPath(map: number[][]): { dx: number; dy: number; tx: number; ty: number }[] {
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

  const path: { dx: number; dy: number; tx: number; ty: number }[] = [];
  const startKey = key(start[0], start[1]);
  let cur = key(target[0], target[1]);
  while (cur !== startKey) {
    const entry = cameFrom.get(cur);
    if (!entry) throw new Error('Kein Pfad gefunden — Level nicht lösbar?');
    const [px, py, dx, dy] = entry;
    const [tx, ty] = cur.split(',').map(Number) as [number, number];
    path.push({ dx, dy, tx, ty });
    cur = key(px, py);
  }
  path.reverse();
  return path;
}

function getCatPos(container: HTMLElement): { x: number; y: number } {
  const cat = container.querySelector<HTMLElement>('[data-testid="arena-cat"]');
  if (!cat) throw new Error('arena-cat nicht gefunden');
  return {
    x: parseFloat(cat.style.left),
    y: parseFloat(cat.style.top),
  };
}

function solveLevel(container: HTMLElement, level: number) {
  const map = LEVEL_MAPS[level]!;
  const tileSize = 100 / map.length;
  const path = findPath(map);

  for (const step of path) {
    if (container.textContent?.includes('😸')) break;
    const key = KEY_FOR[`${step.dx},${step.dy}`]!;
    const targetX = (step.tx + 0.5) * tileSize;
    const targetY = (step.ty + 0.5) * tileSize;

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    });

    for (let guard = 0; guard < 120; guard++) {
      if (container.textContent?.includes('😸')) break;
      const pos = getCatPos(container);
      const reachedX =
        step.dx === 0 || (step.dx > 0 ? pos.x >= targetX : pos.x <= targetX);
      const reachedY =
        step.dy === 0 || (step.dy > 0 ? pos.y >= targetY : pos.y <= targetY);
      if (reachedX && reachedY) break;

      act(() => {
        vi.advanceTimersByTime(16);
      });
    }

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key }));
    });
  }
}

describe('MazeExercise — ArenaWorld & kontinuierliche Steuerung', () => {
  it('Wandkontakt stoppt nur die Bewegung und loggt Bump mit ~300ms Cooldown ohne Trial-Ende', () => {
    const playSpy = vi.spyOn(soundManager, 'play').mockImplementation(() => {});
    const { container } = render(
      <MazeExercise ageGroup={6} seed="ap4-test-seed" onComplete={() => {}} onCancel={() => {}} />,
    );

    const start = getCatPos(container);

    // Level 1: direkt südlich vom Start (1,1) liegt eine Wand (1,2).
    // ArrowDown gedrückt halten: nach ~160ms prallt die Katze gegen die Wand (1. Bump).
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      vi.advanceTimersByTime(200);
    });

    const bumpCount1 = playSpy.mock.calls.filter(([s]) => s === 'bump').length;
    expect(bumpCount1).toBe(1);
    expect(container.textContent).toContain('Labyrinth 0 / 6 geschafft');
    expect(container.textContent).not.toContain('🙀');

    // Katze bewegt sich etwas in Richtung Wandkante, bleibt aber im Korridor
    const afterWall = getCatPos(container);
    expect(afterWall.x).toBeCloseTo(start.x, 1);
    expect(afterWall.y).toBeGreaterThan(start.y);
    expect(afterWall.y).toBeLessThan(2 * (100 / 7));

    // Weiteres Halten innerhalb von 300ms löst KEINEN weiteren Bump aus
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(playSpy.mock.calls.filter(([s]) => s === 'bump').length).toBe(1);

    // Nach Ablauf des 300ms-Cooldowns löst fortgesetztes Drücken den 2. Bump aus
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(playSpy.mock.calls.filter(([s]) => s === 'bump').length).toBe(2);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown' }));
    });
  });

  it('Wall-Sliding: diagonales Halten entlang einer Wand gleitet flüssig in den freien Korridor', () => {
    const { container } = render(
      <MazeExercise ageGroup={6} seed="ap4-test-seed" onComplete={() => {}} onCancel={() => {}} />,
    );
    const start = getCatPos(container);

    // In Level 1 ist südlich (1,2) blockiert, östlich (2,1) frei.
    // ArrowRight + ArrowDown gleichzeitig halten → Katze gleitet nach rechts!
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      vi.advanceTimersByTime(400);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown' }));
    });

    const moved = getCatPos(container);
    expect(moved.x).toBeGreaterThan(start.x + 6);
  });

  it('alle 6 Level kontinuierlich lösen schließt die Übung ab; Wand-Bumps landen als rawEvents', () => {
    let result: ExerciseResult | undefined;
    const { container } = render(
      <MazeExercise
        ageGroup={6}
        seed="ap4-test-seed"
        onComplete={(r) => {
          result = r;
        }}
        onCancel={() => {}}
      />,
    );

    // Ein bewusster Bump vor dem ersten Level, damit rawEvents mindestens einen wallBump enthält.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      vi.advanceTimersByTime(200);
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown' }));
    });

    for (let level = 1; level <= 6; level++) {
      solveLevel(container, level);
      expect(container.textContent).toContain('😸');

      act(() => {
        vi.advanceTimersByTime(600);
      });
    }

    expect(result).toBeDefined();
    expect(result!.trials).toBe(6);
    expect(result!.errors).toBe(0);
    expect(result!.levelsCompleted).toBe(6);
    expect(result!.rawEvents?.some((e) => e.type === 'wallBump')).toBe(true);
  }, 15000);

  it('wechselt das Layout beim Level-Up erst nach Ablauf des 500ms-Erfolgs-Flashs (7×7 → 9×9)', () => {
    const initialState = { ...createExerciseProgress(6), level: 2 };
    const { container } = render(
      <MazeExercise
        ageGroup={6}
        seed="ap4-test-seed"
        initialState={initialState}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );

    const layoutEl = () => container.querySelector<HTMLElement>('[data-testid="maze-layout"]');
    expect(layoutEl()?.dataset.gridSize).toBe('7');

    solveLevel(container, 2);

    // Während des 500ms-Flashs bleibt das 7×7-Layout sichtbar
    expect(layoutEl()?.dataset.gridSize).toBe('7');
    expect(container.textContent).toContain('😸');

    // Nach Ablauf von FLASH_MS wechselt das Layout auf 9×9 (Level 3)
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(layoutEl()?.dataset.gridSize).toBe('9');
  });

  it('Level 6 Resume: rendert 11×11-Layout und spawnt Katze auf getMazeArenaLayout(6).startPos', () => {
    const layout6 = getMazeArenaLayout(6);
    expect(layout6.gridSize).toBe(11);

    const initialState = { ...createExerciseProgress(6), level: 6 };
    const { container } = render(
      <MazeExercise
        ageGroup={6}
        seed="ap4-test-seed"
        initialState={initialState}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );

    const layoutEl = container.querySelector<HTMLElement>('[data-testid="maze-layout"]');
    expect(layoutEl?.dataset.gridSize).toBe('11');

    const pos = getCatPos(container);
    expect(pos.x).toBeCloseTo(layout6.startPos.x, 3);
    expect(pos.y).toBeCloseTo(layout6.startPos.y, 3);
    expect(container.textContent).toContain('Level 6');
  });
});
