import { useCallback, useEffect, useRef, useState } from 'react';
import { useChoiceInput, type ChoiceEvent } from '../../../platform/input';
import { createTrialRng } from '../../../platform/rng';
import { createTrialGate, useExerciseEngine } from '../../engine';
import { EXERCISE_CONFIGS } from '../../exerciseConfigs';
import ExerciseScreen from '../../shared/ExerciseScreen';
import type { ExerciseProps } from '../../types';
import { generateStroopTrial, type StroopSide, type StroopTrial } from './generator';

/**
 * Number-Stroop (Plan §6.2, Übung 7): Konfliktlösung. a=6, b=18, c=3, wobei
 * nur inkongruente Trials zum Advance-Streak zählen (kongruente/neutrale
 * Trials bewegen ihn weder vorwärts noch setzen sie ihn zurück).
 */
const CONFIG = EXERCISE_CONFIGS['number-stroop'];
const FLASH_MS = 500;

function Cluster({
  side,
  flashState,
}: {
  side: StroopSide;
  flashState: 'success' | 'error' | null;
}) {
  const items = Array.from({ length: side.count });
  const color =
    flashState === 'success'
      ? 'bg-green-100 border-green-400 animate-pop'
      : flashState === 'error'
        ? 'bg-red-100 border-red-400 animate-shake'
        : 'bg-white border-slate-200';
  return (
    <div
      className={`flex flex-wrap gap-1 items-center justify-center w-40 h-40 rounded-2xl border-4 p-3 shadow-sm transition-colors ${color}`}
    >
      {items.map((_, i) =>
        side.symbol === null ? (
          <span key={i} className="text-2xl leading-none">
            🍎
          </span>
        ) : (
          <span key={i} className="text-2xl leading-none font-mono font-bold text-slate-700">
            {side.symbol}
          </span>
        ),
      )}
    </div>
  );
}

export default function NumberStroopExercise({ seed, onComplete, onCancel, initialState, onLevelUp }: ExerciseProps) {
  const { state, recordTrial } = useExerciseEngine('number-stroop', CONFIG, onComplete, { initialState, onLevelUp });
  const [trialId, setTrialId] = useState(0);
  const [trial, setTrial] = useState<StroopTrial | null>(null);
  const [flash, setFlash] = useState<{ side: 'L' | 'R'; kind: 'success' | 'error' } | null>(null);
  const gateRef = useRef(createTrialGate());

  // Neuer Trial: in einer verschachtelten Funktion statt direkt im
  // Effect-Body (vgl. ChaseExercise.tsx) — das Setup reagiert auf einen neuen
  // Trial (externes Ereignis, ausgelöst nach Ablauf der Flash-Anzeige), keine
  // reine Render-Ableitung.
  useEffect(() => {
    if (state.done) return;
    const setupTrial = () => {
      gateRef.current.reset();
      // Eigene Rng-Instanz je Trial (AP3) — siehe Begründung in ChaseExercise.tsx.
      setTrial(generateStroopTrial(createTrialRng(seed, state.totalTrials), state.level));
    };
    setupTrial();
  }, [trialId, state.level, state.done, state.totalTrials, seed]);

  const handleChoice = useCallback(
    ({ choice }: ChoiceEvent) => {
      if (!trial || flash !== null) return;
      if (!gateRef.current.tryClose()) return;
      const correct = choice === trial.correctSide;
      setFlash({ side: choice, kind: correct ? 'success' : 'error' });
      recordTrial({
        result: correct ? 'correct' : 'error',
        // Apfel-Level (neutral) haben keine inkongruenten Trials — dort zählt
        // jeder korrekte Trial. Ab den Ziffern-Leveln zählen nur inkongruente
        // Trials zum c=3-Kriterium; kongruente bewegen den Streak nicht.
        countsTowardStreak: trial.type !== 'congruent',
      });
    },
    [trial, flash, recordTrial],
  );

  useChoiceInput(handleChoice, { enabled: flash === null && trial !== null && !state.done });

  useEffect(() => {
    if (flash === null) return;
    const timeout = setTimeout(() => {
      setFlash(null);
      setTrialId((id) => id + 1);
    }, FLASH_MS);
    return () => clearTimeout(timeout);
  }, [flash]);

  const flashFor = (side: 'L' | 'R') => (flash && flash.side === side ? flash.kind : null);

  return (
    <ExerciseScreen
      level={state.level}
      streak={{ current: state.streak, target: CONFIG.advanceStreak }}
      counter={`${state.totalTrials} / ${CONFIG.minTrials}`}
      heading="Welche Seite hat mehr?"
      instructions={
        <>
          Drücke <strong>links</strong> oder <strong>rechts</strong> — welche Seite hat mehr?
        </>
      }
      flash={flash?.kind ?? null}
      onExit={onCancel}
    >
      {trial && (
        <div key={trialId} className="flex gap-10 items-center animate-pop">
          <Cluster side={trial.left} flashState={flashFor('L')} />
          <div className="text-3xl text-slate-400 font-light">vs</div>
          <Cluster side={trial.right} flashState={flashFor('R')} />
        </div>
      )}
    </ExerciseScreen>
  );
}
