import { useMemo } from 'react';

/**
 * Vollbild-Konfettiregen für Abschluss-Feiern (Trainingstag geschafft).
 * Läuft einmal beim Mounten; „Zufall" ist ein purer Index-Hash
 * (renderstabil, Lint-konform).
 */
export interface ConfettiProps {
  count?: number;
}

const COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#22c55e', '#3b82f6', '#ec4899'];

/** Purer Pseudo-Zufall aus einem Index (klassischer Sinus-Hash). */
function hash(n: number): number {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export default function Confetti({ count = 80 }: ConfettiProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: hash(i) * 100,
        delay: hash(i + 0.1) * 2.2,
        duration: 2.6 + hash(i + 0.2) * 1.8,
        color: COLORS[Math.floor(hash(i + 0.3) * COLORS.length)] ?? '#f59e0b',
        width: 6 + hash(i + 0.4) * 6,
        height: 10 + hash(i + 0.5) * 8,
        spin: 360 + hash(i + 0.6) * 540,
      })),
    [count],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 animate-confetti rounded-[2px]"
          style={{
            left: `${p.left}%`,
            width: p.width,
            height: p.height,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--spin' as string]: `${p.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}
