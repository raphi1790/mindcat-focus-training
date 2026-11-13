/**
 * Leichtgewichtiger `requestAnimationFrame`-Hook mit Delta-Time-Clamping.
 *
 * Begrenzt `dtMs` auf `maxDtMs` (Standard 50 ms), damit Tab-Wechsel oder
 * Browser-Pausen keine Sprite-Sprünge verursachen. Funktioniert deterministisch
 * mit Vitests Fake-Timern (`vi.advanceTimersByTime`) in JSDOM.
 */
import { useEffect, useRef } from 'react';

export const MAX_DT_MS = 50;

export function useAnimationLoop(
  callback: (dtMs: number) => void,
  enabled: boolean,
  maxDtMs: number = MAX_DT_MS,
): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    let lastTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      if (!active) return;
      const dtMs = Math.min(Math.max(0, now - lastTime), maxDtMs);
      lastTime = now;
      callbackRef.current(dtMs);
      if (active) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
    };
  }, [enabled, maxDtMs]);
}
