import { useEffect, useRef, useState } from 'react';
import { soundManager } from './sound/soundManager';

/**
 * Gemeinsames Feedback-Verhalten aller Trainingsübungen (Plan §6.3):
 * Erfolgs-/Fehler-Sound beim Trial-Feedback und Level-Up-Erkennung
 * (Fanfare + kurzes Overlay-Fenster). Greift nicht in die Engine-Logik ein —
 * beobachtet nur `level` und `flash`.
 */

const LEVEL_UP_MS = 1500;

export type TrialFlash = 'success' | 'error' | null;

export function useGameFeel(level: number, flash: TrialFlash): { levelUp: boolean } {
  const [levelUp, setLevelUp] = useState(false);
  const prevLevel = useRef(level);
  const prevFlash = useRef<TrialFlash>(flash);
  // Auto-Hide-Timer im Ref, NICHT als Effect-Cleanup: der Effect läuft auch
  // bei jeder flash-Änderung erneut, und ein Cleanup würde den laufenden
  // Timer löschen → Overlay bliebe für immer sichtbar.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const leveled = level > prevLevel.current;
    const flashChanged = flash !== prevFlash.current;
    prevLevel.current = level;
    prevFlash.current = flash;

    if (leveled) {
      // Level-Up ersetzt den normalen Erfolgs-Sound (kein Doppel-Klang).
      soundManager.play('levelUp');
      setLevelUp(true);
      if (hideTimer.current !== null) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        hideTimer.current = null;
        setLevelUp(false);
      }, LEVEL_UP_MS);
      return;
    }

    if (flashChanged && flash === 'success') soundManager.play('success');
    if (flashChanged && flash === 'error') soundManager.play('error');
  }, [level, flash]);

  useEffect(() => {
    return () => {
      if (hideTimer.current !== null) clearTimeout(hideTimer.current);
    };
  }, []);

  return { levelUp };
}
