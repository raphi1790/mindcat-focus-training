// @vitest-environment jsdom
import { StrictMode, act } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTrialRng } from '../../../platform/rng';
import AnticipationInvisible from './AnticipationInvisible';
import AnticipationVisible from './AnticipationVisible';

/**
 * AP1/Befund A (Fix-Plan Testrunde 1): `endTrial` lag in den Updatern von
 * `setLane` und `setElapsedMs`, die React unter StrictMode doppelt aufruft →
 * ein Trial zählte doppelt. Beide Pfade werden hier **in StrictMode** geprüft:
 * der Timer-Pfad (verpasster Trial) und der Bewegungs-Pfad (richtiger Trial).
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

// Spiegelt LANES/HOME_LANE und travelMsForLevel/catchWindowMsForLevel (Level 1).
const LANES = 5;
const HOME_LANE = 2;
const TRAVEL_MS_L1 = 3600;
const CATCH_WINDOW_MS_L1 = 1400;
const SEED = 'ap1-test-seed';

/** Spiegelt pickTargetLane() aus AnticipationExercise.tsx für Trial 0. */
function targetLaneForTrial0(seed: string): number {
  const rng = createTrialRng(seed, 0);
  let lane: number;
  let guard = 0;
  do {
    lane = rng.int(0, LANES);
    guard += 1;
  } while (lane === HOME_LANE && guard < 20);
  return lane;
}

function press(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    flushFrame();
  });
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { key }));
  });
}

function streakLabel(container: HTMLElement): string | null {
  return container.querySelector('[aria-label*="Sternen"]')?.getAttribute('aria-label') ?? null;
}

function renderExercise() {
  return render(
    <StrictMode>
      <AnticipationVisible ageGroup={4} seed={SEED} onComplete={() => {}} onCancel={() => {}} />
    </StrictMode>,
  );
}

describe('AnticipationExercise — kein Doppelzählen unter StrictMode (AP1/Befund A)', () => {
  it('verpasster Trial zählt genau einmal (Timer-Pfad)', () => {
    const { container } = renderExercise();
    expect(container.textContent).toContain('0 / 21');

    // Ente taucht auf und das Fangfenster verstreicht, ohne dass die Katze
    // die Spur wechselt → genau ein verpasster Trial.
    act(() => {
      vi.advanceTimersByTime(TRAVEL_MS_L1 + CATCH_WINDOW_MS_L1 + 100);
    });

    expect(container.textContent).toContain('1 / 21');
    expect(container.textContent).not.toContain('2 / 21');
  });

  it('erster richtiger Trial füllt genau 1 Stern (nicht 2) — Bewegungs-Pfad', () => {
    const target = targetLaneForTrial0(SEED);
    expect(target).not.toBe(HOME_LANE);

    const { container } = renderExercise();
    expect(streakLabel(container)).toBe('0 von 3 Sternen bis zum nächsten Level');

    // Katze rechtzeitig in die Zielspur bringen (je Zug 200 ms — weit vor dem
    // Auftauchen der Ente nach 3600 ms).
    const key = target > HOME_LANE ? 'ArrowRight' : 'ArrowLeft';
    for (let i = 0; i < Math.abs(target - HOME_LANE); i++) press(key);

    // Bis zum Auftauchen vorspulen: Katze steht richtig → korrekter Trial.
    act(() => {
      vi.advanceTimersByTime(TRAVEL_MS_L1);
    });

    expect(streakLabel(container)).toBe('1 von 3 Sternen bis zum nächsten Level');
    expect(container.textContent).toContain('1 / 21');
  });
});

describe('AnticipationInvisible — 800 ms Einstiegs-Cue vor dem Untertauchen (AP4)', () => {
  it('Ente ist in den ersten 800 ms sichtbar, taucht danach ab und taucht am Ende wieder auf', () => {
    const { container } = render(
      <StrictMode>
        <AnticipationInvisible ageGroup={4} seed={SEED} onComplete={() => {}} onCancel={() => {}} />
      </StrictMode>,
    );

    // 1. Zu Beginn (t = 0 ms < 800 ms): Einstiegs-Cue — Ente ist in der Zielspur sichtbar.
    expect(container.textContent).toContain('🦆');

    // 2. Nach 800 ms (t = 800 ms): Ente taucht unter.
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(container.textContent).not.toContain('🦆');

    // 3. Nach Ablauf der Anflugphase (t = 3600 ms): Ente taucht am Zielort wieder auf.
    act(() => {
      vi.advanceTimersByTime(TRAVEL_MS_L1 - 800);
    });
    expect(container.textContent).toContain('🦆');
  });
});

