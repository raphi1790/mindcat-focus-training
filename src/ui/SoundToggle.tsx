import { soundManager } from './sound/soundManager';
import { useSoundMuted } from './sound/useSoundMuted';

/** Mute-Knopf für die Trainings-Sounds (Plan §6.3: „Sound mit Mute-Option"). */
export default function SoundToggle() {
  const muted = useSoundMuted();
  return (
    <button
      type="button"
      onClick={() => soundManager.setMuted(!muted)}
      className="w-12 h-12 rounded-full bg-white/85 shadow-sm flex items-center justify-center text-xl hover:scale-110 active:scale-95 transition-transform"
      title={muted ? 'Ton einschalten' : 'Ton ausschalten'}
      aria-pressed={muted}
      aria-label={muted ? 'Ton einschalten' : 'Ton ausschalten'}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
