// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng, createTrialRng } from '../../../platform/rng';
import { createExerciseProgress } from '../../engine';
import {
  CAT_MAX_X,
  CAT_MIN_X,
  CAT_SPEED,
  DUCK_TARGET_Y,
  INVISIBLE_VISIBLE_PROGRESS_LIMIT,
  POND_START_Y,
  catchWindowMsForLevel,
  duckPositionAt,
  isDuckVisibleInPond,
  pickDuckTrajectory,
  travelMsForLevel,
} from './anticipationEngine';
import AnticipationInvisible from './AnticipationInvisible';
import AnticipationVisible from './AnticipationVisible';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const TRAVEL_MS_L1 = travelMsForLevel(1);
const CATCH_WINDOW_MS_L1 = catchWindowMsForLevel(1);
const SEED = 'ap1-test-seed';

function trajectoryForTrial(seed: string, trialIndex: number, catX = 50) {
  return pickDuckTrajectory(createTrialRng(seed, trialIndex), catX);
}

function getCatX(container: HTMLElement): number {
  const cat = container.querySelector<HTMLElement>('[data-testid="arena-cat"]');
  if (!cat) throw new Error('arena-cat nicht gefunden');
  return parseFloat(cat.style.left);
}

function getDuckPos(container: HTMLElement): { x: number; y: number } {
  const duck = container.querySelector<HTMLElement>('[data-testid="anticipation-duck"]');
  if (!duck) throw new Error('anticipation-duck nicht gefunden');
  return {
    x: parseFloat(duck.style.left),
    y: parseFloat(duck.style.top),
  };
}

function moveCatToX(container: HTMLElement, targetX: number): number {
  const curX = getCatX(container);
  if (Math.abs(targetX - curX) <= 1) return 0;
  const key = targetX > curX ? 'ArrowRight' : 'ArrowLeft';
  let elapsed = 0;

  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  });

  for (let i = 0; i < 150; i++) {
    const x = getCatX(container);
    if ((targetX > curX && x >= targetX - 1) || (targetX < curX && x <= targetX + 1)) {
      break;
    }
    act(() => {
      vi.advanceTimersByTime(16);
    });
    elapsed += 16;
  }

  act(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { key }));
  });
  return elapsed;
}

function streakLabel(container: HTMLElement): string | null {
  return container.querySelector('[aria-label*="Sternen"]')?.getAttribute('aria-label') ?? null;
}

function renderVisible(initialLevel = 1, streak = 0) {
  const initialState =
    initialLevel > 1 || streak > 0
      ? { ...createExerciseProgress(), level: initialLevel, streak }
      : undefined;
  return render(
    <StrictMode>
      <AnticipationVisible
        ageGroup={4}
        seed={SEED}
        initialState={initialState}
        onComplete={() => {}}
        onCancel={() => {}}
      />
    </StrictMode>,
  );
}

describe('AnticipationExercise — kein Doppelzählen unter StrictMode (AP1/Befund A)', () => {
  it('verpasster Trial zählt genau einmal (Timer-Pfad)', () => {
    const { container } = renderVisible();
    expect(container.textContent).toContain('0 / 21');

    act(() => {
      vi.advanceTimersByTime(TRAVEL_MS_L1 + CATCH_WINDOW_MS_L1 + 100);
    });

    expect(container.textContent).toContain('1 / 21');
    expect(container.textContent).not.toContain('2 / 21');
  });

  it('erster richtiger Trial füllt genau 1 Stern (nicht 2) — kontinuierlicher Bewegungs-Pfad', () => {
    const traj = trajectoryForTrial(SEED, 0, 50);
    const { container } = renderVisible();
    expect(streakLabel(container)).toBe('0 von 3 Sternen bis zum nächsten Level');

    const spentMs = moveCatToX(container, traj.target.x);
    expect(spentMs).toBeLessThan(TRAVEL_MS_L1);

    // Bis zum Auftauchen vorspulen: Katze steht am Landepunkt → korrekter Trial.
    act(() => {
      vi.advanceTimersByTime(TRAVEL_MS_L1 - spentMs + 32);
    });

    expect(streakLabel(container)).toBe('1 von 3 Sternen bis zum nächsten Level');
    expect(container.textContent).toContain('1 / 21');
  });
});

