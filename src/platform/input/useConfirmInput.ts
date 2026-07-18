/**
 * "Bestätigen"-Eingabe für Menüs (z. B. Kinder-Auswahl-Screen).
 *
 * Tastatur: Enter/Leertaste (keydown, kein Auto-Repeat).
 * Gamepad/Arcade: beliebiger Arcade-Button (Rising-Edge, s. gamepad.ts) —
 * anders als beim ANT (useChoiceInput) gibt es hier keine L/R-Semantik.
 */
import { useEffect, useRef } from 'react';
import { confirmPressedFromGamepad, connectedGamepads } from './gamepad';

export interface ConfirmInputOptions {
  /** Eingabe aktiv? */
  enabled?: boolean;
}

export function useConfirmInput(
  onConfirm: () => void,
  { enabled = true }: ConfirmInputOptions = {},
): void {
  const enabledRef = useRef(enabled);
  const onConfirmRef = useRef(onConfirm);
  const wasPressed = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      wasPressed.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current || e.repeat) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        onConfirmRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { passive: false });

    let rafId: number;
    const poll = () => {
      const isPressed = connectedGamepads().some((gp) => confirmPressedFromGamepad(gp));
      const isRisingEdge = isPressed && !wasPressed.current;
      wasPressed.current = isPressed;

      if (enabledRef.current && isRisingEdge) {
        onConfirmRef.current();
      }

      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(rafId);
    };
  }, []);
}
