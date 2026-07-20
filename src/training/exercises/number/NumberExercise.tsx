import { useCallback, useEffect, useRef, useState } from 'react';
import HoldToExit from '../../../components/HoldToExit';
import { useArraySelectInput } from '../../../platform/input';
import { createRng, type Rng } from '../../../platform/rng';
import { useExerciseEngine, type LevelConfig } from '../../engine';
import type { ExerciseProps } from '../../types';
import { generateNumberTrial, type NumberTrial } from './generator';

/** Number (Plan §6.2, Übung 6): Symbol-Matching. a=5, b=45, c=9. */
const CONFIG: LevelConfig = { levels: 5, minTrials: 45, advanceStreak: 9 };
const FLASH_MS = 500;

export default function NumberExercise({ seed, onComplete, onCancel }: ExerciseProps) {
  const { state, recordTrial } = useExerciseEngine('number', CONFIG, onComplete);
  const rngRef = useRef<Rng>(createRng(seed));
  const [trialId, setTrialId] = useState(0);
  const [trial, setTrial] = useState<NumberTrial | null>(null);
  const [flash, setFlash] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    if (state.done) return;
    setTrial(generateNumberTrial(rngRef.current, state.level));
  }, [trialId, state.level, state.done]);

  const handleSelect = useCallback(
    (index: number) => {
      if (!trial || flash !== null) return;
      const correct = index === trial.correctIndex;
      setFlash(correct ? 'success' : 'error');
      recordTrial({ result: correct ? 'correct' : 'error' });
    },
    [trial, flash, recordTrial],
  );

  const selectedIndex = useArraySelectInput(trial?.candidates.length ?? 0, handleSelect, {
    enabled: flash === null && !state.done,
    resetKey: trialId,
  });

  useEffect(() => {
    if (flash === null) return;
    const timeout = setTimeout(() => {
      setFlash(null);
      setTrialId((id) => id + 1);
    }, FLASH_MS);
    return () => clearTimeout(timeout);
  }, [flash]);

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

      <h2 className="text-2xl font-bold text-slate-700 mb-8 text-center max-w-lg">
        Welche Zahl unten passt zur Zahl oben?
      </h2>

      {trial && (
        <>
          <div className="mb-10 w-28 h-28 rounded-2xl bg-red-100 border-4 border-red-300 flex items-center justify-center text-6xl font-bold text-red-700 shadow-sm">
            {trial.target}
          </div>

          <div className="flex gap-6 flex-wrap justify-center max-w-3xl">
            {trial.candidates.map((digit, i) => {
              const isSelected = i === selectedIndex;
              const isCorrect = i === trial.correctIndex;
              let ring = 'ring-2 ring-slate-200';
              if (isSelected && flash === 'success') ring = 'ring-4 ring-green-500';
              else if (isSelected && flash === 'error') ring = 'ring-4 ring-red-500';
              else if (flash === 'error' && isCorrect) ring = 'ring-4 ring-green-500';
              else if (flash === null && isSelected) ring = 'ring-4 ring-purple-500';

              return (
                <div
                  key={i}
                  className={`w-24 h-24 rounded-full bg-blue-50 border-4 border-blue-200 flex items-center justify-center text-5xl font-mono font-semibold text-blue-800 shadow-sm transition-all ${ring}`}
                >
                  {digit}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-10 text-slate-500 text-lg text-center max-w-lg">
        Bewege die Auswahl mit Joystick/Pfeiltasten, bestätige mit Arcade-Button/Enter.
      </div>
    </div>
  );
}
