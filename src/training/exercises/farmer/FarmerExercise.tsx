import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfirmInput } from '../../../platform/input';
import { createTrialRng } from '../../../platform/rng';
import { useExerciseEngine, type TrialResultKind } from '../../engine';
import { EXERCISE_CONFIGS } from '../../exerciseConfigs';
import ExerciseScreen from '../../shared/ExerciseScreen';
import type { ExerciseProps } from '../../types';
import { generateFarmerTrial, type FarmerTrial } from './generator';

/**
 * Farmer / Go-No-Go (Plan §6.2, Übung 8, nur 6-Jährige): Inhibitionskontrolle.
 * a=7, b=66, c=6 (≥1 No-Go im Streak) — der Qualifier `satisfiesQualifier`
 * markiert korrekt zurückgehaltene No-Go-Trials.
 *
 * Game-Feel-Grenze: Der Wolf-Morph bleibt bewusst ohne Sound/Extra-Animation —
 * ein auditiver oder auffälliger visueller Hinweis würde die Inhibitions-
 * aufgabe (visuelle Diskrimination Schaf/Wolf) verfälschen. Juice gibt es nur
 * als Feedback NACH der Antwort bzw. nach Ablauf des Antwortfensters.
 */
const CONFIG = EXERCISE_CONFIGS.farmer;
const FLASH_MS = 450;

export default function FarmerExercise({ seed, onComplete, onCancel }: ExerciseProps) {
  const { state, recordTrial } = useExerciseEngine('farmer', CONFIG, onComplete);
  const [trialId, setTrialId] = useState(0);
  const [trial, setTrial] = useState<FarmerTrial | null>(null);
  const [displayedKind, setDisplayedKind] = useState<'sheep' | 'wolf'>('sheep');
  const [flash, setFlash] = useState<'success' | 'error' | null>(null);

  const trialRef = useRef<FarmerTrial | null>(null);
  const respondedRef = useRef(false);

  const endTrial = useCallback(
    (result: TrialResultKind) => {
      setFlash(result === 'correct' ? 'success' : 'error');
      recordTrial({ result, satisfiesQualifier: trialRef.current?.isNoGoTrial ?? false });
    },
    [recordTrial],
  );
  const endTrialRef = useRef(endTrial);
  useEffect(() => {
    endTrialRef.current = endTrial;
  }, [endTrial]);

  // Neuer Trial: Stimulus wählen, Morph- und Antwortfenster-Timer starten.
  // In einer verschachtelten Funktion statt direkt im Effect-Body (vgl.
  // ChaseExercise.tsx) — das Setup reagiert auf einen neuen Trial (externes
  // Ereignis, ausgelöst nach Ablauf der Flash-Anzeige), keine reine
  // Render-Ableitung.
  useEffect(() => {
    if (state.done) return;

    const setupTrial = () => {
      // Eigene Rng-Instanz je Trial (AP3) — siehe Begründung in ChaseExercise.tsx.
      const trial = generateFarmerTrial(createTrialRng(seed, state.totalTrials), state.level);
      trialRef.current = trial;
      respondedRef.current = false;
      setTrial(trial);
      setDisplayedKind(trial.kind === 'wolf' ? 'wolf' : 'sheep');
      return trial;
    };
    const t = setupTrial();

    const timers: ReturnType<typeof setTimeout>[] = [];
    if (t.kind === 'morph' && t.morphDelayMs !== null) {
      timers.push(setTimeout(() => setDisplayedKind('wolf'), t.morphDelayMs));
    }
    timers.push(
      setTimeout(() => {
        if (respondedRef.current) return;
        respondedRef.current = true;
        endTrialRef.current(t.isNoGoTrial ? 'correct' : 'missed');
      }, t.responseWindowMs),
    );

    return () => timers.forEach(clearTimeout);
  }, [trialId, state.level, state.done, state.totalTrials, seed]);

  const handleConfirm = useCallback(() => {
    if (respondedRef.current || !trialRef.current) return;
    respondedRef.current = true;
    endTrialRef.current(trialRef.current.isNoGoTrial ? 'error' : 'correct');
  }, []);

  useConfirmInput(handleConfirm, { enabled: flash === null && trial !== null && !state.done });

  useEffect(() => {
    if (flash === null) return;
    const timeout = setTimeout(() => {
      setFlash(null);
      setTrialId((id) => id + 1);
    }, FLASH_MS);
    return () => clearTimeout(timeout);
  }, [flash]);

  const circle =
    flash === 'success'
      ? 'bg-green-100 border-green-400 animate-pop'
      : flash === 'error'
        ? 'bg-red-100 border-red-400 animate-shake'
        : 'bg-white border-slate-200';

  return (
    <ExerciseScreen
      level={state.level}
      streak={{ current: state.streak, target: CONFIG.advanceStreak }}
      counter={`${state.totalTrials} / ${CONFIG.minTrials}`}
      heading="Schaf → klicken! Wolf → still halten!"
      instructions={
        <>
          Schaf (🐑): Arcade-Button/Enter drücken, so schnell du kannst.
          <br />
          <span className="text-red-500 font-bold">
            Wolf (🐺): NICHT drücken — auch wenn er erst später auftaucht!
          </span>
        </>
      }
      flash={flash}
      onExit={onCancel}
    >
      <div
        className={`w-56 h-56 rounded-full border-4 shadow-sm flex items-center justify-center text-9xl transition-colors ${circle}`}
      >
        {/* Kein Morph-Juice: Schaf und Wolf erscheinen/wechseln neutral. */}
        {trial && (displayedKind === 'sheep' ? '🐑' : '🐺')}
      </div>
    </ExerciseScreen>
  );
}
