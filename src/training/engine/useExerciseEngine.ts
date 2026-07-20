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
  { logRawEvents = false }: UseExerciseEngineOptions = {},
): ExerciseEngine {
  const [state, setState] = useState<ExerciseProgressState>(createExerciseProgress);
  const startRef = useRef(now());
  const rawEventsRef = useRef<Record<string, unknown>[]>([]);
  const onCompleteRef = useRef(onComplete);
  const firedRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

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
