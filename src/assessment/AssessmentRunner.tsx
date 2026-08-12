import { useCallback, useState } from 'react';
import { addAssessment } from '../data/firestore';
import type { AgeGroup, AssessmentInput, AssessmentPhase } from '../data/schema';
import { generateSeed } from '../platform/rng';
import { ChildAnt, type AntRunResult } from './ant';

/**
 * Baseline/Post-Orchestrierung (Plan §5.2): führt einen Child-ANT-Lauf für
 * die gegebene Phase aus und persistiert ihn als eigenes `assessments`-
 * Dokument (inkl. Seed, Config, Scores, Quality, rawTrials).
 *
 * Speichern ist atomar (ein addDoc); schlägt es fehl, bleibt das Ergebnis im
 * Speicher und kann per Retry erneut geschrieben werden — ein absolvierter
 * Testlauf geht nicht verloren. Abbruch während des Tests speichert nichts.
 */

interface AssessmentRunnerProps {
  uid: string;
  childId: string;
  ageGroup: AgeGroup;
  phase: AssessmentPhase;
  /** Aufgerufen, nachdem gespeichert und die Ergebnisansicht bestätigt wurde. */
  onFinished: () => void;
  /** Abbruch während des Tests (nichts gespeichert). */
  onCancel: () => void;
}

type RunnerState =
  | { step: 'running' }
  | { step: 'saving'; result: AntRunResult }
  | { step: 'saveError'; result: AntRunResult; message: string }
  | { step: 'done'; result: AntRunResult };

const PHASE_LABELS: Record<AssessmentPhase, string> = {
  baseline: 'Einstufungstest (Baseline)',
  post: 'Abschlusstest (Post)',
  interim: 'Zwischentest (Interim)',
};

export default function AssessmentRunner({
  uid,
  childId,
  ageGroup,
  phase,
  onFinished,
  onCancel,
}: AssessmentRunnerProps) {
  // Ein Seed pro Lauf, bei Mount fixiert und mit dem Assessment persistiert.
  const [seed] = useState(() => generateSeed());
  const [state, setState] = useState<RunnerState>({ step: 'running' });

  const save = useCallback(
    async (result: AntRunResult) => {
      setState({ step: 'saving', result });
      const input: AssessmentInput = {
        phase,
        ageGroupAtTest: ageGroup,
        rngSeed: result.rngSeed,
        config: result.config,
        scores: result.scores,
        quality: result.quality,
        rawTrials: result.rawTrials,
      };
      try {
        await addAssessment(uid, childId, input);
        setState({ step: 'done', result });
      } catch (err) {
        console.error('Assessment konnte nicht gespeichert werden', err);
        setState({
          step: 'saveError',
          result,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [uid, childId, ageGroup, phase],
  );

  if (state.step === 'running') {
    return <ChildAnt seed={seed} onComplete={(result) => void save(result)} onCancel={onCancel} />;
  }

  if (state.step === 'saving') {
    return (
      <ScreenFrame>
        <div className="text-6xl mb-6 animate-pulse">💾</div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Ergebnis wird gespeichert…</h2>
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
          Das Testergebnis ist noch im Speicher und geht nicht verloren.
        </p>
        <p className="text-sm text-slate-400 mb-8 break-words">{state.message}</p>
        <button
          onClick={() => void save(state.result)}
          className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl hover:bg-purple-700 transition-colors text-xl"
        >
          Erneut versuchen
        </button>
      </ScreenFrame>
    );
  }

  const { scores, quality } = state.result;
  return (
    <ScreenFrame wide>
      <div className="text-6xl mb-6">🎉</div>
      <h2 className="text-4xl font-bold text-slate-800 mb-2">Geschafft!</h2>
      <p className="text-xl text-slate-600 mb-8">Der Test ist fertig — toll durchgehalten!</p>

      <div className="text-left bg-slate-50 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-bold uppercase text-slate-400 mb-4">
          {PHASE_LABELS[phase]} — Ergebnis
        </h3>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <dt className="text-slate-500">Overall-RT (Median)</dt>
          <dd className="font-semibold text-slate-700">{Math.round(scores.overallRT)} ms</dd>
          <dt className="text-slate-500">Conflict-Score</dt>
          <dd className="font-semibold text-slate-700">{Math.round(scores.conflictRT)} ms</dd>
          <dt className="text-slate-500">Alerting-Score</dt>
          <dd className="font-semibold text-slate-700">{Math.round(scores.alertingRT)} ms</dd>
          <dt className="text-slate-500">Orienting-Score</dt>
          <dd className="font-semibold text-slate-700">{Math.round(scores.orientingRT)} ms</dd>
          <dt className="text-slate-500">Fehlerrate</dt>
          <dd className="font-semibold text-slate-700">{scores.overallErrorRate.toFixed(1)} %</dd>
          <dt className="text-slate-500">Gültige Trials</dt>
          <dd className="font-semibold text-slate-700">
            {quality.validTrialCount} / {state.result.rawTrials.length}
          </dd>
        </dl>
      </div>

      {quality.excluded && (
        <div className="text-left bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-sm text-amber-800">
          <strong>Lauf ausgeschlossen:</strong> {quality.reason}
          <br />
          Der Lauf zählt nicht als gültige Messung und sollte wiederholt werden. Die Rohdaten
          wurden trotzdem gespeichert.
        </div>
      )}

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
