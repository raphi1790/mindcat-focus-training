import type { ResponseDirection } from '../../data/schema';

export type FishStatus = 'neutral' | 'success' | 'error';

interface FishProps {
  direction?: ResponseDirection;
  status?: FishStatus;
  className?: string;
}

/**
 * Der gelbe ANT-Fisch (Rueda 2004). Statusfarben (grün/rot) werden nur für
 * das Übungsblock-Feedback verwendet — im Testblock bleibt er neutral gelb.
 */
export default function Fish({ direction = 'R', status = 'neutral', className = '' }: FishProps) {
  const isLeft = direction === 'L';

  const bodyColor = '#FFD700';
  const strokeColor = '#1e293b'; // slate-800
  const feedbackColor = status === 'success' ? '#4ade80' : status === 'error' ? '#f87171' : bodyColor;

  return (
    <svg
      viewBox="0 0 100 60"
      className={`w-24 h-16 inline-block ${className}`}
      style={{ transform: `scaleX(${isLeft ? -1 : 1})` }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Tail */}
      <path
        d="M 25 30 L 5 15 L 10 30 L 5 45 Z"
        fill={feedbackColor}
        stroke={strokeColor}
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Body */}
      <ellipse cx="55" cy="30" rx="35" ry="20" fill={feedbackColor} stroke={strokeColor} strokeWidth="3" />

      {/* Eye */}
      <circle cx="75" cy="22" r="4" fill={strokeColor} />

      {/* Mouth based on status */}
      {status === 'neutral' && (
        <path d="M 85 32 Q 90 32 90 32" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      )}
      {status === 'success' && (
        <path d="M 82 30 Q 86 36 90 30" stroke={strokeColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      {status === 'error' && (
        <path d="M 82 34 Q 86 28 90 34" stroke={strokeColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}

      {/* Fin */}
      <path
        d="M 50 10 Q 60 5 65 15 Q 55 12 50 10 Z"
        fill={feedbackColor}
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
