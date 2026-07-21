import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ExerciseHud,
  LevelUpOverlay,
  ParticleBurst,
  TrainingBackdrop,
  soundManager,
  useGameFeel,
} from '../../ui';

/**
 * Gemeinsames Gitter-Rendering für alle Navigations-Übungen (Side, Chase,
 * Maze, Anticipation) — seit Phase 5 mit Game-Feel (Plan §6.3): weiche
 * Katzen-Bewegung (Transition statt Zellen-Sprung), Welt-Backdrop,
 * Erfolgs-Partikel, Fehler-Shake, Lob-Popup, Schritt-Sounds, Level-Up-Feier
 * und einheitlichem HUD (Level, Streak-Sterne, Zähler, Mute, HoldToExit).
 *
 * Die Gittergröße ist je Übung konstant (Schwierigkeit steuern die Übungen
 * selbst über Tile-Layout/Timing, nicht über wachsende Gitter) — daher genügt
 * eine reine `tileAt(x, y)`-Funktion statt eines zustandsbehafteten Grids.
 */

export type GridTileKind = 'path' | 'hazard' | 'target';

export interface GridWorldProps {
  cols: number;
  rows: number;
  tileAt: (x: number, y: number) => GridTileKind;
  /** Optionales Emoji-Decal auf einem Tile (z. B. 🌂 bei Chase, 🌿 auf Gras). */
  tileEmoji?: (x: number, y: number) => string | null;
  catPos: { x: number; y: number };
  flash: 'success' | 'error' | null;
  /**
   * Nonce, der bei jeder Wand-Kollision hochgezählt wird (Maze, AP4/Befund E):
   * löst kurzes Shake+Sound aus, ohne Trial-Ende oder Reset (im Unterschied zu
   * `flash: 'error'`).
   */
  bump?: number;
  level: number;
  /** Streak-Sterne im HUD; bei target ≤ 1 (Maze) entfällt die Anzeige. */
  streak?: { current: number; target: number };
  counter?: string;
  instructions: ReactNode;
  onExit: () => void;
  /** Zusätzlicher Inhalt oberhalb des Gitters (z. B. Anticipation-Wasserspur). */
  aboveGrid?: ReactNode;
  catEmoji?: string;
  /**
   * Übersteuert die Tailwind-Klasse für 'path'-Tiles (Standard: beiger
   * Sandboden). Side (AP5) nutzt neutrales Grau statt Beige — andere
   * Übungen (Maze, Chase, Anticipation) bleiben unverändert.
   */
  pathTileClass?: string;
}

const TILE_CLASS: Record<GridTileKind, string> = {
  hazard: 'bg-[radial-gradient(circle_at_30%_30%,#9c6b3c,#7a4a1f)] shadow-inner',
  target: 'bg-[radial-gradient(circle_at_35%_35%,#66ce6a,#3f9e44)] animate-pulse-soft',
  path: 'bg-amber-50/90',
};

const PRAISES = ['Super!', 'Toll!', 'Klasse!', 'Spitze!', 'Juhu!'];

export default function GridWorld({
  cols,
  rows,
  tileAt,
  tileEmoji,
  catPos,
  flash,
  bump = 0,
  level,
  streak,
  counter,
  instructions,
  onExit,
  aboveGrid,
  catEmoji = '🐱',
  pathTileClass,
}: GridWorldProps) {
  const { levelUp } = useGameFeel(level, flash);

  // Wand-Bump (Maze): eigener, kurzer Shake+Sound — unabhängig vom
  // Erfolg/Fehler-`flash` (kein Trial-Ende, keine Rücksetzung der Katze).
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

  // Schritt-Sound bei echten Einzelschritten (Sprünge = Trial-Reset → still).
  const prevPos = useRef(catPos);
  useEffect(() => {
    const stepDistance = Math.max(
      Math.abs(catPos.x - prevPos.current.x),
      Math.abs(catPos.y - prevPos.current.y),
    );
    prevPos.current = catPos;
    if (stepDistance === 1 && flash === null) soundManager.play('step');
  }, [catPos, flash]);

  // Lob-Wort pur aus Position/Level abgeleitet (renderstabil während des
  // Flashs — Katze und Level ändern sich erst beim Trial-Reset danach).
  const praise = PRAISES[(catPos.x * 7 + catPos.y * 13 + level * 3) % PRAISES.length];

  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const decal = tileEmoji?.(x, y) ?? null;
      const kind = tileAt(x, y);
      const tileClass = kind === 'path' && pathTileClass ? pathTileClass : TILE_CLASS[kind];
      cells.push(
        <div
          key={`${x}-${y}`}
          className={`w-full h-full border border-slate-200/20 flex items-center justify-center text-2xl sm:text-3xl transition-all duration-200 ${tileClass}`}
        >
          {decal && <span className="animate-pop">{decal}</span>}
        </div>,
      );
    }
  }

  const tileW = 100 / cols;
  const tileH = 100 / rows;
  const displayCat = flash === 'success' ? '😸' : flash === 'error' ? '🙀' : catEmoji;

  return (
    <TrainingBackdrop flash={flash}>
      <ExerciseHud level={level} streak={streak} counter={counter} onExit={onExit} />
      <LevelUpOverlay level={level} visible={levelUp} />

      {aboveGrid}

      <div
        className={`relative mt-16 w-[90vw] max-w-[600px] aspect-square shadow-2xl rounded-2xl overflow-hidden border-4 transition-colors ${
          flash === 'error' ? 'animate-shake border-rose-300' : 'border-white'
        } ${bumping ? 'animate-shake' : ''}`}
      >
        <div
          className="grid w-full h-full"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
        >
          {cells}
        </div>

        {/* Katzen-Ebene: gleitet weich zwischen Tiles (Arcade-Feel). */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute flex items-center justify-center text-2xl sm:text-4xl transition-all duration-150 ease-out"
            style={{
              width: `${tileW}%`,
              height: `${tileH}%`,
              left: `${catPos.x * tileW}%`,
              top: `${catPos.y * tileH}%`,
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
            style={{ width: `${tileW * 3}%`, left: `${(catPos.x - 1) * tileW}%`, top: `${catPos.y * tileH}%` }}
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
