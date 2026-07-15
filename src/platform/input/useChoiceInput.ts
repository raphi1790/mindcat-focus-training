/**
 * Event-getriebene L/R-Wahlreaktion für den Child ANT.
 *
 * RT-Genauigkeit:
 *  - Tastatur: Zeitstempel direkt aus dem keydown-Event (`e.timeStamp`,
 *    performance-Timeline) — kein Polling-Versatz, keine Frame-Quantisierung.
 *    Auto-Repeat (`e.repeat`) wird ignoriert.
 *  - Gamepad/Arcade: Die Gamepad-API ist Polling-only; abgetastet wird pro
 *    Animation-Frame mit Rising-Edge-Erkennung (feuert genau einmal pro
 *    Druck). Quantisierung ≤ 1 Frame, Zeitstempel via performance.now().
 */
import { useEffect, useRef } from 'react';
import { choiceFromGamepad, connectedGamepads, type Choice } from './gamepad';

export interface ChoiceEvent {
  choice: Choice;
  /** performance-Timeline-Zeitstempel des Eingabe-Ereignisses. */
  timeStamp: number;
  source: 'keyboard' | 'gamepad';
}

export interface ChoiceInputOptions {
  /** Eingabe aktiv? Nur im Antwortfenster (TARGET-Phase) true setzen. */
  enabled?: boolean;
}

export function useChoiceInput(
  onChoice: (event: ChoiceEvent) => void,
  { enabled = true }: ChoiceInputOptions = {},
): void {
  const enabledRef = useRef(enabled);
  const onChoiceRef = useRef(onChoice);
  // Rising-Edge-Zustand: war beim letzten Frame bereits eine Wahl aktiv?
  const previousChoice = useRef<Choice | null>(null);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      // Beim Deaktivieren zurücksetzen: eine noch gehaltene Taste darf im
      // nächsten Antwortfenster nicht als neue Antwort zählen.
      previousChoice.current = null;
    }
  }, [enabled]);

  useEffect(() => {
    onChoiceRef.current = onChoice;
  }, [onChoice]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current || e.repeat) return;
      let choice: Choice | null = null;
      if (e.key === 'ArrowLeft') choice = 'L';
      if (e.key === 'ArrowRight') choice = 'R';
      if (choice === null) return;
      e.preventDefault();
      onChoiceRef.current({ choice, timeStamp: e.timeStamp, source: 'keyboard' });
    };
    window.addEventListener('keydown', handleKeyDown, { passive: false });

    let rafId: number;
    const poll = () => {
      let current: Choice | null = null;
      for (const gp of connectedGamepads()) {
        current = choiceFromGamepad(gp);
        if (current !== null) break;
      }

      const isRisingEdge = current !== null && previousChoice.current === null;
      previousChoice.current = current;

      if (enabledRef.current && isRisingEdge && current !== null) {
        onChoiceRef.current({ choice: current, timeStamp: performance.now(), source: 'gamepad' });
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
