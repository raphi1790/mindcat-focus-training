// @vitest-environment jsdom
import { StrictMode, act } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createExerciseProgress } from '../../engine/exerciseProgress';
import ChaseExercise from './ChaseExercise';
import { timeLimitForLevel } from './collision';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const SEED = 'continuous-chase-seed';

function streakLabel(container: HTMLElement): string | null {
  return container.querySelector('[aria-label*="Sternen"]')?.getAttribute('aria-label') ?? null;
}

function readPos(el: HTMLElement): { x: number; y: number } {
  return { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
}

/** Steuert die Katze in 50ms-Schritten auf den sichtbaren Regenschirm zu, bis er gefangen wird. */
function chaseUntilCaught(getByTestId: (id: string) => HTMLElement, maxSteps = 120) {
  for (let i = 0; i < maxSteps; i++) {
    const cat = getByTestId('arena-cat');
    if (cat.textContent?.includes('😸')) return;

    const catPos = readPos(cat);
    const targetPos = readPos(getByTestId('chase-umbrella'));
    const keys: string[] = [];
    if (targetPos.x - catPos.x > 1.5) keys.push('ArrowRight');
    else if (catPos.x - targetPos.x > 1.5) keys.push('ArrowLeft');
    if (targetPos.y - catPos.y > 1.5) keys.push('ArrowDown');
    else if (catPos.y - targetPos.y > 1.5) keys.push('ArrowUp');

    act(() => {
      for (const k of keys) window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
      vi.advanceTimersByTime(50);
      for (const k of keys) window.dispatchEvent(new KeyboardEvent('keyup', { key: k }));
    });
  }
  throw new Error('Katze konnte den Schirm innerhalb maxSteps nicht fangen');
}

describe('ChaseExercise — Kontinuierliche Arena & StrictMode', () => {
  it('fängt den Schirm per Hitbox-Überlappung und zählt unter StrictMode genau 1 Stern', () => {
    const { container, getByTestId } = render(
      <StrictMode>
        <ChaseExercise ageGroup={4} seed={SEED} onComplete={() => {}} onCancel={() => {}} />
      </StrictMode>,
    );

    expect(streakLabel(container)).toBe('0 von 3 Sternen bis zum nächsten Level');
    chaseUntilCaught(getByTestId);
    expect(streakLabel(container)).toBe('1 von 3 Sternen bis zum nächsten Level');
  });

  it('bewegt den Schirm kontinuierlich innerhalb 0..100 % und meldet Timeout nach Zeitlimit', () => {
    const { container, getByTestId } = render(
      <ChaseExercise ageGroup={4} seed={SEED} onComplete={() => {}} onCancel={() => {}} />,
    );

    const startPos = readPos(getByTestId('chase-umbrella'));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    const movedPos = readPos(getByTestId('chase-umbrella'));
    expect(Math.hypot(movedPos.x - startPos.x, movedPos.y - startPos.y)).toBeGreaterThan(1);
    expect(movedPos.x).toBeGreaterThanOrEqual(0);
    expect(movedPos.x).toBeLessThanOrEqual(100);
    expect(movedPos.y).toBeGreaterThanOrEqual(0);
    expect(movedPos.y).toBeLessThanOrEqual(100);

    // Restzeit bis Timeout ablaufen lassen
    act(() => {
      vi.advanceTimersByTime(timeLimitForLevel(1));
    });
    expect(getByTestId('arena-cat').textContent).toContain('🙀');
    expect(streakLabel(container)).toBe('0 von 3 Sternen bis zum nächsten Level');

    // Nach 500ms FLASH_MS startet der nächste Trial in der Mitte
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const resetCat = getByTestId('arena-cat');
    expect(resetCat.textContent).toContain('🐱');
    expect(resetCat.style.left).toBe('50%');
    expect(resetCat.style.top).toBe('50%');
  });

  it('hält die Katze beim Catch für die vollen 500ms FLASH_MS auf der Schirm-Position (Issue #44)', () => {
    const { getByTestId } = render(
      <ChaseExercise ageGroup={4} seed={SEED} onComplete={() => {}} onCancel={() => {}} />,
    );

    chaseUntilCaught(getByTestId);

    const umbrella = getByTestId('chase-umbrella');
    const catDuringFlash = getByTestId('arena-cat');
    expect(catDuringFlash.textContent).toContain('😸');
    expect(catDuringFlash.style.left).toBe(umbrella.style.left);
    expect(catDuringFlash.style.top).toBe(umbrella.style.top);

    // Nach 400ms (noch in der 500ms-Feierphase) steht die Katze weiterhin am Fangort
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(getByTestId('arena-cat').textContent).toContain('😸');
    expect(getByTestId('arena-cat').style.left).toBe(umbrella.style.left);
    expect(getByTestId('arena-cat').style.top).toBe(umbrella.style.top);

    // Erst nach Ablauf der vollen 500ms startet der nächste Trial bei (50%, 50%)
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(getByTestId('arena-cat').textContent).toContain('🐱');
    expect(getByTestId('arena-cat').style.left).toBe('50%');
    expect(getByTestId('arena-cat').style.top).toBe('50%');
  });

  it('zeigt Geschwindigkeits-Icon (⚡ / 💨⚡) und Wind-Schirm (💨🌂) auf höheren Leveln', () => {
    const level2 = render(
      <ChaseExercise
        ageGroup={4}
        seed={SEED}
        initialState={{ ...createExerciseProgress(2), level: 2 }}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(level2.container.textContent).toContain('⚡');
    cleanup();

    const level4 = render(
      <ChaseExercise
        ageGroup={4}
        seed={SEED}
        initialState={{ ...createExerciseProgress(4), level: 4 }}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(level4.container.textContent).toContain('💨⚡');
    expect(level4.container.textContent).toContain('💨🌂');
  });
});
