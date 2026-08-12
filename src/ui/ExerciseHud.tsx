import HoldToExit from './HoldToExit';
import SoundToggle from './SoundToggle';
import StreakStars from './StreakStars';

/**
 * Einheitliche HUD-Leiste aller Trainingsübungen (Plan §6.3 Art-Direction):
 * links Level-Badge + Streak-Sterne, rechts Zähler, Mute-Knopf und
 * HoldToExit-Kindersicherung.
 */
export interface ExerciseHudProps {
  level: number;
  streak?: { current: number; target: number };
  counter?: string;
  onExit: () => void;
}

export default function ExerciseHud({ level, streak, counter, onExit }: ExerciseHudProps) {
  return (
    <div className="absolute inset-x-0 top-0 z-50 flex items-center justify-between gap-3 p-4 sm:p-6 pointer-events-none">
      <div className="flex items-center gap-3">
        <div className="bg-white/85 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-sm flex items-center gap-2">
          <span className="text-2xl">🏅</span>
          <span className="text-2xl font-extrabold text-slate-700">Level {level}</span>
        </div>
        {streak && streak.target > 1 && (
          <div className="bg-white/85 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-sm">
            <StreakStars current={streak.current} target={streak.target} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pointer-events-auto">
        {counter && (
          <div className="bg-white/85 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-sm text-xl font-medium text-slate-500">
            {counter}
          </div>
        )}
        <SoundToggle />
        <HoldToExit onExit={onExit} floating={false} />
      </div>
    </div>
  );
}
