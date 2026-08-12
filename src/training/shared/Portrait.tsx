import type { PortraitAttributes } from './portraits';

/**
 * Rendert ein prozedurales Katzen-Portrait aus einem Attribut-Vektor
 * (reines CSS/Emoji, keine Bild-Assets) — für die Discrimination-Übungen.
 */

const FUR_COLORS = ['#f0a94e', '#8b5e3c', '#6b6f76', '#ece3cf', '#c96b6b', '#7a9e7e'];
const EYE_COLORS = ['#2e7d32', '#1565c0', '#f9a825', '#6a1b9a', '#00838f', '#455a64'];
const PATTERN_MARKS = ['', '〜', '●', '◆', '❥'];
const ACCESSORY_EMOJI = ['', '🎀', '⭐', '🌸', '🕶️', '🎩'];

export interface PortraitProps {
  attrs: PortraitAttributes;
  size?: number;
}

export default function Portrait({ attrs, size = 96 }: PortraitProps) {
  const fur = FUR_COLORS[attrs.furColor % FUR_COLORS.length];
  const eye = EYE_COLORS[attrs.eyeColor % EYE_COLORS.length];
  const mark = PATTERN_MARKS[attrs.pattern % PATTERN_MARKS.length];
  const accessory = ACCESSORY_EMOJI[attrs.accessory % ACCESSORY_EMOJI.length];
  const eyeSize = size * 0.13;

  return (
    <div
      className="relative rounded-full border-2 border-white shadow-sm"
      style={{ width: size, height: size, backgroundColor: fur }}
    >
      <div
        className="absolute rotate-45"
        style={{ top: -size * 0.08, left: size * 0.12, width: size * 0.22, height: size * 0.22, backgroundColor: fur }}
      />
      <div
        className="absolute rotate-45"
        style={{ top: -size * 0.08, right: size * 0.12, width: size * 0.22, height: size * 0.22, backgroundColor: fur }}
      />
      <div
        className="absolute flex items-center justify-center gap-[10%]"
        style={{ top: size * 0.38, left: 0, right: 0 }}
      >
        <div className="rounded-full" style={{ width: eyeSize, height: eyeSize, backgroundColor: eye }} />
        <div className="rounded-full" style={{ width: eyeSize, height: eyeSize, backgroundColor: eye }} />
      </div>
      {mark && (
        <div
          className="absolute flex items-center justify-center text-slate-700/70"
          style={{ top: size * 0.6, left: 0, right: 0, fontSize: size * 0.16 }}
        >
          {mark}
        </div>
      )}
      {accessory && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2" style={{ fontSize: size * 0.32 }}>
          {accessory}
        </span>
      )}
    </div>
  );
}
