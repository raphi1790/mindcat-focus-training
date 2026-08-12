import { useEffect, useRef, useState } from 'react';

/**
 * Kindersicherung zum Beenden (Plan §6.3): 3 Sekunden durchgehend halten —
 * per Maus/Touch auf dem Knopf oder per Escape-Taste (für Betreuer an
 * Tastatur/Arcade-Aufbau). Einzelne Tastendrücke bewirken nichts, versehent-
 * liche Abbrüche sind damit ausgeschlossen. Bewusst ohne Sound/Animation-
 * Schnickschnack: wird auch im ANT verwendet (Test bleibt clean).
 */

const HOLD_MS = 3000;

export interface HoldToExitProps {
  onExit: () => void;
  /**
   * true (Default): positioniert sich selbst absolut oben rechts (ANT,
   * Alt-Layouts). false: rendert inline, Positionierung übernimmt der Parent
   * (z. B. ExerciseHud).
   */
  floating?: boolean;
}

export default function HoldToExit({ onExit, floating = true }: HoldToExitProps) {
  const [isHolding, setIsHolding] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onExitRef = useRef(onExit);

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  const startHold = () => {
    if (timeoutRef.current !== null) return;
    setIsHolding(true);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      onExitRef.current();
    }, HOLD_MS);
  };

  const cancelHold = () => {
    setIsHolding(false);
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Escape gedrückt halten = gleicher 3-Sekunden-Halte-Mechanismus.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.repeat) startHold();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelHold();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      className={`${floating ? 'absolute top-6 right-6 z-50' : 'relative'} w-16 h-16 flex items-center justify-center cursor-pointer touch-none select-none`}
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={(e) => {
        e.preventDefault(); // Kontextmenü bei Long-Press verhindern
        startHold();
      }}
      onTouchEnd={cancelHold}
      onTouchCancel={cancelHold}
      title="3 Sekunden gedrückt halten, um zu beenden (oder Escape halten)"
    >
      {/* Hintergrund-Ring */}
      <svg className="w-16 h-16 absolute opacity-30 text-slate-400" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" />
      </svg>

      {/* Fortschritts-Ring */}
      <svg className="w-16 h-16 absolute -rotate-90 text-red-500" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeDasharray="283"
          strokeDashoffset={isHolding ? '0' : '283'}
          className={`transition-all ease-linear ${isHolding ? 'duration-[3000ms]' : 'duration-300'}`}
        />
      </svg>

      <div
        className={`relative z-10 text-2xl font-bold transition-colors ${isHolding ? 'text-red-500' : 'text-slate-400'}`}
      >
        ✕
      </div>
    </div>
  );
}
