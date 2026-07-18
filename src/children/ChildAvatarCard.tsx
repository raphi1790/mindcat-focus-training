import { deriveAvatar } from './avatar';
import { progressLabel } from './progressLabel';
import type { Child } from '../data/schema';
import type { ChildProgress } from '../data/progress';

interface ChildAvatarCardProps {
  child: Child;
  focused: boolean;
  progress?: ChildProgress;
  onClick: () => void;
}

/** Große, kindgerechte Auswahl-Karte mit deterministischem Tier-Avatar. */
export default function ChildAvatarCard({ child, focused, progress, onClick }: ChildAvatarCardProps) {
  const { animal, color } = deriveAvatar(child.id);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-3 p-6 rounded-[2rem] bg-white shadow-md border-4 transition-all ${
        focused
          ? 'border-purple-500 scale-105 shadow-xl'
          : 'border-transparent hover:border-purple-200'
      }`}
    >
      <div
        className="w-28 h-28 rounded-full flex items-center justify-center text-6xl shadow-inner"
        style={{ backgroundColor: `${color}33` }}
      >
        <span>{animal}</span>
      </div>
      <span className="text-xl font-extrabold text-slate-800 text-center">{child.displayName}</span>
      <span className="text-sm font-semibold text-slate-400">{child.ageGroup} Jahre</span>
      {progress && (
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-center">
          {progressLabel(progress)}
        </span>
      )}
    </button>
  );
}
