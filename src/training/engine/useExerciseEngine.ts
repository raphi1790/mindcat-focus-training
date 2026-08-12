import { useCallback, useEffect, useRef, useState } from 'react';
import { now } from '../../platform/timing';
import type { ExerciseId, ExerciseResult } from '../../data/schema';
import {
  applyTrialOutcome,
  createExerciseProgress,
  finalizeExerciseResult,
  type ExerciseProgressState,
  type LevelConfig,
  type TrialOutcome,
} from './exerciseProgress';

/**
 * React-Hook um den reinen `exerciseProgress`-Reducer: misst die
 * Übungsdauer via `platform/timing.now()`, sammelt optional ein
 * Rohereignis-Log und ruft `onComplete` genau einmal auf, sobald der
 * Reducer `done` meldet (baut dabei das schema-konforme `ExerciseResult`).
 */

export interface UseExerciseEngineOptions {
  /** Rohereignisse (übungsspezifische Struktur) im `ExerciseResult` mitspeichern? */
  logRawEvents?: boolean;
  /**
   * Resume-Startzustand (AP6): statt frischem Fortschritt startet die Übung an
   * einem Checkpoint (Level/Trial-Index/Statistik). Wird nur beim Mount gelesen.
   */
  initialState?: ExerciseProgressState;
  /**
   * Feuert nach jedem Level-Aufstieg mit dem neuen Zustand (AP6: Checkpoint
   * schreiben). Genau einmal pro Aufstieg — auch unter StrictMode; beim Mount
   * (auch bei Resume auf ein höheres Level) feuert es nicht.
   */
  onLevelUp?: (state: ExerciseProgressState) => void;
}

export interface ExerciseEngine {
  state: ExerciseProgressState;
  recordTrial: (outcome: TrialOutcome, rawEvent?: Record<string, unknown>) => void;
  /** Rohereignis loggen, ohne einen Trial abzuschließen (z. B. Maze-Wandbumps). */
  logEvent: (rawEvent: Record<string, unknown>) => void;
}

export function useExerciseEngine(
  exerciseId: ExerciseId,
  config: LevelConfig,
  onComplete: (result: ExerciseResult) => void,
  { logRawEvents = false, initialState, onLevelUp }: UseExerciseEngineOptions = {},
): ExerciseEngine {
  const [state, setState] = useState<ExerciseProgressState>(
    () => initialState ?? createExerciseProgress(),
  );
  const startRef = useRef(now());
  const rawEventsRef = useRef<Record<string, unknown>[]>([]);
  const onCompleteRef = useRef(onComplete);
  const onLevelUpRef = useRef(onLevelUp);
  const firedRef = useRef(false);
  // Höchstes Level, für das `onLevelUp` bereits gefeuert wurde. Startet auf dem
  // Anfangslevel (auch bei Resume), damit der Mount nicht als Aufstieg zählt.
  const lastLevelRef = useRef(state.level);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onLevelUpRef.current = onLevelUp;
  }, [onLevelUp]);

  // Checkpoint-Trigger: nach jedem echten Level-Aufstieg genau einmal. Der
  // Ref-Guard macht das StrictMode-fest (Doppel-Setup des Effekts feuert nicht
  // erneut) und verhindert ein Feuern beim Mount.
  useEffect(() => {
    if (state.level > lastLevelRef.current) {
      lastLevelRef.current = state.level;
      onLevelUpRef.current?.(state);
    }
  }, [state]);

  const recordTrial = useCallback(
    (outcome: TrialOutcome, rawEvent?: Record<string, unknown>) => {
      if (logRawEvents && rawEvent) rawEventsRef.current.push(rawEvent);
      setState((prev) => applyTrialOutcome(prev, config, outcome));
    },
    [config, logRawEvents],
  );

  const logEvent = useCallback(
    (rawEvent: Record<string, unknown>) => {
      if (logRawEvents) rawEventsRef.current.push(rawEvent);
    },
    [logRawEvents],
  );

  useEffect(() => {
    if (state.done && !firedRef.current) {
      firedRef.current = true;
      const durationMs = now() - startRef.current;
      const result = finalizeExerciseResult(
        exerciseId,
        state,
        durationMs,
        logRawEvents ? rawEventsRef.current : undefined,
      );
      onCompleteRef.current(result);
    }
  }, [state, exerciseId, logRawEvents]);

  return { state, recordTrial, logEvent };
}
