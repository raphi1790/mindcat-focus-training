/**
 * Kontinuierliche 8-Wege-Eingabe (Vektor im Bereich [-1, 1] mit Diagonal-Normierung).
 *
 * Unterstützt Pfeiltasten, WASD sowie Gamepad/Arcade-Joystick. Im Unterschied zu
 * `useDirectionalInput` (diskrete Schritt-Wiederholung) liefert dieser Hook einen
 * jederzeit lesbaren Richtungs-Ref für die `requestAnimationFrame`-Schleife.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { connectedGamepads, directionFromGamepad } from './gamepad';

export interface ContinuousDirection {
  dx: number;
  dy: number;
}

export interface ContinuousDirectionOptions {
  /** Eingabe aktiv? Bei `false` (z. B. während 500ms-Feedback) wird sofort auf {0, 0} zurückgesetzt. */
  enabled?: boolean;
}

const ZERO_DIR: ContinuousDirection = { dx: 0, dy: 0 };

const TRACKED_KEYS = new Set([
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'w',
  'a',
  's',
  'd',
]);

const ARROW_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

/**
 * Normalisiert einen Roh-Richtungsvektor auf Einheitslänge bei Diagonalen
 * (Faktor `Math.SQRT1_2`), damit schräge Bewegung nicht √2-mal schneller ist.
 */
export function normalizeDirection(dx: number, dy: number): ContinuousDirection {
  const sx = dx === 0 ? 0 : Math.sign(dx);
  const sy = dy === 0 ? 0 : Math.sign(dy);
  if (sx !== 0 && sy !== 0) {
    return { dx: sx * Math.SQRT1_2, dy: sy * Math.SQRT1_2 };
  }
  return { dx: sx, dy: sy };
}

function directionFromKeys(pressed: ReadonlySet<string>): ContinuousDirection {
  const up = pressed.has('arrowup') || pressed.has('w');
  const down = pressed.has('arrowdown') || pressed.has('s');
  const left = pressed.has('arrowleft') || pressed.has('a');
  const right = pressed.has('arrowright') || pressed.has('d');
  return {
    dx: (right ? 1 : 0) - (left ? 1 : 0),
    dy: (down ? 1 : 0) - (up ? 1 : 0),
  };
}

export function useContinuousDirection(
  { enabled = true }: ContinuousDirectionOptions = {},
): RefObject<ContinuousDirection> {
  const dirRef = useRef<ContinuousDirection>({ ...ZERO_DIR });
  const pressedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pressed = pressedKeysRef.current;

    const reset = () => {
      pressed.clear();
      dirRef.current = { ...ZERO_DIR };
    };

    if (!enabled) {
      reset();
      return;
    }

    const updateFromInputs = () => {
      let { dx, dy } = directionFromKeys(pressed);
      for (const gp of connectedGamepads()) {
        const gpDir = directionFromGamepad(gp);
        if (gpDir.dx !== 0) dx = gpDir.dx;
        if (gpDir.dy !== 0) dy = gpDir.dy;
      }
      dirRef.current = normalizeDirection(dx, dy);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (!TRACKED_KEYS.has(key)) return;
      if (ARROW_KEYS.has(key)) e.preventDefault();
      pressed.add(key);
      updateFromInputs();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (!TRACKED_KEYS.has(key)) return;
      pressed.delete(key);
      updateFromInputs();
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', reset);

    let active = true;
    let rafId = 0;
    const poll = () => {
      if (!active) return;
      updateFromInputs();
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);

    return () => {
      active = false;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', reset);
      cancelAnimationFrame(rafId);
      reset();
    };
  }, [enabled]);

  return dirRef;
}
