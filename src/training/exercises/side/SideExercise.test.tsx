// @vitest-environment jsdom
import { StrictMode, act } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createExerciseProgress } from '../../engine';
import SideExercise from './SideExercise';
import { getStartPosition } from './maps';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function streakLabel(container: HTMLElement): string | null {
  return container.querySelector('[aria-label*="Sternen"]')?.getAttribute('aria-label') ?? null;
}

function holdKeys(keys: string[], durationMs: number) {
  act(() => {
    for (const key of keys) window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    vi.advanceTimersByTime(durationMs);
    for (const key of keys) window.dispatchEvent(new KeyboardEvent('keyup', { key }));
  });
}

describe('SideExercise — Kontinuierliche Arena (Issue #52)', () => {
  it('Level 1 Standard-Start: Katze spawnt mittig bei (50%, 50%) mit 4 Grasstreifen und 0 Schlamm', () => {
    expect(getStartPosition(1)).toEqual({ x: 50, y: 50 });
    const { container, getByTestId, queryAllByTestId } = render(
      <SideExercise ageGroup={6} seed="test-seed" onComplete={() => {}} onCancel={() => {}} />,
    );

    const cat = getByTestId('arena-cat');
    expect(cat.style.left).toBe('50%');
    expect(cat.style.top).toBe('50%');
    expect(cat.textContent).toContain('🐱');
    expect(queryAllByTestId('side-grass')).toHaveLength(4);
    expect(queryAllByTestId('side-mud')).toHaveLength(0);
    expect(queryAllByTestId('side-puddle')).toHaveLength(0);
    expect(container.textContent).toContain('Level 1');
  });

  it('Level 5 Resume: gerader Weg links trifft innere Schlammpfütze, Umweg nach oben-links erreicht Gras', () => {
    const initialState = { ...createExerciseProgress(5), level: 5 };
    const { container, getByTestId, queryAllByTestId } = render(
      <SideExercise
        ageGroup={6}
        seed="test-seed"
        initialState={initialState}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );

    const cat = getByTestId('arena-cat');
    expect(cat.style.left).toBe('50%');
    expect(cat.style.top).toBe('50%');
    expect(container.textContent).toContain('Level 5');
    expect(queryAllByTestId('side-puddle').length).toBeGreaterThan(0);

    // Kurze Bewegung nach links bleibt im sicheren Bereich
    holdKeys(['ArrowLeft'], 160);
    expect(parseFloat(cat.style.left)).toBeLessThan(50);
    expect(cat.textContent).not.toContain('🙀');

    // Weiter geradeaus nach links trifft die innere Schlammpfütze -> Fehler + Reset
    holdKeys(['ArrowLeft'], 400);
    expect(cat.textContent).toContain('🙀');
    expect(streakLabel(container)).toBe('0 von 3 Sternen bis zum nächsten Level');

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(cat.style.left).toBe('50%');
    expect(cat.style.top).toBe('50%');

    // Umweg: zuerst nach oben über die Pfütze (y ≈ 24 %), dann links ins linke Grasfeld
    holdKeys(['ArrowUp'], 580);
    holdKeys(['ArrowLeft'], 900);
    expect(cat.textContent).toContain('😸');
    expect(streakLabel(container)).toBe('1 von 3 Sternen bis zum nächsten Level');
  });

  it('Level 7 Slalom: gerader Weg nach oben trifft zentrale Pfütze, Slalom außen herum erreicht oberes Gras', () => {
    const initialState = { ...createExerciseProgress(7), level: 7 };
    const { container, getByTestId, queryAllByTestId } = render(
      <SideExercise
        ageGroup={6}
        seed="test-seed"
        initialState={initialState}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(queryAllByTestId('side-puddle')).toHaveLength(3);
    const cat = getByTestId('arena-cat');

    // Geradeaus nach oben trifft die zentrale Pfütze (y: 22..35)
    holdKeys(['ArrowUp'], 450);
    expect(cat.textContent).toContain('🙀');
    expect(streakLabel(container)).toBe('0 von 3 Sternen bis zum nächsten Level');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Slalom: hoch auf y≈40%, links an der Barriere vorbei auf x≈18%, hoch auf y≈16%, rechts und hoch ins Ziel
    holdKeys(['ArrowUp'], 220);
    holdKeys(['ArrowLeft'], 700);
    holdKeys(['ArrowUp'], 540);
    holdKeys(['ArrowRight'], 600);
    holdKeys(['ArrowUp'], 220);
    expect(cat.textContent).toContain('😸');
    expect(streakLabel(container)).toBe('1 von 3 Sternen bis zum nächsten Level');
  });

  it('Schlamm-Kontakt in Level 2 löst Fehler-Feedback aus und setzt Katze nach 500ms zurück', () => {
    const initialState = { ...createExerciseProgress(2), level: 2 };
    const { container, getByTestId } = render(
      <SideExercise
        ageGroup={6}
        seed="test-seed"
        initialState={initialState}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );

    // Level 2: unten (y >= 90) ist Schlamm
    holdKeys(['ArrowDown'], 950);
    expect(getByTestId('arena-cat').textContent).toContain('🙀');
    expect(streakLabel(container)).toBe('0 von 3 Sternen bis zum nächsten Level');

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(getByTestId('arena-cat').textContent).toContain('🐱');
    expect(getByTestId('arena-cat').style.left).toBe('50%');
    expect(getByTestId('arena-cat').style.top).toBe('50%');
  });

  it('unterstützt 8-Wege-Diagonalbewegung mit normierter Geschwindigkeit und StrictMode ohne Doppelzählung', () => {
    const { container, getByTestId } = render(
      <StrictMode>
        <SideExercise ageGroup={4} seed="test-seed" onComplete={() => {}} onCancel={() => {}} />
      </StrictMode>,
    );

    // Kurzer diagonaler Schritt nach oben-rechts: beide Achsen ändern sich gleich stark (~0.707 * v * t)
    holdKeys(['ArrowUp', 'ArrowRight'], 200);
    const cat = getByTestId('arena-cat');
    const x = parseFloat(cat.style.left);
    const y = parseFloat(cat.style.top);
    expect(x).toBeGreaterThan(50);
    expect(y).toBeLessThan(50);
    // Distanz nach 200ms bei 45%/s ≈ 9% (nicht ~12.7% wie unnormiert)
    const dist = Math.hypot(x - 50, y - 50);
    expect(dist).toBeGreaterThan(6);
    expect(dist).toBeLessThan(10.5);

    // Weiter nach oben ins obere Grasfeld → genau 1 Stern unter StrictMode
    holdKeys(['ArrowUp'], 900);
    expect(cat.textContent).toContain('😸');
    expect(streakLabel(container)).toBe('1 von 3 Sternen bis zum nächsten Level');
  });
});
