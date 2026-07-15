/**
 * Timing-Engine für reaktionszeit-genaue Messungen (Child ANT).
 *
 * Grundproblem: `setTimeout(fn, ms)` garantiert weder den Zeitpunkt der
 * Ausführung noch den Zeitpunkt, zu dem ein Stimulus tatsächlich auf dem
 * Bildschirm erscheint. Für RT-Messungen gilt daher:
 *
 *  - Stimulus-Onset wird NACH dem Rendern per Double-rAF gestempelt
 *    (`nextPaint()`): Der zweite rAF-Callback läuft erst, nachdem der Frame
 *    mit dem Stimulus committed wurde. Restunsicherheit ≤ 1 Frame (~16 ms),
 *    dokumentiert und konstant — deutlich besser als setTimeout-Annahmen.
 *  - RT = responseTimestamp − paintedOnset, beide via performance.now().
 *  - Geplante Wartezeiten (`waitMs`) messen ihren tatsächlichen Drift, damit
 *    Timing-Jitter im Trial-Log dokumentiert werden kann.
 *
 * Alle Wartefunktionen unterstützen AbortSignal (Abbruch einer Sitzung).
 */

/** Monotoner Zeitstempel in ms (performance-Timeline). */
export const now = (): number => performance.now();

function abortError(): DOMException {
  return new DOMException('Timing wait aborted', 'AbortError');
}

/**
 * Ein Animation-Frame. Resolves mit performance.now() im Callback.
 */
export function raf(signal?: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const id = requestAnimationFrame(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(now());
    });
    const onAbort = () => {
      cancelAnimationFrame(id);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Onset-Stempel nach Paint (Double-rAF).
 *
 * Verwendung: Stimulus rendern (State setzen) → `const onset = await nextPaint()`.
 * Der zurückgegebene Zeitstempel liegt maximal einen Frame vor dem sichtbaren
 * Erscheinen des Stimulus und ist die Referenz für die RT-Berechnung.
 */
export async function nextPaint(signal?: AbortSignal): Promise<number> {
  await raf(signal);
  return raf(signal);
}

export interface WaitResult {
  /** Geplante Wartezeit in ms. */
  plannedMs: number;
  /** Tatsächlich verstrichene Zeit in ms. */
  actualMs: number;
  /** actualMs − plannedMs (Jitter, für Qualitäts-Logging). */
  driftMs: number;
  /** performance.now() am Ende der Wartezeit. */
  endTs: number;
}

/**
 * Wartet ~ms und misst den tatsächlichen Drift.
 * Für Phasen ohne Onset-Anspruch (Fixation, Feedback, ISI).
 */
export function waitMs(ms: number, signal?: AbortSignal): Promise<WaitResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const start = now();
    const id = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      const endTs = now();
      const actualMs = endTs - start;
      resolve({ plannedMs: ms, actualMs, driftMs: actualMs - ms, endTs });
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Deadline für Antwortfenster (z. B. ANT: max. 1700 ms nach Target-Onset).
 * Läuft relativ zu einem bereits gestempelten Onset, nicht zur Aufrufzeit —
 * so verkürzt die Zeit zwischen Onset-Stempel und Aufruf das Fenster nicht.
 */
export function deadlineAfter(
  onsetTs: number,
  windowMs: number,
  signal?: AbortSignal,
): Promise<WaitResult> {
  const remaining = Math.max(0, onsetTs + windowMs - now());
  return waitMs(remaining, signal);
}

/** True, wenn der Fehler ein Timing-Abbruch (AbortError) ist. */
export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}
