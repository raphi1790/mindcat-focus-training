// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createExerciseProgress } from '../../engine';
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
});
