import { useCallback, useEffect, useRef, useState } from 'react';
import HoldToExit from '../../../components/HoldToExit';
import { useArraySelectInput } from '../../../platform/input';
import { createRng, type Rng } from '../../../platform/rng';
import { useExerciseEngine, type LevelConfig } from '../../engine';
import Portrait from '../../shared/Portrait';
import { generateDiscriminationTrial, type DiscriminationTrial } from '../../shared/portraits';
import type { ExerciseProps } from '../../types';

/**
 * Discrimination (Plan §6.2, Übung 5, zwei Varianten): Arbeitsgedächtnis/
 * Selektion. a=7, b=21, c=3 je Variante. Vorlage merken, aus einem Array von
 * Kandidaten-Portraits das exakt passende wählen. `hasDelay` steuert nur, ob
 * die Vorlage vor der Auswahl kurz verschwindet (Delay-Variante).
 */
const CONFIG: LevelConfig = { levels: 7, minTrials: 21, advanceStreak: 3 };
const STUDY_MS = 1500;
const FLASH_MS = 700;

interface Difficulty {
  candidateCount: number;
  diffAttrCount: number;
}

const DIFFICULTY_BY_LEVEL: Record<number, Difficulty> = {
  1: { candidateCount: 3, diffAttrCount: 3 },
  2: { candidateCount: 3, diffAttrCount: 3 },
  3: { candidateCount: 4, diffAttrCount: 2 },
  4: { candidateCount: 4, diffAttrCount: 2 },
  5: { candidateCount: 5, diffAttrCount: 1 },
  6: { candidateCount: 5, diffAttrCount: 1 },
  7: { candidateCount: 6, diffAttrCount: 1 },
};

function delayMsForLevel(level: number): number {
  return 1200 + (level - 1) * 150;
}

type Phase = 'study' | 'delay' | 'choose';

interface DiscriminationExerciseProps extends ExerciseProps {
  hasDelay: boolean;
}

export default function DiscriminationExercise({
  seed,
  hasDelay,
  onComplete,
  onCancel,
}: DiscriminationExerciseProps) {
  const exerciseId = hasDelay ? 'discrimination-delay' : 'discrimination';
  const { state, recordTrial } = useExerciseEngine(exerciseId, CONFIG, onComplete);
  const rngRef = useRef<Rng>(createRng(seed));
  const [trialId, setTrialId] = useState(0);
  const [trial, setTrial] = useState<DiscriminationTrial | null>(null);
  const [phase, setPhase] = useState<Phase>('study');
  const [flash, setFlash] = useState<'success' | 'error' | null>(null);

  // Neuer Trial: Vorlage/Kandidaten erzeugen, Studier-/Delay-Phase starten.
  useEffect(() => {
    if (state.done) return;
    const difficulty = DIFFICULTY_BY_LEVEL[Math.min(state.level, 7)] ?? DIFFICULTY_BY_LEVEL[7]!;
    const generated = generateDiscriminationTrial(rngRef.current, difficulty.diffAttrCount, difficulty.candidateCount);
    setTrial(generated);
    setPhase('study');

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    timeouts.push(
      setTimeout(() => {
        if (hasDelay) {
          setPhase('delay');
          timeouts.push(setTimeout(() => setPhase('choose'), delayMsForLevel(state.level)));
        } else {
          setPhase('choose');
        }
      }, STUDY_MS),
    );

    return () => timeouts.forEach(clearTimeout);
  }, [trialId, state.level, state.done, hasDelay]);

  const handleSelect = useCallback(
    (index: number) => {
      if (!trial || phase !== 'choose' || flash !== null) return;
      const correct = index === trial.correctIndex;
      setFlash(correct ? 'success' : 'error');
      recordTrial({ result: correct ? 'correct' : 'error' });
    },
    [trial, phase, flash, recordTrial],
  );

  const selectedIndex = useArraySelectInput(trial?.candidates.length ?? 0, handleSelect, {
    enabled: phase === 'choose' && flash === null && !state.done,
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

      <h2 className="text-2xl font-bold text-slate-700 mb-6 text-center max-w-lg">
        {phase === 'choose' ? 'Welches Kätzchen passt genau?' : 'Schau dir das Kätzchen gut an!'}
      </h2>

      <div className="mb-10 flex items-center justify-center" style={{ minHeight: 140 }}>
        {phase !== 'delay' && trial && <Portrait attrs={trial.template} size={130} />}
        {phase === 'delay' && <div className="text-7xl">❓</div>}
      </div>

      {phase === 'choose' && trial && (
        <div className="flex gap-6 flex-wrap justify-center max-w-3xl">
          {trial.candidates.map((attrs, i) => {
            const isSelected = i === selectedIndex;
            const isCorrect = i === trial.correctIndex;
            let ring = 'ring-2 ring-slate-200';
            if (isSelected && flash === 'success') ring = 'ring-4 ring-green-500';
            else if (isSelected && flash === 'error') ring = 'ring-4 ring-red-500';
            else if (flash === 'error' && isCorrect) ring = 'ring-4 ring-green-500';
            else if (flash === null && isSelected) ring = 'ring-4 ring-purple-500';

            return (
              <div key={i} className={`p-2 rounded-2xl bg-white transition-all ${ring}`}>
                <Portrait attrs={attrs} size={90} />
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10 text-slate-500 text-lg text-center max-w-lg">
        Bewege die Auswahl mit Joystick/Pfeiltasten, bestätige mit Arcade-Button/Enter.
      </div>
    </div>
  );
}
