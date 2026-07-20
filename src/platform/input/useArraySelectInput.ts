/**
 * Cursor-Auswahl über ein Array von Kandidaten (Discrimination, Number).
 *
 * Komponiert bewusst nur bestehende Primitives — keine neue Roh-Eingabe:
 * Joystick/Pfeiltasten (horizontal) bewegen einen Cursor über die
 * Kandidaten (`useDirectionalInput`), ein Arcade-Button/Enter bestätigt die
 * aktuelle Auswahl (`useConfirmInput`).
 */
import { useCallback, useState } from 'react';
import { useConfirmInput } from './useConfirmInput';
import { useDirectionalInput } from './useDirectionalInput';

/** Reine Index-Klemmfunktion (Klemmung an den Rändern, kein Wrap-Around). */
export function moveSelection(current: number, dx: number, count: number): number {
  if (count <= 0) return 0;
  if (dx === 0) return current;
  const next = current + Math.sign(dx);
  return Math.min(Math.max(next, 0), count - 1);
}

function clampIndex(index: number, itemCount: number): number {
  return Math.min(Math.max(index, 0), Math.max(itemCount - 1, 0));
}

export interface ArraySelectInputOptions {
  /** Eingabe aktiv? */
  enabled?: boolean;
  /** Auswahl-Index bei Mount / Reset. Default 0. */
  initialIndex?: number;
  /** Mindestabstand zwischen zwei Cursor-Bewegungen bei gehaltener Eingabe. */
  repeatDelayMs?: number;
  /** Ändert sich dieser Wert (z. B. Trial-Index), wird die Auswahl auf initialIndex zurückgesetzt. */
  resetKey?: unknown;
}

export function useArraySelectInput(
  itemCount: number,
  onSelect: (index: number) => void,
  { enabled = true, initialIndex = 0, repeatDelayMs = 250, resetKey }: ArraySelectInputOptions = {},
): number {
  const [selectedIndex, setSelectedIndex] = useState(() => clampIndex(initialIndex, itemCount));
  const [trackedResetKey, setTrackedResetKey] = useState(resetKey);

  // State während des Renders an Prop-Änderungen anpassen (React-Muster für
  // abgeleiteten State), statt setState in einem Effect — vermeidet einen
  // zusätzlichen Render-Zyklus. Neuer Trial (resetKey geändert) → zurück auf
  // initialIndex; schrumpft nur die Kandidatenzahl → bestehende Auswahl klemmen.
  let currentIndex = selectedIndex;
  if (resetKey !== trackedResetKey) {
    setTrackedResetKey(resetKey);
    currentIndex = clampIndex(initialIndex, itemCount);
    setSelectedIndex(currentIndex);
  } else {
    const clamped = clampIndex(selectedIndex, itemCount);
    if (clamped !== selectedIndex) {
      currentIndex = clamped;
      setSelectedIndex(clamped);
    }
  }

  useDirectionalInput(
    useCallback(
      ({ dx }) => {
        if (dx === 0) return;
        setSelectedIndex((current) => moveSelection(current, dx, itemCount));
      },
      [itemCount],
    ),
    { enabled, repeatDelayMs },
  );

  useConfirmInput(
    useCallback(() => {
      onSelect(currentIndex);
    }, [onSelect, currentIndex]),
    { enabled },
  );

  return currentIndex;
}
