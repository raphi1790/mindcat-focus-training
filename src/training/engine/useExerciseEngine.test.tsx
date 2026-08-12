// @vitest-environment jsdom
import { StrictMode, act, type ReactNode } from 'react';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useExerciseEngine } from './useExerciseEngine';
import { createExerciseProgress, type LevelConfig } from './exerciseProgress';

/**
 * AP6 (Fix-Plan Testrunde 1): Der Engine-Hook trägt den Resume-Anschluss —
 * `initialState` (Wiedereinstieg an einem Checkpoint) und `onLevelUp`
 * (Checkpoint nach jedem Level-Aufstieg). Beides muss StrictMode-fest sein.
 */

afterEach(cleanup);

const CONFIG: LevelConfig = { levels: 3, minTrials: 6, advanceStreak: 2 };

function strictWrapper({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}

describe('useExerciseEngine — Resume & Checkpoint (AP6)', () => {
  it('onLevelUp feuert nach jedem Level-Aufstieg mit dem neuen Zustand', () => {
    const onLevelUp = vi.fn();
    const { result } = renderHook(() => useExerciseEngine('side', CONFIG, () => {}, { onLevelUp }));

    expect(result.current.state.level).toBe(1);
    expect(onLevelUp).not.toHaveBeenCalled();

    // advanceStreak = 2 → zwei korrekte Trials steigen ein Level auf.
    act(() => result.current.recordTrial({ result: 'correct' }));
    act(() => result.current.recordTrial({ result: 'correct' }));

    expect(result.current.state.level).toBe(2);
    expect(onLevelUp).toHaveBeenCalledTimes(1);
    expect(onLevelUp.mock.calls[0]![0].level).toBe(2);

    act(() => result.current.recordTrial({ result: 'correct' }));
    act(() => result.current.recordTrial({ result: 'correct' }));

    expect(result.current.state.level).toBe(3);
    expect(onLevelUp).toHaveBeenCalledTimes(2);
    expect(onLevelUp.mock.calls[1]![0].level).toBe(3);
  });

  it('initialState setzt den Startzustand (Resume) und feuert onLevelUp nicht beim Mount', () => {
    const onLevelUp = vi.fn();
    const resume = { ...createExerciseProgress(), level: 3, totalTrials: 11, correct: 9 };
    const { result } = renderHook(() =>
      useExerciseEngine('chase', CONFIG, () => {}, { initialState: resume, onLevelUp }),
    );

    expect(result.current.state.level).toBe(3);
    expect(result.current.state.totalTrials).toBe(11);
    expect(onLevelUp).not.toHaveBeenCalled();
  });

  it('onLevelUp feuert auch unter StrictMode genau einmal pro Aufstieg', () => {
    const onLevelUp = vi.fn();
    const { result } = renderHook(
      () => useExerciseEngine('maze', CONFIG, () => {}, { onLevelUp }),
      { wrapper: strictWrapper },
    );

    act(() => result.current.recordTrial({ result: 'correct' }));
    act(() => result.current.recordTrial({ result: 'correct' }));

    expect(result.current.state.level).toBe(2);
    expect(onLevelUp).toHaveBeenCalledTimes(1);
  });
});
