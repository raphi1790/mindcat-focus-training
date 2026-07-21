import { useCallback, useEffect, useRef, useState } from 'react';
import {
  completeTrainingSession,
  findInProgressSession,
  startTrainingSession,
  updateTrainingSessionProgress,
} from '../data/firestore';
import type { AgeGroup, ExerciseId, ExerciseResult, TrainingSessionInput } from '../data/schema';
import { Confetti, soundManager } from '../ui';
import { createExerciseProgress, type ExerciseProgressState } from './engine';
import { EXERCISE_COMPONENTS } from './exercises';
import { EXERCISE_ICONS, EXERCISE_LABELS } from './labels';
import RewardScreen from './RewardScreen';
import { starsForResult } from './rewards';

/**
 * Orchestriert einen Trainingstag (Vorbild: `AssessmentRunner`): führt die
 * Übungen des Tages sequenziell aus, sammelt die `ExerciseResult`e und
 * persistiert sie inkrementell in genau einem `trainingSessions`-Dokument.
 *
 * Absturz-Resilienz (AP6, Fix-Plan Testrunde 1): Beim Mount wird eine laufende
 * Sitzung desselben Tages gesucht und fortgesetzt (`findInProgressSession`);
 * sonst wird eine neue `in-progress`-Sitzung angelegt. Nach jeder Übung wird
 * die Ergebnisliste geschrieben, nach jedem Level-Aufstieg ein Checkpoint —
 * ein Crash/Reload überlebt damit jeden abgeschlossenen Level-Aufstieg. Am
 * Tagesende setzt `completeTrainingSession` die Sitzung auf `completed`
 * (danach unveränderlich). Abbruch via `HoldToExit` lässt das In-Progress-
 * Dokument stehen → der nächste Start desselben Tages setzt fort.
 *
 * Phase 5 (Plan §6.3): Zwischen den Übungen liegt eine Belohnungsschleife
 * (`RewardScreen` mit Sternen), der Tagesabschluss feiert mit Konfetti und
 * Fanfare. Beides ist rein kosmetische Meta-Ebene — die gespeicherten Daten
 * bleiben unverändert schema-konform.
 */

interface TrainingSessionRunnerProps {
  uid: string;
  childId: string;
  ageGroup: AgeGroup;
  sessionDay: number;
  exerciseIds: ExerciseId[];
  onFinished: () => void;
  onCancel: () => void;
}

type RunnerState =
  | { step: 'init' }
  | { step: 'initError'; message: string }
  // `initialState` nur gesetzt, wenn an dieser Übung fortgesetzt wird (Resume);
  // Folgeübungen tragen es nicht und starten damit frisch.
  | { step: 'running'; index: number; results: ExerciseResult[]; initialState?: ExerciseProgressState }
  | { step: 'reward'; index: number; results: ExerciseResult[] }
  | { step: 'saving'; results: ExerciseResult[] }
  | { step: 'saveError'; results: ExerciseResult[]; message: string }
  | { step: 'done'; results: ExerciseResult[] };

/**
 * Sitzungs-Seed ist eine feste Konstante je Trainingstag (AP3, Fix-Plan
 * Testrunde 1): Jedes Kind sieht an Tag n exakt dieselben Sequenzen. Der Seed
 * wird trotzdem unverändert im Session-Dokument persistiert (Reproduzierbarkeit
 * bleibt dokumentiert, auch wenn er nicht mehr zufällig ist).
 */
function sessionSeedForDay(sessionDay: number): string {
  return `mindcat-v1:day${sessionDay}`;
}

/** Eigener Seed je Übung, deterministisch aus dem Sitzungs-Seed abgeleitet. */
function deriveExerciseSeed(sessionSeed: string, exerciseId: ExerciseId): string {
  return `${sessionSeed}:${exerciseId}`;
}

