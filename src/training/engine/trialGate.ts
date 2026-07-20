/**
 * Schützt vor mehrfachem Trial-Abschluss: React StrictMode ruft
 * Updater-Funktionen (`setState(prev => ...)`) im Dev-Modus doppelt auf, und
 * ein Timer kann ablaufen, während parallel eine Eingabe verarbeitet wird.
 * `tryClose()` gewinnt genau einmal pro Trial; `reset()` öffnet für den
 * nächsten Trial wieder.
 */
export interface TrialGate {
  tryClose(): boolean;
  reset(): void;
}

export function createTrialGate(): TrialGate {
  let closed = false;
  return {
    tryClose() {
      if (closed) return false;
      closed = true;
      return true;
    },
    reset() {
      closed = false;
    },
  };
}
