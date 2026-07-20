import type { ReactNode } from 'react';
import HoldToExit from '../../components/HoldToExit';

/**
 * Gemeinsames Gitter-Rendering für alle Navigations-Übungen (Side, Chase,
 * Maze, Anticipation): Katze, Gitter-Tiles, Erfolgs-/Fehler-Flash, HUD und
 * `HoldToExit`. Löst die bisherige Duplikation zwischen `TrainingGrid.jsx`
 * und `MazeExercise.jsx` auf.
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
  catPos: { x: number; y: number };
  flash: 'success' | 'error' | null;
  title: string;
  subtitle?: string;
  counter?: string;
  instructions: ReactNode;
  onExit: () => void;
  /** Zusätzlicher Inhalt oberhalb des Gitters (z. B. Anticipation-Anflugspur). */
  aboveGrid?: ReactNode;
  catEmoji?: string;
}

const TILE_CLASS: Record<GridTileKind, string> = {
  hazard: 'bg-[var(--color-mud)]',
  target: 'bg-[var(--color-grass)]',
  path: 'bg-amber-50',
};

export default function GridWorld({
  cols,
  rows,
  tileAt,
  catPos,
  flash,
  title,
  subtitle,
  counter,
  instructions,
  onExit,
  aboveGrid,
  catEmoji = '🐱',
}: GridWorldProps) {
  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const isCat = catPos.x === x && catPos.y === y;
      cells.push(
        <div
          key={`${x}-${y}`}
          className={`w-full h-full border border-slate-200/20 flex items-center justify-center text-2xl sm:text-3xl transition-all duration-200 ${TILE_CLASS[tileAt(x, y)]}`}
        >
          {isCat && <span className="animate-bounce">{catEmoji}</span>}
        </div>,
      );
    }
  }

  return (
    <div
      className={`flex flex-col items-center justify-center flex-1 w-full h-screen fixed inset-0 z-40 transition-colors duration-300 ${
        flash === 'error' ? 'bg-red-200' : flash === 'success' ? 'bg-green-200' : 'bg-slate-100'
      }`}
    >
      <HoldToExit onExit={onExit} />

      <div className="absolute top-8 left-8 text-2xl font-bold text-slate-600 bg-white px-4 py-2 rounded-xl shadow-sm">
        {title}
        {subtitle && <span className="text-sm font-normal text-slate-400 ml-2">{subtitle}</span>}
      </div>

      {counter && (
        <div className="absolute top-8 right-24 text-xl font-medium text-slate-500 bg-white px-4 py-2 rounded-xl shadow-sm">
          {counter}
        </div>
      )}

      {aboveGrid}

      <div
        className="mt-16 w-[90vw] max-w-[600px] aspect-square grid shadow-2xl rounded-2xl overflow-hidden border-4 border-white"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
      >
        {cells}
      </div>

      <div className="mt-8 text-center text-slate-500 text-xl font-medium max-w-lg">{instructions}</div>
    </div>
  );
}