export default function TrainingSessionRunner({
  uid,
  childId,
  ageGroup,
  sessionDay,
  exerciseIds,
  onFinished,
  onCancel,
}: TrainingSessionRunnerProps) {
  const sessionSeed = sessionSeedForDay(sessionDay);
  const [state, setState] = useState<RunnerState>({ step: 'init' });

  // Aktive Sitzung (außerhalb des States, da über viele Callbacks hinweg stabil
  // benötigt; nur in Handlern/Effekten gelesen, nie im Render).
  const sessionIdRef = useRef<string | null>(null);
  const initRef = useRef(false);

  // Beim Mount: laufende Sitzung fortsetzen oder neue anlegen. Läuft dank
  // `initRef` genau einmal (auch unter StrictMode); der einzige Async-Lauf
  // setzt den State der (persistenten) Instanz.
  useEffect(() => {
    if (initRef.current || exerciseIds.length === 0) return;
    initRef.current = true;

    void (async () => {
      try {
        const existing = await findInProgressSession(uid, childId, sessionDay);
        if (existing) {
          sessionIdRef.current = existing.id;
          const results = existing.exercises;
          const resumeIndex = results.length;
          if (resumeIndex >= exerciseIds.length) {
            // Alle Übungen bereits erledigt (Crash nach der letzten Übung, vor
            // dem Abschluss) → jetzt abschließen und feiern.
            await completeTrainingSession(uid, childId, existing.id, results);
            setState({ step: 'done', results });
            return;
          }
          // Checkpoint nur übernehmen, wenn er zur fortzusetzenden Übung gehört.
          const cp = existing.checkpoint;
          const initialState =
            cp && cp.exerciseIndex === resumeIndex && !cp.engineState.done
              ? cp.engineState
              : undefined;
          setState({ step: 'running', index: resumeIndex, results, initialState });
          return;
        }

        const input: TrainingSessionInput = {
          sessionDay,
          ageGroupAtTest: ageGroup,
          rngSeed: sessionSeed,
          exercises: [],
        };
        sessionIdRef.current = await startTrainingSession(uid, childId, input);
        setState({ step: 'running', index: 0, results: [] });
      } catch (err) {
        console.error('Trainingssitzung konnte nicht initialisiert werden', err);
        setState({ step: 'initError', message: err instanceof Error ? err.message : String(err) });
      }
    })();
  }, [uid, childId, sessionDay, ageGroup, sessionSeed, exerciseIds]);

  // Checkpoint nach einem Level-Aufstieg (nicht-fatal: der spätere Abschluss
  // schreibt ohnehin die vollständige Ergebnisliste).
  const handleLevelUp = useCallback(
    (index: number, engineState: ExerciseProgressState) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      void updateTrainingSessionProgress(uid, childId, sessionId, {
        checkpoint: { exerciseIndex: index, exerciseId: exerciseIds[index]!, engineState },
      }).catch((err) => console.error('Checkpoint konnte nicht gespeichert werden', err));
    },
    [uid, childId, exerciseIds],
  );

  // Übung abgeschlossen: Ergebnisliste fortschreiben und Checkpoint auf die
  // nächste Übung (frischer Zustand) setzen. Fehler sind nicht-fatal.
  const handleExerciseComplete = useCallback(
    (index: number, prevResults: ExerciseResult[], result: ExerciseResult) => {
      const results = [...prevResults, result];
      setState({ step: 'reward', index, results });

      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      const nextIndex = index + 1;
      const progress =
        nextIndex < exerciseIds.length
          ? {
              exercises: results,
              checkpoint: {
                exerciseIndex: nextIndex,
                exerciseId: exerciseIds[nextIndex]!,
                engineState: createExerciseProgress(),
              },
            }
          : { exercises: results };
      void updateTrainingSessionProgress(uid, childId, sessionId, progress).catch((err) =>
        console.error('Zwischenstand konnte nicht gespeichert werden', err),
      );
    },
    [uid, childId, exerciseIds],
  );

  const finish = useCallback(
    async (results: ExerciseResult[]) => {
      setState({ step: 'saving', results });
      const sessionId = sessionIdRef.current;
      try {
        if (!sessionId) throw new Error('Keine aktive Sitzung');
        await completeTrainingSession(uid, childId, sessionId, results);
        setState({ step: 'done', results });
      } catch (err) {
        console.error('Trainingssitzung konnte nicht abgeschlossen werden', err);
        setState({
          step: 'saveError',
          results,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [uid, childId],
  );

  // Vom Belohnungsschirm weiter — idempotent (Auto-Timer, Button und
  // Arcade-Confirm können sich überschneiden; nur der erste zählt).
  const continueAfterReward = useCallback(() => {
    setState((prev) => {
      if (prev.step !== 'reward') return prev;
      if (prev.index + 1 < exerciseIds.length) {
        return { step: 'running', index: prev.index + 1, results: prev.results };
      }
      // Abschluss außerhalb des Updaters anstoßen.
      queueMicrotask(() => void finish(prev.results));
      return { step: 'saving', results: prev.results };
    });
  }, [exerciseIds.length, finish]);

  if (exerciseIds.length === 0) {
    // Sollte der Scheduler nie liefern, schützt aber vor einem leeren Tag.
    return null;
  }

  if (state.step === 'init') {
    return (
      <ScreenFrame>
        <div className="text-6xl mb-6 animate-pulse">🐱</div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Trainingstag wird vorbereitet…</h2>
        <p className="text-slate-500">Einen Moment bitte.</p>
      </ScreenFrame>
    );
  }

  if (state.step === 'initError') {
    return (
      <ScreenFrame>
        <div className="text-6xl mb-6">⚠️</div>
        <h2 className="text-3xl font-bold text-slate-800 mb-4">Start fehlgeschlagen</h2>
        <p className="text-sm text-slate-400 mb-8 break-words">{state.message}</p>
        <button
          onClick={onCancel}
          className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl hover:bg-purple-700 transition-colors text-xl"
        >
          Zurück zum Dashboard
        </button>
      </ScreenFrame>
    );
  }

  if (state.step === 'running') {
    const exerciseId = exerciseIds[state.index]!;
    const ExerciseComponent = EXERCISE_COMPONENTS[exerciseId];
    const { index, results, initialState } = state;
    return (
      <ExerciseComponent
        key={`${exerciseId}-${index}`}
        ageGroup={ageGroup}
        seed={deriveExerciseSeed(sessionSeed, exerciseId)}
        initialState={initialState}
        onLevelUp={(engineState) => handleLevelUp(index, engineState)}
        onCancel={onCancel}
        onComplete={(result) => handleExerciseComplete(index, results, result)}
      />
    );
  }

  if (state.step === 'reward') {
    const finished = state.results[state.results.length - 1]!;
    return (
      <RewardScreen
        exerciseId={finished.exerciseId}
        stars={starsForResult(finished)}
        dayExerciseIds={exerciseIds}
        completedCount={state.index + 1}
        onContinue={continueAfterReward}
      />
    );
  }

  if (state.step === 'saving') {
    return (
      <ScreenFrame>
        <div className="text-6xl mb-6 animate-pulse">💾</div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Trainingstag wird gespeichert…</h2>
        <p className="text-slate-500">Einen Moment bitte.</p>
      </ScreenFrame>
    );
  }

  if (state.step === 'saveError') {
    return (
      <ScreenFrame>
        <div className="text-6xl mb-6">⚠️</div>
        <h2 className="text-3xl font-bold text-slate-800 mb-4">Speichern fehlgeschlagen</h2>
        <p className="text-slate-600 mb-2">
          Die Ergebnisse sind noch im Speicher und gehen nicht verloren.
        </p>
        <p className="text-sm text-slate-400 mb-8 break-words">{state.message}</p>
        <button
          onClick={() => void finish(state.results)}
          className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl hover:bg-purple-700 transition-colors text-xl"
        >
          Erneut versuchen
        </button>
      </ScreenFrame>
    );
  }

  return <SessionCelebration sessionDay={sessionDay} results={state.results} onFinished={onFinished} />;
}

/** Tagesabschluss-Feier: Konfetti, Fanfare, Sterne-Bilanz (Plan §6.3). */
function SessionCelebration({
  sessionDay,
  results,
  onFinished,
}: {
  sessionDay: number;
  results: ExerciseResult[];
  onFinished: () => void;
}) {
  useEffect(() => {
    soundManager.play('fanfare');
  }, []);

  const totalStars = results.reduce((sum, r) => sum + starsForResult(r), 0);

  return (
    <ScreenFrame wide>
      <Confetti />
      <div className="text-7xl mb-4 animate-pop">🏆</div>
      <h2 className="text-4xl font-extrabold text-slate-800 mb-2">
        Trainingstag {sessionDay} geschafft!
      </h2>
      <p className="text-xl text-slate-600 mb-2">
        {results.length} {results.length === 1 ? 'Übung' : 'Übungen'} abgeschlossen — super gemacht!
      </p>
      <p className="text-2xl mb-8" aria-label={`${totalStars} Sterne gesammelt`}>
        {totalStars} × ⭐ gesammelt
      </p>

      <div className="text-left bg-slate-50 rounded-2xl p-6 mb-6 space-y-2">
        {results.map((r) => (
          <div key={r.exerciseId} className="flex justify-between items-center text-sm gap-4">
            <span className="text-slate-500 flex items-center gap-2">
              <span className="text-lg">{EXERCISE_ICONS[r.exerciseId]}</span>
              {EXERCISE_LABELS[r.exerciseId]}
            </span>
            <span className="font-semibold text-slate-700 shrink-0 flex items-center gap-3">
              <span>
                Level {r.highestLevel} · {r.trials} Durchläufe
              </span>
              <span aria-label={`${starsForResult(r)} von 3 Sternen`}>
                {'⭐'.repeat(starsForResult(r))}
                <span className="opacity-25 grayscale">{'⭐'.repeat(3 - starsForResult(r))}</span>
              </span>
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={onFinished}
        className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl hover:bg-purple-700 transition-colors text-xl"
      >
        Zurück zum Dashboard
      </button>
    </ScreenFrame>
  );
}

function ScreenFrame({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 bg-sky-50 flex items-center justify-center overflow-auto">
      <div
        className={`text-center p-10 bg-white rounded-3xl shadow-sm border border-slate-100 mx-4 my-8 ${wide ? 'max-w-2xl w-full' : 'max-w-xl'}`}
      >
        {children}
      </div>
    </div>
  );
}
