import { useCallback, useEffect, useState } from 'react';
import { useDirectionalInput } from '../../../platform/input';
import { useExerciseEngine, type LevelConfig } from '../../engine';
import GridWorld, { type GridTileKind } from '../../shared/GridWorld';
import type { ExerciseProps } from '../../types';
import { GRID_SIZE, LEVEL_MAPS, getStartPosition } from './maps';

/** Side (Plan §6.2, Übung 1): motorische Kontrolle. a=7, b=21, c=3. */
const CONFIG: LevelConfig = { levels: 7, minTrials: 21, advanceStreak: 3 };

const FLASH_MS = 500;

function tileKind(value: number): GridTileKind {
  if (value === 1) return 'hazard';
  if (value === 2) return 'target';
  return 'path';
}

export default function SideExercise({ onComplete, onCancel }: ExerciseProps) {
  const { state, recordTrial } = useExerciseEngine('side', CONFIG, onComplete);
  const [catPos, setCatPos] = useState(() => getStartPosition(1));
  const [flash, setFlash] = useState<'success' | 'error' | null>(null);

  const map = LEVEL_MAPS[state.level] ?? LEVEL_MAPS[1]!;

  const handleTrialEnd = useCallback(
    (success: boolean) => {
      setFlash(success ? 'success' : 'error');
      recordTrial({ result: success ? 'correct' : 'error' });
    },
    [recordTrial],
  );

  const handleMove = useCallback(
    ({ dx, dy }: { dx: number; dy: number }) => {
      if (flash !== null) return;
      const nx = catPos.x + dx;
      const ny = catPos.y + dy;
      if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) return;

      if (dx !== 0 && dy !== 0) {
        // Diagonale Eck-Kollision: beide angrenzenden Tiles Schlamm → blockiert.
        const tileX = map[catPos.y]?.[nx];
        const tileY = map[ny]?.[catPos.x];
        if (tileX === 1 && tileY === 1) {
          handleTrialEnd(false);
          return;
        }
      }

      setCatPos({ x: nx, y: ny });
      const tile = map[ny]?.[nx];
      if (tile === 1) handleTrialEnd(false);
      else if (tile === 2) handleTrialEnd(true);
    },
    [catPos, map, flash, handleTrialEnd],
  );

  useDirectionalInput(handleMove, { enabled: flash === null && !state.done, repeatDelayMs: 200 });

  useEffect(() => {
    if (flash === null) return;
    const timeout = setTimeout(() => {
      setFlash(null);
      setCatPos(getStartPosition(state.level));
    }, FLASH_MS);
    return () => clearTimeout(timeout);
  }, [flash, state.level]);

  return (
    <GridWorld
      cols={GRID_SIZE}
      rows={GRID_SIZE}
      tileAt={(x, y) => tileKind(map[y]?.[x] ?? 0)}
      catPos={catPos}
      flash={flash}
      title={`Level ${state.level}`}
      subtitle={`(${state.streak}/${CONFIG.advanceStreak} für Aufstieg)`}
      counter={`Durchläufe: ${state.totalTrials} / ${CONFIG.minTrials}`}
      instructions={
        <>
          Bewege die Katze (🐱) mit Joystick oder Pfeiltasten zum Gras (🟩).
          <br />
          <span className="text-red-500 font-bold">Vermeide den Schlamm!</span>
        </>
      }
      onExit={onCancel}
    />
  );
}
