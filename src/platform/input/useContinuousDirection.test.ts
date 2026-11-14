// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeDirection, useContinuousDirection } from './useContinuousDirection';

let rafQueue: FrameRequestCallback[] = [];

function flushRaf(time = 16) {
  const queue = rafQueue;
  rafQueue = [];
  for (const cb of queue) cb(time);
}

beforeEach(() => {
  rafQueue = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('normalizeDirection', () => {
  it('liefert {0, 0} bei neutraler Eingabe ohne -0', () => {
    const dir = normalizeDirection(-0, 0);
    expect(dir).toEqual({ dx: 0, dy: 0 });
    expect(Object.is(dir.dx, -0)).toBe(false);
  });

  it('lässt orthogonale Richtungen auf Länge 1', () => {
    expect(normalizeDirection(1, 0)).toEqual({ dx: 1, dy: 0 });
    expect(normalizeDirection(-5, 0)).toEqual({ dx: -1, dy: 0 });
    expect(normalizeDirection(0, 1)).toEqual({ dx: 0, dy: 1 });
    expect(normalizeDirection(0, -3)).toEqual({ dx: 0, dy: -1 });
  });

  it('normiert Diagonalen mit Math.SQRT1_2 auf Einheitslänge', () => {
    const dir = normalizeDirection(1, -1);
    expect(dir.dx).toBeCloseTo(Math.SQRT1_2, 10);
    expect(dir.dy).toBeCloseTo(-Math.SQRT1_2, 10);
    expect(Math.hypot(dir.dx, dir.dy)).toBeCloseTo(1, 10);
  });
});

describe('useContinuousDirection', () => {
  it('unterstützt Pfeiltasten und WASD inklusive 8-Wege-Diagonalen', () => {
    const { result } = renderHook(() => useContinuousDirection());
    expect(result.current.current).toEqual({ dx: 0, dy: 0 });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(result.current.current).toEqual({ dx: 1, dy: 0 });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    });
    expect(result.current.current.dx).toBeCloseTo(Math.SQRT1_2);
    expect(result.current.current.dy).toBeCloseTo(-Math.SQRT1_2);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
    });
    expect(result.current.current).toEqual({ dx: 0, dy: -1 });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }));
    });
    expect(result.current.current).toEqual({ dx: 0, dy: 0 });

    // WASD (inkl. Großbuchstaben durch Shift)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'W' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    expect(result.current.current.dx).toBeCloseTo(-Math.SQRT1_2);
    expect(result.current.current.dy).toBeCloseTo(-Math.SQRT1_2);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
    });
    expect(result.current.current).toEqual({ dx: 0, dy: 0 });
  });

  it('hebt gegenläufige Tasten auf und ignoriert OS-Shortcuts', () => {
    const { result } = renderHook(() => useContinuousDirection());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(result.current.current).toEqual({ dx: 0, dy: 0 });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', metaKey: true }));
    });
    expect(result.current.current).toEqual({ dx: 0, dy: 0 });
  });

  it('liest Gamepad-Achsen/Buttons im rAF-Loop und normiert Diagonalen', () => {
    const fakePad = {
      axes: [0.9, 0.9],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
    };
    const getGamepadsSpy = vi.fn(() => [fakePad as unknown as Gamepad]);
    Object.defineProperty(navigator, 'getGamepads', {
      value: getGamepadsSpy,
      configurable: true,
    });

    const { result } = renderHook(() => useContinuousDirection());
    act(() => flushRaf(16));

    expect(result.current.current.dx).toBeCloseTo(Math.SQRT1_2);
    expect(result.current.current.dy).toBeCloseTo(Math.SQRT1_2);

    fakePad.axes = [0, 0];
    act(() => flushRaf(32));
    expect(result.current.current).toEqual({ dx: 0, dy: 0 });
  });

  it('setzt bei window blur und document visibilitychange sofort auf {0, 0} zurück', () => {
    const { result } = renderHook(() => useContinuousDirection());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    });
    expect(result.current.current).toEqual({ dx: 1, dy: 0 });

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(result.current.current).toEqual({ dx: 0, dy: 0 });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    });
    expect(result.current.current).toEqual({ dx: 0, dy: 1 });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.current).toEqual({ dx: 0, dy: 0 });
  });

  it('setzt bei enabled=false sofort zurück und ignoriert Eingaben währenddessen', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useContinuousDirection({ enabled }),
      { initialProps: { enabled: true } },
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    });
    expect(result.current.current).toEqual({ dx: 0, dy: 1 });

    rerender({ enabled: false });
    expect(result.current.current).toEqual({ dx: 0, dy: 0 });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    });
    expect(result.current.current).toEqual({ dx: 0, dy: 0 });
  });
});
