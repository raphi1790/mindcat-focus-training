import { useEffect, useState } from 'react';
import type { ExerciseId, ExerciseResult } from '../../data/schema';
import { useConfirmInput } from '../../platform/input';
import { Confetti, ParticleBurst, soundManager } from '../../ui';
import { EXERCISE_ICONS, EXERCISE_LABELS } from '../labels';
import { starsForResult } from '../rewards';

/**
 * Kindgerechter Abschluss- und Belohnungsbildschirm für Trainingsübungen (Plan §6.3).
 *
 * Zeigt nach Abschluss einer Übung:
 * - Vollbild-Konfetti & Partikel-Burst
 * - Fanfare-Sound (via soundManager)
 * - Gestaffelt aufploppende Sterne (1–3 Sterne nach Effizienz)
 * - Höchstes erreichtes Level und Leistungs-Zusammenfassung (Trials, Trefferquote)
 * - Kindgerechte deutsche Lobtexte
 * - Steuerung über Button-Klick sowie Arcade-Button / Enter / Leertaste
 */

const STAR_STAGGER_MS = 350;

export interface ExerciseCompletionModalProps {
  /** Optional — falls nicht angegeben, wird `result.exerciseId` verwendet. */
  exerciseId?: ExerciseId;
  /** Vollständiges Übungsergebnis aus useExerciseEngine. */
  result: ExerciseResult;
  /** Callback beim Verlassen / Bestätigen. */
  onClose: () => void;
  /** Optionaler Callback zum direkten Neustart der Übung. */
  onRestart?: () => void;
  /** Optionaler automatischer Weiter-Timer in Millisekunden. */
  autoCloseMs?: number;
}

export default function ExerciseCompletionModal({
  exerciseId,
  result,
  onClose,
  onRestart,
  autoCloseMs,
}: ExerciseCompletionModalProps) {
  const id = exerciseId ?? result.exerciseId;
  const stars = starsForResult(result);
  const [shownStars, setShownStars] = useState(0);

  // Fanfare beim Mounten abspielen
  useEffect(() => {
    soundManager.play('fanfare');
  }, []);

  // Sterne gestaffelt einblenden mit Sternen-Sound
  useEffect(() => {
    if (shownStars >= stars) return;
    const timeout = setTimeout(() => {
      soundManager.play('star');
      setShownStars((n) => n + 1);
    }, STAR_STAGGER_MS);
    return () => clearTimeout(timeout);
  }, [shownStars, stars]);

  // Optionales automatisches Schließen
  useEffect(() => {
    if (!autoCloseMs) return;
    const timeout = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(timeout);
  }, [onClose, autoCloseMs]);

  // Eingabe über Arcade-Button / Enter / Leertaste
  useConfirmInput(onClose);

  const accuracyPercent =
    result.trials > 0 ? Math.round((result.correct / result.trials) * 100) : 100;

  const icon = EXERCISE_ICONS[id] ?? '🐱';
  const label = EXERCISE_LABELS[id] ?? id;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-completion-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md overflow-y-auto p-4"
    >
      <Confetti />

      <div className="relative bg-white rounded-3xl shadow-2xl border-4 border-amber-300 px-8 py-8 sm:px-12 sm:py-10 max-w-lg w-full text-center animate-pop my-auto">
        <ParticleBurst className="absolute inset-0" count={16} radius={180} />

        {/* Übungs-Icon */}
        <div className="text-7xl mb-2 animate-pop select-none" data-testid="completion-icon">
          {icon}
        </div>

        {/* Titel & Übungsname */}
        <h2
          id="exercise-completion-title"
          className="text-3xl sm:text-4xl font-extrabold text-slate-800 mb-1"
        >
          Geschafft!
        </h2>
        <p className="text-base sm:text-lg text-slate-500 mb-4 font-medium">{label}</p>

        {/* Erreichtes Level Badge */}
        <div
          data-testid="level-badge"
          className="inline-flex items-center gap-2 bg-amber-100 border border-amber-300 text-amber-900 text-sm sm:text-base font-bold px-4 py-1.5 rounded-full mb-6"
        >
          <span>🏆</span>
          <span>Level {result.highestLevel} erreicht!</span>
        </div>

        {/* Sterne-Wertung */}
        <div
          className="flex justify-center gap-3 mb-6"
          aria-label={`${stars} von 3 Sternen`}
          data-testid="stars-container"
        >
          {[0, 1, 2].map((i) => {
            const isShown = i < shownStars;
            return (
              <span
                key={`${i}-${isShown}`}
                data-testid={`star-${i + 1}`}
                className={`text-5xl sm:text-6xl transition-all ${
                  isShown ? 'animate-pop' : 'opacity-25 grayscale'
                }`}
              >
                ⭐
              </span>
            );
          })}
        </div>

        {/* Statistik-Karten */}
        <div className="grid grid-cols-2 gap-3 mb-6 text-left">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
            <div className="text-xs uppercase text-slate-400 font-semibold mb-0.5">
              Durchläufe
            </div>
            <div
              data-testid="stat-trials"
              className="text-lg font-bold text-slate-700 flex items-center gap-1.5"
            >
              <span>🔄</span>
              <span>{result.trials}</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
            <div className="text-xs uppercase text-slate-400 font-semibold mb-0.5">
              Treffer
            </div>
            <div
              data-testid="stat-correct"
              className="text-lg font-bold text-emerald-600 flex items-center gap-1.5"
            >
              <span>✅</span>
              <span>
                {result.correct} ({accuracyPercent}%)
              </span>
            </div>
          </div>
        </div>

        {/* Aktions-Buttons */}
        <div className="flex flex-col gap-3">
          {onRestart && (
            <button
              type="button"
              onClick={onRestart}
              className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold py-3.5 px-6 rounded-2xl transition-all text-lg shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Nochmal spielen</span>
              <span>🔄</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold py-3.5 px-6 rounded-2xl transition-all text-lg shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Zurück zur Übersicht</span>
            <span>🏠</span>
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-4">
          Arcade-Button, Leertaste oder Enter drücken
        </p>
      </div>
    </div>
  );
}
