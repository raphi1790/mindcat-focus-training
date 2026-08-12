import type { ReactNode } from 'react';

/**
 * Gemeinsames Welt-Thema aller Trainings-Screens (Plan §6.3 Art-Direction):
 * Himmel-Verlauf, Sonne, driftende Wolken, Hügel — plus weiche
 * Erfolgs-/Fehler-Tönung als Vollbild-Feedback. Rein dekorativ und nur im
 * Training; der ANT behält seinen minimalen, standardisierten Look.
 */

export type FlashKind = 'success' | 'error';

export interface TrainingBackdropProps {
  flash?: FlashKind | null;
  children: ReactNode;
}

const CLOUDS = [
  { top: '12%', duration: '75s', delay: '-10s', scale: 1.4, opacity: 0.9 },
  { top: '22%', duration: '95s', delay: '-45s', scale: 1.0, opacity: 0.7 },
  { top: '7%', duration: '110s', delay: '-70s', scale: 0.8, opacity: 0.6 },
];

export default function TrainingBackdrop({ flash = null, children }: TrainingBackdropProps) {
  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-gradient-to-b from-sky-300 via-sky-100 to-emerald-100">
      {/* Welt-Dekoration */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-24 left-10 text-6xl opacity-80 animate-pulse-soft">☀️</div>
        {CLOUDS.map((cloud, i) => (
          <div
            key={i}
            className="absolute text-6xl animate-drift"
            style={{
              top: cloud.top,
              opacity: cloud.opacity,
              animationDuration: cloud.duration,
              animationDelay: cloud.delay,
              scale: String(cloud.scale),
            }}
          >
            ☁️
          </div>
        ))}
        {/* Hügel am unteren Rand */}
        <div className="absolute -bottom-24 -left-1/4 w-3/4 h-48 rounded-[50%] bg-emerald-200/80" />
        <div className="absolute -bottom-28 -right-1/4 w-4/5 h-52 rounded-[50%] bg-emerald-300/60" />
      </div>

      {/* Erfolgs-/Fehler-Tönung (weich statt Vollflächen-Umschlag) */}
      <div
        aria-hidden
        className={`absolute inset-0 pointer-events-none bg-emerald-300/40 transition-opacity duration-200 ${flash === 'success' ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        aria-hidden
        className={`absolute inset-0 pointer-events-none bg-rose-400/30 transition-opacity duration-200 ${flash === 'error' ? 'opacity-100' : 'opacity-0'}`}
      />

      <div className="relative h-full w-full flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
