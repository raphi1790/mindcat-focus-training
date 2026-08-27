// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExerciseResult } from '../../data/schema';
import { soundManager } from '../../ui';
import ExerciseCompletionModal from './ExerciseCompletionModal';

const sampleResult: ExerciseResult = {
  exerciseId: 'chase',
  levelsCompleted: 7,
  highestLevel: 7,
  trials: 21,
  correct: 21,
  errors: 0,
  missed: 0,
  trialToAdvanceRate: 3,
  durationMs: 30000,
  perLevel: [{ level: 1, trials: 3, correct: 3, errors: 0 }],
};

const moderateResult: ExerciseResult = {
  exerciseId: 'side',
  levelsCompleted: 7,
  highestLevel: 7,
  trials: 30,
  correct: 24,
  errors: 6,
  missed: 0,
  trialToAdvanceRate: 4.2,
  durationMs: 45000,
  perLevel: [{ level: 1, trials: 4, correct: 3, errors: 1 }],
};

const strugglingResult: ExerciseResult = {
  exerciseId: 'side',
  levelsCompleted: 7,
  highestLevel: 7,
  trials: 60,
  correct: 25,
  errors: 35,
  missed: 0,
  trialToAdvanceRate: 8.5,
  durationMs: 80000,
  perLevel: [{ level: 1, trials: 10, correct: 5, errors: 5 }],
};

describe('ExerciseCompletionModal', () => {
  beforeEach(() => {
    vi.spyOn(soundManager, 'play').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('rendert Dialog mit Icon, Überschrift, Level-Badge und Statistiken', () => {
    const onClose = vi.fn();
    render(<ExerciseCompletionModal result={sampleResult} onClose={onClose} />);

    // Dialog & Accessibility
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Geschafft!')).toBeDefined();
    expect(screen.getByText('Chase (Verfolgung)')).toBeDefined();
    expect(screen.getByTestId('completion-icon').textContent).toBe('🌂');

    // Level-Badge
    expect(screen.getByTestId('level-badge').textContent).toContain('Level 7 erreicht!');

    // Stats
    expect(screen.getByTestId('stat-trials').textContent).toContain('21');
    expect(screen.getByTestId('stat-correct').textContent).toContain('21 (100%)');
  });

  it('spielt beim Mounten die Fanfare ab', () => {
    const onClose = vi.fn();
    render(<ExerciseCompletionModal result={sampleResult} onClose={onClose} />);

    expect(soundManager.play).toHaveBeenCalledWith('fanfare');
  });

  it('blendet Sterne gestaffelt ein und spielt Sound pro Stern', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    render(<ExerciseCompletionModal result={sampleResult} onClose={onClose} />);

    // Direkt nach Mount: Fanfare gerufen, aber Sterne noch 0 gezeigt
    expect(soundManager.play).toHaveBeenCalledWith('fanfare');

    // Nach erstem Stagger-Intervall: 1. Stern
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(soundManager.play).toHaveBeenCalledWith('star');
    expect(screen.getByTestId('star-1').className).toContain('animate-pop');

    // Nach zweitem Stagger-Intervall: 2. Stern
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(screen.getByTestId('star-2').className).toContain('animate-pop');

    // Nach drittem Stagger-Intervall: 3. Stern
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(screen.getByTestId('star-3').className).toContain('animate-pop');
  });

  it('berechnet 2 Sterne für moderate Ergebnisse', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    render(<ExerciseCompletionModal result={moderateResult} onClose={onClose} />);

    expect(screen.getByTestId('stars-container').getAttribute('aria-label')).toBe(
      '2 von 3 Sternen',
    );

    // Alle gestaffelten Timer ablaufen lassen
    act(() => {
      vi.advanceTimersByTime(350);
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByTestId('star-1').className).toContain('animate-pop');
    expect(screen.getByTestId('star-2').className).toContain('animate-pop');
    expect(screen.getByTestId('star-3').className).toContain('opacity-25 grayscale');
  });

  it('berechnet 1 Stern für schwächere Ergebnisse', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    render(<ExerciseCompletionModal result={strugglingResult} onClose={onClose} />);

    expect(screen.getByTestId('stars-container').getAttribute('aria-label')).toBe(
      '1 von 3 Sternen',
    );

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByTestId('star-1').className).toContain('animate-pop');
    expect(screen.getByTestId('star-2').className).toContain('opacity-25 grayscale');
    expect(screen.getByTestId('star-3').className).toContain('opacity-25 grayscale');
  });

  it('ruft onClose beim Klick auf den Bestätigen-Button auf', () => {
    const onClose = vi.fn();
    render(<ExerciseCompletionModal result={sampleResult} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: /Zurück zur Übersicht/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reagiert auf Enter- und Leertaste zum Schließen', () => {
    const onClose = vi.fn();
    render(<ExerciseCompletionModal result={sampleResult} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: ' ' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('unterstützt optionalen Neustart-Button (onRestart)', () => {
    const onClose = vi.fn();
    const onRestart = vi.fn();

    const { rerender } = render(
      <ExerciseCompletionModal result={sampleResult} onClose={onClose} />,
    );
    expect(screen.queryByRole('button', { name: /Nochmal spielen/i })).toBeNull();

    rerender(
      <ExerciseCompletionModal
        result={sampleResult}
        onClose={onClose}
        onRestart={onRestart}
      />,
    );

    const restartButton = screen.getByRole('button', { name: /Nochmal spielen/i });
    expect(restartButton).toBeDefined();

    fireEvent.click(restartButton);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('schließt automatisch nach Ablauf von autoCloseMs, falls gesetzt', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    render(
      <ExerciseCompletionModal
        result={sampleResult}
        onClose={onClose}
        autoCloseMs={4000}
      />,
    );

    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('übernimmt explizites exerciseId-Prop falls angegeben', () => {
    const onClose = vi.fn();
    render(
      <ExerciseCompletionModal
        exerciseId="farmer"
        result={sampleResult}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('Farmer (Go/No-Go)')).toBeDefined();
    expect(screen.getByTestId('completion-icon').textContent).toBe('🐑');
  });
});
