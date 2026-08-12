import ParticleBurst from './ParticleBurst';

/**
 * Level-Up-Feier (Plan §6.3 „Level-Up-Belohnungen"): kurzes, nicht
 * interaktives Overlay — pointer-events-none, blockiert also weder Eingabe
 * noch Trial-Ablauf (wissenschaftliche Trial-Struktur bleibt unberührt).
 */
export interface LevelUpOverlayProps {
  level: number;
  visible: boolean;
}

export default function LevelUpOverlay({ level, visible }: LevelUpOverlayProps) {
  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
      <div className="relative animate-pop bg-white/95 rounded-3xl px-12 py-8 shadow-2xl border-4 border-amber-300 text-center">
        <ParticleBurst className="absolute inset-0" count={14} radius={140} />
        <div className="text-6xl mb-2">🎉</div>
        <div className="text-4xl font-extrabold text-amber-500">Level {level}!</div>
        <div className="text-xl text-slate-500 mt-1 font-medium">Weiter so!</div>
      </div>
    </div>
  );
}
