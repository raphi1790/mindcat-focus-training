import { useCallback, useEffect, useRef, useState } from 'react';
import HoldToExit from '../../../components/HoldToExit';
import { useChoiceInput, type ChoiceEvent } from '../../../platform/input';
import { createRng, type Rng } from '../../../platform/rng';
import { useExerciseEngine, type LevelConfig } from '../../engine';
import type { ExerciseProps } from '../../types';
import { generateStroopTrial, type StroopSide, type StroopTrial } from './generator';

/**
 * Number-Stroop (Plan §6.2, Übung 7): Konfliktlösung. a=6, b=18, c=3, wobei
 * nur inkongruente Trials zum Advance-Streak zählen (kongruente/neutrale
 * Trials bewegen ihn weder vorwärts noch setzen sie ihn zurück).
 */
const CONFIG: LevelConfig = { levels: 6, minTrials: 18, advanceStreak: 3 };
const FLASH_MS = 500;

function Cluster({ side, flashColor }: { side: StroopSide; flashColor: string }) {
  const items = Array.from({ length: side.count });
  return (
    <div
      className={`flex flex-wrap gap-1 items-center justify-center w-40 h-40 rounded-2xl border-4 p-3 transition-colors ${flashColor}`}
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

export default function NumberStroopExercise({ seed, onComplete, onCancel }: ExerciseProps) {
  const { state, recordTrial } = useExerciseEngine('number-stroop', CONFIG, onComplete);
  const rngRef = useRef<Rng>(createRng(seed));
  const [trialId, setTrialId] = useState(0);
  const [trial, setTrial] = useState<StroopTrial | null>(null);
  const [flash, setFlash] = useState<{ side: 'L' | 'R'; kind: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (state.done) return;
    setTrial(generateStroopTrial(rngRef.current, state.level));
  }, [trialId, state.level, state.done]);

  const handleChoice = useCallback(
    ({ choice }: ChoiceEvent) => {
      if (!trial || flash !== null) return;
      const correct = choice === trial.correctSide;
      setFlash({ side: choice, kind: correct ? 'success' : 'error' });
      recordTrial({
        result: correct ? 'correct' : 'error',
        countsTowardStreak: trial.type === 'incongruent',
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

  const colorFor = (side: 'L' | 'R') => {
    if (flash && flash.side === side) return flash.kind === 'success' ? 'bg-green-100 border-green-400' : 'bg-red-100 border-red-400';
    return 'bg-white border-slate-200';
  };

  return (
    <div className="fixed inset-0 z-40 bg-sky-50 flex flex-col items-center justify-center p-8 overflow-hidden">
      <HoldToExit onExit={onCancel} />

      <div className="absolute top-8 left-8 text-2xl font-bold text-slate-600 bg-white px-4 py-2 rounded-xl shadow-sm">
        Level {state.level}
        <span className="text-sm font-normal text-slate-400 ml-2">
          ({state.streak}/{CONFIG.advanceStreak} für Aufstieg)
        </span>
      </div>
      <div className="absolute top-8 right-24 text-xl font-medium text-slate-500 bg-white px-4 py-2 rounded-xl shadow-sm">
        Durchläufe: {state.totalTrials} / {CONFIG.minTrials}
      </div>

      <h2 className="text-2xl font-bold text-slate-700 mb-10 text-center max-w-lg">
        Welche Seite hat mehr?
      </h2>

      {trial && (
        <div className="flex gap-10 items-center">
          <Cluster side={trial.left} flashColor={colorFor('L')} />
          <div className="text-3xl text-slate-300 font-light">vs</div>
          <Cluster side={trial.right} flashColor={colorFor('R')} />
        </div>
      )}

      <div className="mt-10 text-slate-500 text-lg text-center max-w-lg">
        Drücke <strong>links</strong> oder <strong>rechts</strong> — welche Seite hat mehr?
      </div>
    </div>
  );
}
