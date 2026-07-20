/**
 * Fortschritts-Sterne für den Advance-Streak (Plan §6.3 „Sterne/Fortschritt"):
 * zeigt kindgerecht, wie viele richtige Antworten in Folge noch bis zum
 * Level-Aufstieg fehlen. Bei Streak-Ziel 1 (z. B. Maze) entfällt die Anzeige.
 */
export interface StreakStarsProps {
  current: number;
  target: number;
}

export default function StreakStars({ current, target }: StreakStarsProps) {
  if (target <= 1) return null;
  return (
    <div
      className="flex gap-0.5 items-center"
      aria-label={`${current} von ${target} Sternen bis zum nächsten Level`}
    >
      {Array.from({ length: target }, (_, i) => {
        const filled = i < current;
        return (
          // key wechselt beim Füllen → Pop-Animation für den neu gewonnenen Stern
          <span
            key={`${i}-${filled}`}
            className={`text-2xl ${filled ? 'animate-pop' : 'opacity-30 grayscale'}`}
          >
            ⭐
          </span>
        );
      })}
    </div>
  );
}
