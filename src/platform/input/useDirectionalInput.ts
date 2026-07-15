/**
 * 8-Wege-Eingabe für Navigations-Übungen (Side, Chase, Maze, …).
 *
 * Tastatur (Pfeiltasten) + Gamepad/Arcade werden in einer rAF-Schleife
 * zusammengeführt; gehaltene Eingaben wiederholen sich im Abstand von
 * `repeatDelayMs`. Für RT-kritische Wahlreaktionen (ANT) stattdessen
 * useChoiceInput verwenden — dort zählt der Event-Zeitstempel.
 */
import { useEffect, useRef } from 'react';
import { connectedGamepads, directionFromGamepad, type Direction } from './gamepad';

export interface DirectionalInputOptions {
  /** Eingabe aktiv? (z. B. false während Feedback-Animationen) */
  enabled?: boolean;
  /** Mindestabstand zwischen zwei Bewegungen bei gehaltener Eingabe. */
  repeatDelayMs?: number;
}

const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
type ArrowKey = (typeof ARROW_KEYS)[number];

export function useDirectionalInput(
  onMove: (direction: Direction) => void,
  { enabled = true, repeatDelayMs = 200 }: DirectionalInputOptions = {},
): void {
  const keys = useRef<Record<ArrowKey, boolean>>({
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
  });
  const lastMoveTime = useRef(0);
  const enabledRef = useRef(enabled);
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    const isArrowKey = (key: string): key is ArrowKey =>
      (ARROW_KEYS as readonly string[]).includes(key);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isArrowKey(e.key)) {
        e.preventDefault(); // Scrollen verhindern
        keys.current[e.key] = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (isArrowKey(e.key)) {
        keys.current[e.key] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);

    let rafId: number;
    const loop = (time: number) => {
      let dx = 0;
      let dy = 0;

      if (keys.current.ArrowUp) dy -= 1;
      if (keys.current.ArrowDown) dy += 1;
      if (keys.current.ArrowLeft) dx -= 1;
      if (keys.current.ArrowRight) dx += 1;

      for (const gp of connectedGamepads()) {
        const dir = directionFromGamepad(gp);
        if (dir.dx !== 0) dx = dir.dx;
        if (dir.dy !== 0) dy = dir.dy;
      }

      const sx = Math.sign(dx);
      const sy = Math.sign(dy);

      if (enabledRef.current && (sx !== 0 || sy !== 0)) {
        if (time - lastMoveTime.current > repeatDelayMs) {
          onMoveRef.current({ dx: sx as Direction['dx'], dy: sy as Direction['dy'] });
          lastMoveTime.current = time;
        }
      } else if (sx === 0 && sy === 0) {
        // Ohne Eingabe Timer zurücksetzen → nächster Tastendruck wirkt sofort
        lastMoveTime.current = 0;
      }

      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(rafId);
    };
  }, [repeatDelayMs]);
}
