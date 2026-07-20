import { useCallback, useEffect, useRef, useState } from 'react';
import { useArraySelectInput } from '../../../platform/input';
import { createRng, type Rng } from '../../../platform/rng';
import { useSelectionSound } from '../../../ui';
import { useExerciseEngine } from '../../engine';
import { EXERCISE_CONFIGS } from '../../exerciseConfigs';
import ExerciseScreen from '../../shared/ExerciseScreen';
import type { ExerciseProps } from '../../types';
import { generateNumberTrial, type NumberTrial } from './generator';

/** Number (Plan §6.2, Übung 6): Symbol-Matching. a=5, b=45, c=9. */
const CONFIG = EXERCISE_CONFIGS.number;
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
  useSelectionSound(selectedIndex, trialId);

  useEffect(() => {
    if (flash === null) return;
    const timeout = setTimeout(() => {
      setFlash(null);
      setTrialId((id) => id + 1);
    }, FLASH_MS);
    return () => clearTimeout(timeout);
  }, [flash]);

  return (
    <ExerciseScreen
      level={state.level}
      streak={{ current: state.streak, target: CONFIG.advanceStreak }}
      counter={`${state.totalTrials} / ${CONFIG.minTrials}`}
      heading="Welche Zahl unten passt zur Zahl oben?"
      instructions="Bewege die Auswahl mit Joystick/Pfeiltasten, bestätige mit Arcade-Button/Enter."
      flash={flash}
      onExit={onCancel}
    >
      {trial && (
        <>
          <div
            key={trialId}
            className="mb-10 w-28 h-28 rounded-2xl bg-red-100 border-4 border-red-300 flex items-center justify-center text-6xl font-bold text-red-700 shadow-sm animate-pop"
          >
            {trial.target}
          </div>

          <div className="flex gap-6 flex-wrap justify-center max-w-3xl">
            {trial.candidates.map((digit, i) => {
              const isSelected = i === selectedIndex;
              const isCorrect = i === trial.correctIndex;
              let ring = 'ring-2 ring-slate-200';
              let extra = '';
              if (isSelected && flash === 'success') {
                ring = 'ring-4 ring-green-500';
                extra = 'animate-pop';
              } else if (isSelected && flash === 'error') {
                ring = 'ring-4 ring-red-500';
                extra = 'animate-shake';
              } else if (flash === 'error' && isCorrect) {
                ring = 'ring-4 ring-green-500';
                extra = 'animate-pulse-soft';
              } else if (flash === null && isSelected) {
                ring = 'ring-4 ring-purple-500';
                extra = 'scale-110';
              }

              return (
                <div
                  key={i}
                  className={`w-24 h-24 rounded-full bg-blue-50 border-4 border-blue-200 flex items-center justify-center text-5xl font-mono font-semibold text-blue-800 shadow-sm transition-all duration-150 ${ring} ${extra}`}
                >
                  {digit}
                </div>
              );
            })}
          </div>
        </>
      )}
    </ExerciseScreen>
  );
}
