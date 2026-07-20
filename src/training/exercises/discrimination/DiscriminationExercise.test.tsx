// @vitest-environment jsdom
import { act } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DiscriminationExercise from './DiscriminationExercise';

// jsdom implementiert kein requestAnimationFrame — von useDirectionalInput/
// useConfirmInput (Gamepad-Polling in useArraySelectInput) beim Mount
// benötigt. Dieser Test simuliert keine Eingabe, ein No-Op-Stub genügt.
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

const TEMPLATE_SELECTOR = '[data-testid="discrimination-template"]';
// Spiegelt STUDY_MS / delayMsForLevel(1) aus DiscriminationExercise.tsx.
const STUDY_MS = 1500;
const DELAY_MS_LEVEL_1 = 1200;

function renderExercise(hasDelay: boolean) {
  return render(
    <DiscriminationExercise ageGroup={4} seed="ap2-test-seed" hasDelay={hasDelay} onComplete={() => {}} onCancel={() => {}} />,
  );
}

describe('DiscriminationExercise — Vorlage in der Choose-Phase (AP2, Befund F)', () => {
  it('Delay-Variante: Vorlage → Delay (❓) → Auswahl ohne Vorlage', () => {
    const { container } = renderExercise(true);

    expect(container.querySelector(TEMPLATE_SELECTOR)).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(STUDY_MS);
    });
    expect(container.querySelector(TEMPLATE_SELECTOR)).toBeNull();
    expect(container.textContent).toContain('❓');

    act(() => {
      vi.advanceTimersByTime(DELAY_MS_LEVEL_1);
    });
    expect(container.querySelector(TEMPLATE_SELECTOR)).toBeNull();
  });

  it('Variante ohne Delay: Vorlage bleibt während der Auswahl sichtbar', () => {
    const { container } = renderExercise(false);

    expect(container.querySelector(TEMPLATE_SELECTOR)).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(STUDY_MS);
    });
    expect(container.querySelector(TEMPLATE_SELECTOR)).not.toBeNull();
  });
});