describe('Anticipation — Vektor-Trajektorie & Sichtbarkeit (Issue #53 & #45, Rueda 2005)', () => {
  it('Ente schwimmt in Visible durchgehend geradlinig mit Winkel über den Teich zum Ufer', () => {
    const traj = trajectoryForTrial(SEED, 0, 50);
    const { container } = renderVisible(1);

    // Zu Beginn (t = 0): Ente oben am Startpunkt (y = 8%)
    const duckStart = getDuckPos(container);
    expect(duckStart.x).toBeCloseTo(traj.start.x, 1);
    expect(duckStart.y).toBeCloseTo(POND_START_Y, 1);

    // Nach halber Schwimmzeit (progress ≈ 0.5): Ente auf halber Geraden
    act(() => {
      vi.advanceTimersByTime(TRAVEL_MS_L1 / 2);
    });
    const expectedMid = duckPositionAt(traj, 0.5);
    const duckMid = getDuckPos(container);
    expect(duckMid.x).toBeCloseTo(expectedMid.x, 0);
    expect(duckMid.y).toBeCloseTo(expectedMid.y, 0);

    // Bei Ankunft am Ufer: Ente am Ufer-Zielpunkt
    act(() => {
      vi.advanceTimersByTime(TRAVEL_MS_L1 / 2 + 32);
    });
    const duckEnd = getDuckPos(container);
    expect(duckEnd.x).toBeCloseTo(traj.target.x, 1);
    expect(duckEnd.y).toBeCloseTo(DUCK_TARGET_Y, 1);
    expect(container.querySelector('[data-testid="duck-landing-ring"]')).not.toBeNull();
  });

  it('Ente ist in Invisible für die ersten ~35% sichtbar, taucht dann unter und erscheint am Zielpunkt wieder', () => {
    const traj = trajectoryForTrial(SEED, 0, 50);
    const { container } = render(
      <StrictMode>
        <AnticipationInvisible ageGroup={4} seed={SEED} onComplete={() => {}} onCancel={() => {}} />
      </StrictMode>,
    );

    // 1. Anfangs sichtbar, Teichabdeckung vorhanden
    expect(container.querySelector('[data-testid="anticipation-duck"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="pond-cover"]')).not.toBeNull();

    // 2. Bei ~36% der Strecke (nach 1312ms / 3600ms ≈ 0.364 >= 0.35): abgetaucht
    act(() => {
      vi.advanceTimersByTime(1312);
    });
    expect(isDuckVisibleInPond('invisible', 'approaching', 1312 / TRAVEL_MS_L1)).toBe(false);
    expect(container.querySelector('[data-testid="anticipation-duck"]')).toBeNull();
    expect(container.querySelector('[data-testid="duck-submerged-cue"]')).not.toBeNull();
    expect(INVISIBLE_VISIBLE_PROGRESS_LIMIT).toBeCloseTo(0.35, 2);

    // 3. Bei Ankunft am Ufer: Ente taucht am Zielpunkt wieder auf
    act(() => {
      vi.advanceTimersByTime(TRAVEL_MS_L1 - 1312 + 32);
    });
    const surfaced = getDuckPos(container);
    expect(surfaced.x).toBeCloseTo(traj.target.x, 1);
    expect(surfaced.y).toBeCloseTo(DUCK_TARGET_Y, 1);
  });

  it('Bewegen während approaching löst nichts vorzeitig aus; auch Fangen im Fangfenster nach Ankunft zählt', () => {
    const traj = trajectoryForTrial(SEED, 0, 50);
    const { container } = render(
      <StrictMode>
        <AnticipationInvisible ageGroup={4} seed={SEED} onComplete={() => {}} onCancel={() => {}} />
      </StrictMode>,
    );

    // Bis kurz nach Ankunft warten (im Fangfenster)
    act(() => {
      vi.advanceTimersByTime(TRAVEL_MS_L1 + 100);
    });
    expect(container.textContent).toContain('0 / 21');

    // Jetzt erst die Katze innerhalb des Fangfensters zum Ufer-Zielpunkt steuern
    moveCatToX(container, traj.target.x);
    expect(container.textContent).toContain('1 / 21');
    expect(streakLabel(container)).toBe('1 von 3 Sternen bis zum nächsten Level');
  });
});

