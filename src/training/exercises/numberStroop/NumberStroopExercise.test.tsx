// @vitest-environment jsdom
import { act } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTrialRng } from '../../../platform/rng';
import { createExerciseProgress } from '../../engine';
import { generateStroopTrial } from './generator';
import NumberStroopExercise from './NumberStroopExercise';

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('NumberStroopExercise (AP5)', () => {
  it('rendert die verstärkte visuelle Instruktion mit Mengen-Icons (📦, 📊)', () => {
    const { container } = render(
      <NumberStroopExercise ageGroup={4} seed="stroop-test-seed" onComplete={() => {}} onCancel={() => {}} />,
    );

    expect(container.textContent).toContain('Welche Seite hat MEHR Gegenstände?');
    expect(container.textContent).toContain('zähle, wo MEHR Dinge sind!');
    expect(container.textContent).toContain('📦');
    expect(container.textContent).toContain('📊');
  });

  it('Level 1: rendert Apfel-Cluster (🍎)', () => {
    const { container } = render(
      <NumberStroopExercise
        ageGroup={4}
        seed="stroop-test-seed"
        initialState={{ ...createExerciseProgress(), level: 1 }}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(container.textContent).toContain('🍎');
  });

  it('Level 3: rendert Ziffern-Cluster (keine Äpfel)', () => {
    const { container } = render(
      <NumberStroopExercise
        ageGroup={4}
        seed="stroop-test-seed"
        initialState={{ ...createExerciseProgress(), level: 3 }}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(container.textContent).not.toContain('🍎');
  });

  it('behält die Zahlen der aktuellen Runde während der 500ms Feedback-Phase bei und wechselt erst danach', () => {
    const seed = 'stroop-flash-seed';
    const trial0 = generateStroopTrial(createTrialRng(seed, 0), 3);
    const trial1 = generateStroopTrial(createTrialRng(seed, 1), 3);
    const expectedText0 = `${String(trial0.left.symbol).repeat(trial0.left.count)}vs${String(trial0.right.symbol).repeat(trial0.right.count)}`;
    const expectedText1 = `${String(trial1.left.symbol).repeat(trial1.left.count)}vs${String(trial1.right.symbol).repeat(trial1.right.count)}`;
    expect(expectedText0).not.toBe(expectedText1);

    const { container } = render(
      <NumberStroopExercise
        ageGroup={4}
        seed={seed}
        initialState={{ ...createExerciseProgress(), level: 3 }}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(container.textContent).toContain(expectedText0);

    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
    });

    // Unmittelbar nach Tastendruck und während der 500ms-Feedback-Phase bleibt Runde 0 sichtbar
    expect(container.textContent).toContain(expectedText0);
    expect(container.textContent).not.toContain(expectedText1);

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(container.textContent).toContain(expectedText0);
    expect(container.textContent).not.toContain(expectedText1);

    // Nach Ablauf von FLASH_MS (500ms) erscheint Runde 1
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container.textContent).toContain(expectedText1);
  });
});
