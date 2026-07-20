import { useCallback, useEffect, useRef, useState } from 'react';
import { useArraySelectInput } from '../../../platform/input';
import { createRng, type Rng } from '../../../platform/rng';
import { useSelectionSound } from '../../../ui';
import { createTrialGate, useExerciseEngine } from '../../engine';
import { EXERCISE_CONFIGS } from '../../exerciseConfigs';
import ExerciseScreen from '../../shared/ExerciseScreen';
import Portrait from '../../shared/Portrait';
import { generateDiscriminationTrial, type DiscriminationTrial } from '../../shared/portraits';
import type { ExerciseProps } from '../../types';

/**
 * Discrimination (Plan §6.2, Übung 5, zwei Varianten): Arbeitsgedächtnis/
 * Selektion. a=7, b=21, c=3 je Variante. Vorlage merken, aus einem Array von
 * Kandidaten-Portraits das exakt passende wählen. `hasDelay` steuert nur, ob
 * die Vorlage vor der Auswahl kurz verschwindet (Delay-Variante).
 */
const CONFIG = EXERCISE_CONFIGS.discrimination; // identisch für beide Varianten
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
  const gateRef = useRef(createTrialGate());

  // Neuer Trial: Vorlage/Kandidaten erzeugen, Studier-/Delay-Phase starten.
  useEffect(() => {
    if (state.done) return;
    gateRef.current.reset();
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
      if (!gateRef.current.tryClose()) return;
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
      heading={phase === 'choose' ? 'Welches Kätzchen passt genau?' : 'Schau dir das Kätzchen gut an!'}
      instructions="Bewege die Auswahl mit Joystick/Pfeiltasten, bestätige mit Arcade-Button/Enter."
      flash={flash}
      onExit={onCancel}
    >
      <div className="mb-10 flex items-center justify-center" style={{ minHeight: 140 }}>
        {(phase === 'study' || (phase === 'choose' && !hasDelay)) && trial && (
          <div data-testid="discrimination-template" className={phase === 'study' ? 'animate-pop' : undefined}>
            <Portrait attrs={trial.template} size={130} />
          </div>
        )}
        {(phase === 'delay' || (phase === 'choose' && hasDelay)) && (
          <div className="text-7xl animate-pulse-soft">❓</div>
        )}
      </div>

      {phase === 'choose' && trial && (
        <div className="flex gap-6 flex-wrap justify-center max-w-3xl">
          {trial.candidates.map((attrs, i) => {
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
              <div key={i} className={`p-2 rounded-2xl bg-white transition-all duration-150 ${ring} ${extra}`}>
                <Portrait attrs={attrs} size={90} />
              </div>
            );
          })}
        </div>
      )}
    </ExerciseScreen>
  );
}
