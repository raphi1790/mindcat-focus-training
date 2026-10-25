import { useCallback, useEffect, useState } from "react";
import { addAssessment } from "../data/firestore";
import type { AgeGroup, AssessmentInput, AssessmentPhase } from "../data/schema";
import { useConfirmInput } from "../platform/input";
import { generateSeed } from "../platform/rng";
import { ParticleBurst, soundManager } from "../ui";
import { ChildAnt, type AntRunResult } from "./ant";

/**
 * Baseline/Post-Orchestrierung (Plan §5.2): führt einen Child-ANT-Lauf für
 * die gegebene Phase aus und persistiert ihn als eigenes `assessments`-
 * Dokument (inkl. Seed, Config, Scores, Quality, rawTrials).
 *
 * Speichern ist atomar (ein addDoc); schlägt es fehl, bleibt das Ergebnis im
 * Speicher und kann per Retry erneut geschrieben werden — ein absolvierter
 * Testlauf geht nicht verloren. Abbruch während des Tests speichert nichts.
 *
 * Nach erfolgreichem Speichern zeigt der Child-Screen eine kindgerechte,
 * motivierende Siegeransicht (Katze, Sterne, Lob) — klinische RT-Tabellen
 * gehören ausschließlich ins Betreuer-Dashboard.
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
  | { step: "running" }
  | { step: "saving"; result: AntRunResult }
  | { step: "saveError"; result: AntRunResult; message: string }
  | { step: "done"; result: AntRunResult };

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
  const [state, setState] = useState<RunnerState>({ step: "running" });

  const save = useCallback(
    async (result: AntRunResult) => {
      setState({ step: "saving", result });
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
        setState({ step: "done", result });
      } catch (err) {
        console.error("Assessment konnte nicht gespeichert werden", err);
        setState({
          step: "saveError",
          result,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [uid, childId, ageGroup, phase],
  );

  if (state.step === "running") {
    return <ChildAnt seed={seed} onComplete={(result) => void save(result)} onCancel={onCancel} />;
  }

  if (state.step === "saving") {
    return (
      <ScreenFrame>
        <div className="text-6xl mb-6 animate-pulse">💾</div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Ergebnis wird gespeichert…</h2>
        <p className="text-slate-500">Einen Moment bitte.</p>
      </ScreenFrame>
    );
  }

  if (state.step === "saveError") {
    return (
      <AssessmentSaveError
        message={state.message}
        onRetry={() => void save(state.result)}
      />
    );
  }

  return <AssessmentDone onFinished={onFinished} />;
}

/** Fehleransicht beim Speichern mit Bestätigungseingabe (Enter / Arcade) */
function AssessmentSaveError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  useConfirmInput(onRetry);

  return (
    <ScreenFrame>
      <div className="text-6xl mb-6">⚠️</div>
      <h2 className="text-3xl font-bold text-slate-800 mb-4">Speichern fehlgeschlagen</h2>
      <p className="text-slate-600 mb-2">
        Das Testergebnis ist noch im Speicher und geht nicht verloren.
      </p>
      <p className="text-sm text-slate-400 mb-8 break-words">{message}</p>
      <button
        onClick={onRetry}
        className="w-full bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold py-4 rounded-2xl transition-all text-xl shadow-md cursor-pointer"
      >
        Erneut versuchen
      </button>
      <p className="text-xs text-slate-400 mt-3">Arcade-Button oder Enter drücken</p>
    </ScreenFrame>
  );
}

/** Kindgerechte Siegeransicht bei Test-Abschluss */
function AssessmentDone({ onFinished }: { onFinished: () => void }) {
  useEffect(() => {
    soundManager.play("fanfare");
  }, []);

  useConfirmInput(onFinished);

  return (
    <ScreenFrame>
      <ParticleBurst className="absolute inset-0" count={16} radius={180} />

      <div
        className="text-7xl mb-3 animate-pop select-none"
        data-testid="celebration-cat"
      >
        🐱
      </div>

      <div
        className="flex justify-center gap-3 mb-6"
        aria-label="3 von 3 Sternen"
        data-testid="stars-container"
      >
        <span className="text-5xl sm:text-6xl animate-pop">⭐</span>
        <span className="text-5xl sm:text-6xl animate-pop">⭐</span>
        <span className="text-5xl sm:text-6xl animate-pop">⭐</span>
      </div>

      <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-800 mb-2">
        Großartig gemacht!
      </h2>
      <p className="text-lg text-slate-600 mb-8 font-medium">
        Du hast den Fisch-Test erfolgreich gemeistert!
      </p>

      <button
        onClick={onFinished}
        className="w-full bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold py-4 rounded-2xl transition-all text-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
      >
        <span>Zurück zum Dashboard 🐱</span>
      </button>
      <p className="text-xs text-slate-400 mt-3">Arcade-Button oder Enter drücken</p>
    </ScreenFrame>
  );
}

function ScreenFrame({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 bg-sky-50 flex items-center justify-center overflow-auto">
      <div
        className={`relative text-center p-10 bg-white rounded-3xl shadow-sm border border-slate-100 mx-4 my-8 ${wide ? "max-w-2xl w-full" : "max-w-xl"}`}
      >
        {children}
      </div>
    </div>
  );
}
