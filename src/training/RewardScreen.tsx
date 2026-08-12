import { useEffect, useState } from 'react';
import { useConfirmInput } from '../platform/input';
import type { ExerciseId } from '../data/schema';
import { ParticleBurst, TrainingBackdrop, soundManager } from '../ui';
import { EXERCISE_ICONS, EXERCISE_LABELS } from './labels';
import type { StarCount } from './rewards';

/**
 * Belohnungsschirm zwischen zwei Übungen eines Trainingstags (Plan §6.3
 * „Belohnungsschleifen"): gestaffelt einfliegende Sterne mit Sound,
 * Tagesfortschritt als Sammel-Leiste. Weiter per Arcade-Button/Enter/Klick
 * oder automatisch — rein kosmetische Meta-Ebene, die Trial-Struktur der
 * Übungen bleibt unberührt.
 */

const STAR_STAGGER_MS = 400;
const AUTO_CONTINUE_MS = 6000;

export interface RewardScreenProps {
  exerciseId: ExerciseId;
  stars: StarCount;
  /** Übungen des Tages in Reihenfolge (für die Sammel-Leiste). */
  dayExerciseIds: ExerciseId[];
  /** Anzahl bereits abgeschlossener Übungen (inkl. der gerade beendeten). */
  completedCount: number;
  onContinue: () => void;
}

export default function RewardScreen({
  exerciseId,
  stars,
  dayExerciseIds,
  completedCount,
  onContinue,
}: RewardScreenProps) {
  const [shownStars, setShownStars] = useState(0);

  // Sterne gestaffelt einblenden, jeder mit Glitzer-Sound.
  useEffect(() => {
    if (shownStars >= stars) return;
    const timeout = setTimeout(() => {
      soundManager.play('star');
      setShownStars((n) => n + 1);
    }, STAR_STAGGER_MS);
    return () => clearTimeout(timeout);
  }, [shownStars, stars]);

  // Automatisch weiter, damit kein Kind hängen bleibt.
  useEffect(() => {
    const timeout = setTimeout(onContinue, AUTO_CONTINUE_MS);
    return () => clearTimeout(timeout);
  }, [onContinue]);

  useConfirmInput(onContinue);

  const allDone = completedCount >= dayExerciseIds.length;

  return (
    <TrainingBackdrop>
      <div className="relative text-center bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl px-12 py-10 max-w-xl mx-4">
        <ParticleBurst className="absolute inset-0" count={16} radius={200} />

        <div className="text-7xl mb-3 animate-pop">{EXERCISE_ICONS[exerciseId]}</div>
        <h2 className="text-4xl font-extrabold text-slate-800 mb-1">Geschafft!</h2>
        <p className="text-lg text-slate-500 mb-6">{EXERCISE_LABELS[exerciseId]}</p>

        <div className="flex justify-center gap-3 mb-8" aria-label={`${stars} von 3 Sternen`}>
          {[0, 1, 2].map((i) => (
            <span
              key={`${i}-${i < shownStars}`}
              className={`text-6xl ${i < shownStars ? 'animate-pop' : 'opacity-25 grayscale'}`}
            >
              ⭐
            </span>
          ))}
        </div>

        {/* Sammel-Leiste: die Übungen des Tages */}
        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          {dayExerciseIds.map((id, i) => {
            const done = i < completedCount;
            const isNext = i === completedCount;
            return (
              <div
                key={`${id}-${i}`}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border-2 transition-all ${
                  done
                    ? 'bg-emerald-100 border-emerald-300'
                    : isNext
                      ? 'bg-white border-purple-400 animate-pulse-soft'
                      : 'bg-slate-100 border-slate-200 opacity-50 grayscale'
                }`}
                title={EXERCISE_LABELS[id]}
              >
                {done ? '✅' : EXERCISE_ICONS[id]}
              </div>
            );
          })}
        </div>

        <button
          onClick={onContinue}
          className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl hover:bg-purple-700 active:scale-95 transition-all text-xl shadow-md"
        >
          {allDone ? 'Zum Tagesabschluss 🏆' : 'Weiter geht’s! 🐱'}
        </button>
        <p className="text-xs text-slate-400 mt-3">Arcade-Button oder Enter drücken</p>
      </div>
    </TrainingBackdrop>
  );
}
