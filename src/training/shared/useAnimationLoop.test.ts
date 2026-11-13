// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_DT_MS, useAnimationLoop } from './useAnimationLoop';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useAnimationLoop', () => {
  it('läuft deterministisch mit vi.advanceTimersByTime', () => {
    const dts: number[] = [];
    renderHook(() => useAnimationLoop((dt) => dts.push(dt), true));

    act(() => {
      vi.advanceTimersByTime(48);
    });

    expect(dts.length).toBe(3);
    for (const dt of dts) {
      expect(dt).toBeGreaterThan(0);
      expect(dt).toBeLessThanOrEqual(MAX_DT_MS);
    }
  });

  it('klemmt große Zeitsprünge (z. B. Tab-Wechsel) auf MAX_DT_MS (50ms)', () => {
    const rafQueue: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    const dts: number[] = [];
    renderHook(() => useAnimationLoop((dt) => dts.push(dt), true));

    act(() => {
      vi.advanceTimersByTime(500);
      const cb = rafQueue.shift();
      cb?.(performance.now());
    });

    expect(dts).toEqual([MAX_DT_MS]);

    act(() => {
      vi.advanceTimersByTime(16);
      const cb = rafQueue.shift();
      cb?.(performance.now());
    });

    expect(dts).toEqual([MAX_DT_MS, 16]);
  });

  it('stoppt sofort, wenn enabled auf false wechselt', () => {
    const cb = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useAnimationLoop(cb, enabled),
      { initialProps: { enabled: true } },
    );

    act(() => {
      vi.advanceTimersByTime(32);
    });
    const callsWhileEnabled = cb.mock.calls.length;
    expect(callsWhileEnabled).toBeGreaterThan(0);

    rerender({ enabled: false });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(cb.mock.calls.length).toBe(callsWhileEnabled);
  });
});
