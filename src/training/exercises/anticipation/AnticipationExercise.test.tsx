// @vitest-environment jsdom
import { StrictMode, act } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng, createTrialRng } from '../../../platform/rng';
import { createExerciseProgress } from '../../engine';
import { catchWindowMsForLevel, lanesForLevel, pickTargetLane, travelMsForLevel } from './anticipationEngine';
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

function renderExercise(initialLevel = 1) {
  const initialState = initialLevel > 1 ? { ...createExerciseProgress(), level: initialLevel } : undefined;
  return render(
    <StrictMode>
      <AnticipationVisible ageGroup={4} seed={SEED} initialState={initialState} onComplete={() => {}} onCancel={() => {}} />
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

describe('Anticipation — Dynamische Spuren-Skalierung (Issue #14, Rueda 2005)', () => {
  it('lanesForLevel liefert 5 Spuren für Level 1–3 und 7 Spuren für Level 4–7', () => {
    expect(lanesForLevel(1)).toBe(5);
    expect(lanesForLevel(2)).toBe(5);
    expect(lanesForLevel(3)).toBe(5);
    expect(lanesForLevel(4)).toBe(7);
    expect(lanesForLevel(5)).toBe(7);
    expect(lanesForLevel(6)).toBe(7);
    expect(lanesForLevel(7)).toBe(7);
  });

  it('travelMsForLevel und catchWindowMsForLevel skalieren monoton mit steigendem Level', () => {
    expect(travelMsForLevel(1)).toBe(3600);
    expect(travelMsForLevel(7)).toBe(1500);
    expect(catchWindowMsForLevel(1)).toBe(1400);
    expect(catchWindowMsForLevel(7)).toBe(680);
  });

  it('pickTargetLane wählt Zielspuren im gültigen Bereich [0, lanes) ungleich exclude', () => {
    const rng = createRng('test-seed-target-lane');
    for (let i = 0; i < 50; i++) {
      const target5 = pickTargetLane(rng, 5, 2);
      expect(target5).toBeGreaterThanOrEqual(0);
      expect(target5).toBeLessThan(5);
      expect(target5).not.toBe(2);

      const target7 = pickTargetLane(rng, 7, 3);
      expect(target7).toBeGreaterThanOrEqual(0);
      expect(target7).toBeLessThan(7);
      expect(target7).not.toBe(3);
    }
  });

  it('rendert 5 Spuren in Level 1 und 7 Spuren in Level 4', () => {
    const { container: containerL1, unmount: unmountL1 } = renderExercise(1);
    const lanesL1 = containerL1.querySelectorAll('.aspect-\\[3\\/1\\]');
    expect(lanesL1.length).toBe(5);
    unmountL1();

    const { container: containerL4, unmount: unmountL4 } = renderExercise(4);
    const lanesL4 = containerL4.querySelectorAll('.aspect-\\[3\\/1\\]');
    expect(lanesL4.length).toBe(7);
    unmountL4();
  });
});

describe('Anticipation — Positionspersistenz der Katze über Trials (Issue #14)', () => {
  it('Katze behält ihre Position über aufeinanderfolgende Trials und wird nicht auf das Zentrum zurückgesetzt', () => {
    const { container } = renderExercise(1);

    // Initial startet Katze auf Spur 2 (Mitte von 5 Spuren: 2 * 20% = 40%)
    const catHolder = () => container.querySelector('.animate-cat-hop')?.parentElement;
    expect(catHolder()?.style.left).toBe('40%');

    // Katze um 2 Spuren nach rechts auf Spur 4 bewegen (4 * 20% = 80%)
    press('ArrowRight');
    press('ArrowRight');
    expect(catHolder()?.style.left).toBe('80%');

    // Trial 0 durch Zeitablauf verpassen lassen (Flash dauert 500ms)
    act(() => {
      vi.advanceTimersByTime(TRAVEL_MS_L1 + CATCH_WINDOW_MS_L1 + 100);
    });

    // 500ms Flash ablaufen lassen, um Trial 1 zu starten
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Trial 1 läuft: Counter zeigt 1/21, Katze MUSS weiterhin auf Spur 4 (80%) stehen!
    expect(container.textContent).toContain('1 / 21');
    expect(catHolder()?.style.left).toBe('80%');
  });

  it('erlaubt Bewegung über alle 7 Spuren (0..6) in Level 4', () => {
    const { container } = renderExercise(4);
    const catHolder = () => container.querySelector('.animate-cat-hop')?.parentElement;

    // Startet in der Mitte von 7 Spuren (Spur 3: 3 * (100/7)%)
    const tileW7 = 100 / 7;
    expect(parseFloat(catHolder()?.style.left ?? '0')).toBeCloseTo(3 * tileW7, 1);

    // 3x nach links auf Spur 0 bewegen
    press('ArrowLeft');
    press('ArrowLeft');
    press('ArrowLeft');
    expect(parseFloat(catHolder()?.style.left ?? '0')).toBeCloseTo(0, 1);

    // Weitere Linksbewegung wird an Grenze 0 abgefangen
    press('ArrowLeft');
    expect(parseFloat(catHolder()?.style.left ?? '0')).toBeCloseTo(0, 1);

    // 6x nach rechts auf Spur 6 bewegen
    for (let i = 0; i < 6; i++) press('ArrowRight');
    expect(parseFloat(catHolder()?.style.left ?? '0')).toBeCloseTo(6 * tileW7, 1);

    // Weitere Rechtsbewegung wird an Grenze 6 (7-1) abgefangen
    press('ArrowRight');
    expect(parseFloat(catHolder()?.style.left ?? '0')).toBeCloseTo(6 * tileW7, 1);
  });
});


