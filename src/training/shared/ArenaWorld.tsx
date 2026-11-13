import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ExerciseHud,
  LevelUpOverlay,
  ParticleBurst,
  TrainingBackdrop,
  soundManager,
  useGameFeel,
  type TrialFlash,
} from '../../ui';
import type { Vec2 } from './arenaMath';

/**
 * Kontinuierliche Arena für Navigations-Übungen (Side, Chase, Maze, Anticipation)
 * im Prozent-Koordinatensystem (`0..100`). Nutzt dieselbe Game-Feel-Schale wie
 * `GridWorld` (Backdrop, HUD, Level-Up-Overlay, Partikel, Shake, Lob-Popup,
 * gethrottelte Schritt-Sounds), positioniert die Katze aber direkt und ohne
 * CSS-Transition-Verzögerung auf `(catPos.x%, catPos.y%)`.
 */

export interface ArenaWorldProps {
  /** Mittelpunkt der Katze in Prozent-Koordinaten (`0..100`). */
  catPos: Vec2;
  /** Größe (Durchmesser) der Katze in Prozent der Arena-Breite (Standard: `10`). */
  catSize?: number;
  flash: TrialFlash;
  /** Nonce für Wand-Kollisionen (Maze): kurzes Shake+Sound ohne Trial-Ende. */
  bump?: number;
  level: number;
  /** Streak-Sterne im HUD; bei target ≤ 1 entfällt die Anzeige. */
  streak?: { current: number; target: number };
  counter?: string;
  instructions: ReactNode;
  onExit: () => void;
  /** Zusätzlicher Inhalt oberhalb der Arena (z. B. Anticipation-Wasserspur). */
  aboveArena?: ReactNode;
  catEmoji?: string;
  /** Hintergrund-/Stil-Klassen der Arena-Fläche (Standard: `bg-amber-50/90`). */
  arenaClassName?: string;
  /** Benutzerdefinierte Arena-Ebenen (Zonen, Hindernisse, Ziele, etc.). */
  children?: ReactNode;
}

const PRAISES = ['Super!', 'Toll!', 'Klasse!', 'Spitze!', 'Juhu!'];
const STEP_MIN_INTERVAL_MS = 180;
const STEP_MIN_DISTANCE = 1;
const TELEPORT_THRESHOLD = 25;

export default function ArenaWorld({
  catPos,
  catSize = 10,
  flash,
  bump = 0,
  level,
  streak,
  counter,
  instructions,
  onExit,
  aboveArena,
  catEmoji = '🐱',
  arenaClassName = 'bg-amber-50/90',
  children,
}: ArenaWorldProps) {
  const { levelUp } = useGameFeel(level, flash);

  // Wand-Bump (Maze): kurzes Shake+Sound unabhängig vom Trial-Flash.
  const [bumping, setBumping] = useState(false);
  const prevBump = useRef(bump);
  const bumpTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (bump === prevBump.current) return;
    prevBump.current = bump;
    soundManager.play('bump');
    setBumping(true);
    if (bumpTimeout.current !== null) clearTimeout(bumpTimeout.current);
    bumpTimeout.current = setTimeout(() => setBumping(false), 300);
  }, [bump]);
  useEffect(() => {
    return () => {
      if (bumpTimeout.current !== null) clearTimeout(bumpTimeout.current);
    };
  }, []);

  // Gethrottelter Schritt-Sound bei kontinuierlicher Bewegung (Sprünge = Reset → still).
  const prevPos = useRef(catPos);
  const accDist = useRef(0);
  const lastStepTime = useRef(-STEP_MIN_INTERVAL_MS);
  useEffect(() => {
    const frameDist = Math.hypot(catPos.x - prevPos.current.x, catPos.y - prevPos.current.y);
    prevPos.current = catPos;

    if (flash !== null || frameDist > TELEPORT_THRESHOLD) {
      accDist.current = 0;
      return;
    }
    if (frameDist === 0) return;

    accDist.current += frameDist;
    const nowMs = performance.now();
    if (
      nowMs - lastStepTime.current >= STEP_MIN_INTERVAL_MS &&
      accDist.current >= STEP_MIN_DISTANCE
    ) {
      soundManager.play('step');
      lastStepTime.current = nowMs;
      accDist.current = 0;
    }
  }, [catPos, flash]);

  const praiseIndex =
    Math.abs(Math.round(catPos.x) * 7 + Math.round(catPos.y) * 13 + level * 3) % PRAISES.length;
  const praise = PRAISES[praiseIndex];
  const displayCat = flash === 'success' ? '😸' : flash === 'error' ? '🙀' : catEmoji;

  return (
    <TrainingBackdrop flash={flash}>
      <ExerciseHud level={level} streak={streak} counter={counter} onExit={onExit} />
      <LevelUpOverlay level={level} visible={levelUp} />

      {aboveArena}

      <div
        data-testid="arena-surface"
        className={`relative mt-16 w-[90vw] max-w-[600px] aspect-square shadow-2xl rounded-2xl overflow-hidden border-4 transition-colors ${arenaClassName} ${
          flash === 'error' ? 'animate-shake border-rose-300' : 'border-white'
        } ${bumping ? 'animate-shake' : ''}`}
      >
        {children}

        {/* Katzen-Ebene: direkte Positionierung ohne CSS-Transition-Lag */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            data-testid="arena-cat"
            className="absolute flex items-center justify-center text-2xl sm:text-4xl"
            style={{
              width: `${catSize}%`,
              height: `${catSize}%`,
              left: `${catPos.x}%`,
              top: `${catPos.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span
              className={
                flash === 'success'
                  ? 'animate-pop'
                  : flash === 'error'
                    ? 'animate-dizzy'
                    : 'animate-cat-hop'
              }
            >
              {displayCat}
            </span>
            {flash === 'success' && <ParticleBurst className="absolute inset-0" />}
          </div>
        </div>

        {/* Lob-Popup über der Katze */}
        {flash === 'success' && (
          <div
            className="absolute pointer-events-none flex justify-center animate-rise-fade"
            style={{
              left: `${catPos.x}%`,
              top: `${Math.max(8, catPos.y - catSize * 0.6)}%`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 drop-shadow-sm whitespace-nowrap">
              {praise}
            </span>
          </div>
        )}
      </div>

      <div className="mt-8 text-center text-slate-600 text-xl font-medium max-w-lg bg-white/70 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-sm">
        {instructions}
      </div>
    </TrainingBackdrop>
  );
}
