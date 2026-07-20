import { useCallback, useEffect, useRef, useState } from 'react';
import HoldToExit from '../../../components/HoldToExit';
import { useConfirmInput } from '../../../platform/input';
import { createRng, type Rng } from '../../../platform/rng';
import { useExerciseEngine, type LevelConfig, type TrialResultKind } from '../../engine';
import type { ExerciseProps } from '../../types';
import { generateFarmerTrial, type FarmerTrial } from './generator';

/**
 * Farmer / Go-No-Go (Plan §6.2, Übung 8, nur 6-Jährige): Inhibitionskontrolle.
 * a=7, b=66, c=6 (≥1 No-Go im Streak) — der Qualifier `satisfiesQualifier`
 * markiert korrekt zurückgehaltene No-Go-Trials.
 */
const CONFIG: LevelConfig = { levels: 7, minTrials: 66, advanceStreak: 6 };
const FLASH_MS = 450;

export default function FarmerExercise({ seed, onComplete, onCancel }: ExerciseProps) {
  const { state, recordTrial } = useExerciseEngine('farmer', CONFIG, onComplete);
  const rngRef = useRef<Rng>(createRng(seed));
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
  useEffect(() => {
    if (state.done) return;
    const t = generateFarmerTrial(rngRef.current, state.level);
    trialRef.current = t;
    respondedRef.current = false;
    setTrial(t);
    setDisplayedKind(t.kind === 'wolf' ? 'wolf' : 'sheep');

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
  }, [trialId, state.level, state.done]);

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

  const bg =
    flash === 'success' ? 'bg-green-100 border-green-400' : flash === 'error' ? 'bg-red-100 border-red-400' : 'bg-white border-slate-200';

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
        Schaf → klicken! Wolf → still halten!
      </h2>

      <div className={`w-56 h-56 rounded-full border-4 flex items-center justify-center text-9xl transition-colors ${bg}`}>
        {trial && (displayedKind === 'sheep' ? '🐑' : '🐺')}
      </div>

      <div className="mt-10 text-slate-500 text-lg text-center max-w-lg">
        Schaf (🐑): Arcade-Button/Enter drücken, so schnell du kannst.
        <br />
        <span className="text-red-500 font-bold">Wolf (🐺): NICHT drücken — auch wenn er erst später auftaucht!</span>
      </div>
    </div>
  );
}
