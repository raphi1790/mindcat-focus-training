import type { ReactNode } from 'react';
import {
  ExerciseHud,
  LevelUpOverlay,
  ParticleBurst,
  TrainingBackdrop,
  useGameFeel,
  type TrialFlash,
} from '../../ui';

/**
 * Gemeinsames Screen-Chrome der Wahl-Übungen (Discrimination, Number,
 * Number-Stroop, Farmer) — Phase-5-Pendant zu `GridWorld` für Übungen ohne
 * Gitter: Welt-Backdrop, HUD (Level, Streak-Sterne, Zähler, Mute,
 * HoldToExit), Erfolgs-Partikel, Level-Up-Feier und Feedback-Sounds.
 */
export interface ExerciseScreenProps {
  level: number;
  streak?: { current: number; target: number };
  counter?: string;
  heading: ReactNode;
  instructions: ReactNode;
  flash: TrialFlash;
  onExit: () => void;
  children: ReactNode;
}

export default function ExerciseScreen({
  level,
  streak,
  counter,
  heading,
  instructions,
  flash,
  onExit,
  children,
}: ExerciseScreenProps) {
  const { levelUp } = useGameFeel(level, flash);

  return (
    <TrainingBackdrop flash={flash}>
      <ExerciseHud level={level} streak={streak} counter={counter} onExit={onExit} />
      <LevelUpOverlay level={level} visible={levelUp} />

      <h2 className="text-2xl font-bold text-slate-700 mb-8 text-center max-w-lg bg-white/70 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-sm">
        {heading}
      </h2>

      <div className="relative flex flex-col items-center">
        {children}
        {flash === 'success' && <ParticleBurst className="absolute inset-0" count={14} radius={150} />}
      </div>

      <div className="mt-10 text-slate-600 text-lg text-center max-w-lg bg-white/70 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-sm">
        {instructions}
      </div>
    </TrainingBackdrop>
  );
}
