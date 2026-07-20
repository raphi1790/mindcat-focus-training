import { useCallback, useEffect, useState } from 'react';
import { addTrainingSession } from '../data/firestore';
import type { AgeGroup, ExerciseId, ExerciseResult, TrainingSessionInput } from '../data/schema';
import { Confetti, soundManager } from '../ui';
import { EXERCISE_COMPONENTS } from './exercises';
import { EXERCISE_ICONS, EXERCISE_LABELS } from './labels';
import RewardScreen from './RewardScreen';
import { starsForResult } from './rewards';

/**
 * Orchestriert einen Trainingstag (Vorbild: `AssessmentRunner`): führt die
 * Übungen des Tages (vom Scheduler geliefert) sequenziell aus, sammelt die
 * `ExerciseResult`e und persistiert am Ende genau ein `trainingSessions`-
 * Dokument. Speichern ist atomar (ein addDoc); schlägt es fehl, bleiben die
 * Ergebnisse im Speicher und können per Retry erneut geschrieben werden.
 * Abbruch während einer Übung (`HoldToExit`) verwirft die gesamte Sitzung.
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
  | { step: 'running'; index: number; results: ExerciseResult[] }
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
  const [state, setState] = useState<RunnerState>({ step: 'running', index: 0, results: [] });

  const save = useCallback(
    async (results: ExerciseResult[]) => {
      setState({ step: 'saving', results });
      const input: TrainingSessionInput = {
        sessionDay,
        ageGroupAtTest: ageGroup,
        rngSeed: sessionSeed,
        exercises: results,
      };
      try {
        await addTrainingSession(uid, childId, input);
        setState({ step: 'done', results });
      } catch (err) {
        console.error('Trainingssitzung konnte nicht gespeichert werden', err);
        setState({
          step: 'saveError',
          results,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [uid, childId, sessionDay, ageGroup, sessionSeed],
  );

  // Vom Belohnungsschirm weiter — idempotent (Auto-Timer, Button und
  // Arcade-Confirm können sich überschneiden; nur der erste zählt).
  const continueAfterReward = useCallback(() => {
    setState((prev) => {
      if (prev.step !== 'reward') return prev;
      if (prev.index + 1 < exerciseIds.length) {
        return { step: 'running', index: prev.index + 1, results: prev.results };
      }
      // Speichern außerhalb des Updaters anstoßen.
      queueMicrotask(() => void save(prev.results));
      return { step: 'saving', results: prev.results };
    });
  }, [exerciseIds.length, save]);

  if (exerciseIds.length === 0) {
    // Sollte der Scheduler nie liefern, schützt aber vor einem leeren Tag.
    return null;
  }

  if (state.step === 'running') {
    const exerciseId = exerciseIds[state.index]!;
    const ExerciseComponent = EXERCISE_COMPONENTS[exerciseId];
    const { index, results } = state;
    return (
      <ExerciseComponent
        ageGroup={ageGroup}
        seed={deriveExerciseSeed(sessionSeed, exerciseId)}
        onCancel={onCancel}
        onComplete={(result) => {
          setState({ step: 'reward', index, results: [...results, result] });
        }}
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
          onClick={() => void save(state.results)}
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
