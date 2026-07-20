import { useMemo } from 'react';

/**
 * Emoji-Partikel-Explosion bei Erfolg (Plan §6.3 „Partikel/Juice"). Wird
 * konditional gemountet — die Animation läuft einmal beim Einhängen.
 * „Zufall" ist ein purer Index-Hash (renderstabil, Lint-konform) — für
 * Deko-Streuung reicht das völlig; die Science-RNG bleibt unberührt.
 */
export interface ParticleBurstProps {
  count?: number;
  emojis?: string[];
  /** Streuradius in px. */
  radius?: number;
  className?: string;
}

const DEFAULT_EMOJIS = ['✨', '⭐', '🌟'];

/** Purer Pseudo-Zufall aus einem Index (klassischer Sinus-Hash). */
function hash(n: number): number {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export default function ParticleBurst({
  count = 10,
  emojis = DEFAULT_EMOJIS,
  radius = 90,
  className = '',
}: ParticleBurstProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + hash(i) * 0.6;
        const distance = radius * (0.6 + hash(i + 1) * 0.4);
        return {
          emoji: emojis[Math.floor(hash(i + 2) * emojis.length)] ?? '✨',
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          delay: hash(i + 3) * 0.08,
          size: 14 + hash(i + 4) * 14,
        };
      }),
    [count, emojis, radius],
  );

  return (
    <div aria-hidden className={`pointer-events-none ${className}`}>
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 animate-sparkle"
          style={{
            fontSize: p.size,
            animationDelay: `${p.delay}s`,
            ['--dx' as string]: `${p.dx}px`,
            ['--dy' as string]: `${p.dy}px`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