describe('Anticipation — Timing, Erreichbarkeit & Trajektorien-Engine', () => {
  it('travelMsForLevel (3600->2400ms) und catchWindowMsForLevel (1600->1000ms) erlauben volle Uferquerung', () => {
    expect(travelMsForLevel(1)).toBe(3600);
    expect(travelMsForLevel(7)).toBe(2400);
    expect(catchWindowMsForLevel(1)).toBe(1600);
    expect(catchWindowMsForLevel(7)).toBe(1000);

    // Selbst bei kürzester Schwimmzeit (Level 7) erreicht die Katze von einer Ecke zur anderen jedes Ziel
    const fullWidthTravelMs = ((CAT_MAX_X - CAT_MIN_X) / CAT_SPEED) * 1000;
    expect(fullWidthTravelMs).toBeLessThan(travelMsForLevel(7));
  });

  it('pickDuckTrajectory erzeugt gültige, schräge Bahnen mit Abstand zur Katze', () => {
    const rng = createRng('test-seed-trajectory');
    for (let i = 0; i < 50; i++) {
      const traj = pickDuckTrajectory(rng, 50);
      expect(traj.start.x).toBeGreaterThanOrEqual(12);
      expect(traj.start.x).toBeLessThanOrEqual(88);
      expect(traj.target.x).toBeGreaterThanOrEqual(12);
      expect(traj.target.x).toBeLessThanOrEqual(88);
      expect(Math.abs(traj.target.x - 50)).toBeGreaterThanOrEqual(18);
      expect(Math.abs(traj.start.x - traj.target.x)).toBeGreaterThanOrEqual(12);
    }
  });
});

describe('Anticipation — Positionspersistenz & stabiler 500ms-Flash', () => {
  it('Katze bewegt sich stufenlos bis an die Ränder [5%, 95%] und behält ihre Position über Trials hinweg', () => {
    const { container } = renderVisible(1);
    expect(getCatX(container)).toBeCloseTo(50, 1);

    // Weit nach links bis an die Grenze CAT_MIN_X = 5%
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      vi.advanceTimersByTime(1200);
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }));
    });
    expect(getCatX(container)).toBeCloseTo(CAT_MIN_X, 1);

    // Zurück auf ca. 75% bewegen
    moveCatToX(container, 75);
    const savedX = getCatX(container);
    expect(savedX).toBeGreaterThan(70);

    // Trial 0 verpassen und 500ms Flash abwarten
    act(() => {
      vi.advanceTimersByTime(TRAVEL_MS_L1 + CATCH_WINDOW_MS_L1 + 100);
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(container.textContent).toContain('1 / 21');
    expect(getCatX(container)).toBeCloseTo(savedX, 1);
  });

  it('friert Ente und Level während der 500ms-Flash-Phase beim Level-Up (3 -> 4) ein', () => {
    const traj = trajectoryForTrial(SEED, 0, 50);
    const travelMsL3 = travelMsForLevel(3);
    const { container } = renderVisible(3, 2);

    const spentMs = moveCatToX(container, traj.target.x);
    act(() => {
      vi.advanceTimersByTime(travelMsL3 - spentMs + 32);
    });

    // Während des 500ms-Flashs bleibt die getroffene Ente am Zielpunkt eingefroren
    expect(container.textContent).toContain('😸');
    const flashDuck = getDuckPos(container);
    expect(flashDuck.x).toBeCloseTo(traj.target.x, 1);
    expect(flashDuck.y).toBeCloseTo(DUCK_TARGET_Y, 1);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(getDuckPos(container).y).toBeCloseTo(DUCK_TARGET_Y, 1);

    // Nach Ablauf von insgesamt 500ms startet der nächste Trial in Level 4 oben am Teich
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(container.textContent).toContain('Level 4');
    expect(getDuckPos(container).y).toBeLessThan(20);
  });
});
