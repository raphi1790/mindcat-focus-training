// @vitest-environment jsdom
import { StrictMode, act } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTrialRng } from '../../../platform/rng';
import { createExerciseProgress } from '../../engine/exerciseProgress';
import { type Pos } from './collision';
import ChaseExercise from './ChaseExercise';

/**
 * AP1/Befund A (Fix-Plan Testrunde 1): `endTrial` lag in State-Updatern, die
 * React unter StrictMode doppelt aufruft → der erste korrekte Trial zählte
 * zwei Sterne. Dieser Test rendert die Übung bewusst **in StrictMode** und
 * prüft, dass ein Fang genau einen Trial zählt.
 *
 * Im Browser ist das nicht automatisierbar (die rAF-Schleife von
 * useDirectionalInput läuft im Preview-Tab nicht) — hier steuern wir die
 * Frames manuell, wie in MazeExercise.test.tsx.
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

// Spiegelt GRID_SIZE/centerPos aus ChaseExercise.tsx.
const GRID_SIZE = 8;
const CENTER: Pos = { x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) };
/**
 * Seed bewusst so gewählt, dass der Schirm direkt neben der Katze startet:
 * Ein einziger Zug genügt, der Fang passiert also lange vor dem ersten
 * Schirm-Schritt (700 ms auf Level 1) — kein timing-abhängiger Test.
 */
const SEED = 'ap1-chase-0';

/** Spiegelt randomPos() aus ChaseExercise.tsx für Trial 0. */
function targetPosForTrial0(seed: string): Pos {
  const rng = createTrialRng(seed, 0);
  let pos: Pos;
  let guard = 0;
  do {
    pos = { x: rng.int(0, GRID_SIZE), y: rng.int(0, GRID_SIZE) };
    guard += 1;
  } while (pos.x === CENTER.x && pos.y === CENTER.y && guard < 20);
  return pos;
}

/** Einen (ggf. diagonalen) Zug ausführen: alle Richtungstasten gleichzeitig. */
function pressDirection(dx: number, dy: number) {
  const keys: string[] = [];
  if (dx > 0) keys.push('ArrowRight');
  else if (dx < 0) keys.push('ArrowLeft');
  if (dy > 0) keys.push('ArrowDown');
  else if (dy < 0) keys.push('ArrowUp');

  act(() => {
    for (const key of keys) window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    flushFrame();
  });
  act(() => {
    for (const key of keys) window.dispatchEvent(new KeyboardEvent('keyup', { key }));
  });
}

function streakLabel(container: HTMLElement): string | null {
  return container.querySelector('[aria-label*="Sternen"]')?.getAttribute('aria-label') ?? null;
}


describe('ChaseExercise — kein Doppelzählen unter StrictMode (AP1/Befund A)', () => {
  it('erster richtiger Fang füllt genau 1 Stern (nicht 2)', () => {
    const target = targetPosForTrial0(SEED);
    const dx = target.x - CENTER.x;
    const dy = target.y - CENTER.y;
    // Vorbedingung des gewählten Seeds: ein einziger Zug reicht zum Schirm.
    expect(Math.max(Math.abs(dx), Math.abs(dy))).toBe(1);

    const { container } = render(
      <StrictMode>
        <ChaseExercise ageGroup={4} seed={SEED} onComplete={() => {}} onCancel={() => {}} />
      </StrictMode>,
    );
    expect(streakLabel(container)).toBe('0 von 3 Sternen bis zum nächsten Level');

    pressDirection(dx, dy);

    expect(streakLabel(container)).toBe('1 von 3 Sternen bis zum nächsten Level');
  });
});

describe('ChaseExercise — Schirm-Schritt-Kollision & AP2', () => {
  function findSeedForTarget(predicate: (pos: Pos) => boolean): string {
    for (let i = 0; i < 1000; i++) {
      const s = `seed-ap2-${i}`;
      if (predicate(targetPosForTrial0(s))) return s;
    }
    throw new Error('Kein passender Seed gefunden');
  }

  function findSeedWhereTargetStepsOntoCat(): string {
    const stepOptions = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
      { x: 1, y: 1 },
      { x: 0, y: 0 },
    ];

    for (let i = 0; i < 2000; i++) {
      const s = `seed-step-cat-${i}`;
      const trialRng = createTrialRng(s, 0);

      // Reproduziere setupTrial:
      let pos: Pos;
      let guard = 0;
      do {
        pos = { x: trialRng.int(0, GRID_SIZE), y: trialRng.int(0, GRID_SIZE) };
        guard += 1;
      } while (pos.x === CENTER.x && pos.y === CENTER.y && guard < 20);

      // Reproduziere ersten stepRandomly im stepInterval:
      const choice = trialRng.pick(stepOptions);
      const nextTarget = {
        x: Math.min(Math.max(pos.x + choice.x, 0), GRID_SIZE - 1),
        y: Math.min(Math.max(pos.y + choice.y, 0), GRID_SIZE - 1),
      };

      if (nextTarget.x === CENTER.x && nextTarget.y === CENTER.y) {
        return s;
      }
    }
    throw new Error('Kein passender Seed für Schirmschritt auf Katze gefunden');
  }

  it('erkennt Fang wenn Schirm auf die stehende Katze zieht (stepInterval Collision Check)', () => {
    const seed = findSeedWhereTargetStepsOntoCat();

    const { container } = render(
      <ChaseExercise ageGroup={4} seed={seed} onComplete={() => {}} onCancel={() => {}} />,
    );

    expect(streakLabel(container)).toBe('0 von 3 Sternen bis zum nächsten Level');

    // Keine Tastatureingabe — wir warten einfach auf den ersten Schirm-Schritt (700 ms bei Level 1)
    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(streakLabel(container)).toBe('1 von 3 Sternen bis zum nächsten Level');
  });

  it('fängt den Schirm auf einem Zwischenfeld bei einem Diagonalschritt', () => {
    // Schirm steht auf (5, 4) — direkt rechts von der Katze (4, 4)
    const seed = findSeedForTarget((pos) => pos.x === 5 && pos.y === 4);

    const { container } = render(
      <ChaseExercise ageGroup={4} seed={seed} onComplete={() => {}} onCancel={() => {}} />,
    );

    expect(streakLabel(container)).toBe('0 von 3 Sternen bis zum nächsten Level');

    // Katze bewegt sich diagonal nach unten-rechts (dx: 1, dy: 1) von (4, 4) nach (5, 5)
    // Das überstrichene Zwischenfeld (prev.x + dx, prev.y) ist (5, 4) -> Schirm getroffen!
    pressDirection(1, 1);

    expect(streakLabel(container)).toBe('1 von 3 Sternen bis zum nächsten Level');
  });

  it('zeigt Geschwindigkeits-Icon (⚡) im HUD ab Level 2 an', () => {
    const { container } = render(
      <ChaseExercise
        ageGroup={4}
        seed={SEED}
        initialState={{ ...createExerciseProgress(), level: 2 }}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(container.textContent).toContain('⚡');
  });
});


