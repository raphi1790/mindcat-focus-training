import { useCallback, useEffect, useRef, useState } from 'react';
import { useDirectionalInput } from '../../../platform/input';
import { createTrialGate, useExerciseEngine } from '../../engine';
import { EXERCISE_CONFIGS } from '../../exerciseConfigs';
import GridWorld, { type GridTileKind } from '../../shared/GridWorld';
import type { ExerciseProps } from '../../types';
import { GRID_SIZE, LEVEL_MAPS, getStartPosition } from './maps';

/** Side (Plan §6.2, Übung 1): motorische Kontrolle. a=7, b=21, c=3. */
const CONFIG = EXERCISE_CONFIGS.side;

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
  const gateRef = useRef(createTrialGate());

  const map = LEVEL_MAPS[state.level] ?? LEVEL_MAPS[1]!;

  const handleTrialEnd = useCallback(
    (success: boolean) => {
      if (!gateRef.current.tryClose()) return;
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
      gateRef.current.reset();
    }, FLASH_MS);
    return () => clearTimeout(timeout);
  }, [flash, state.level]);

  return (
    <GridWorld
      cols={GRID_SIZE}
      rows={GRID_SIZE}
      tileAt={(x, y) => tileKind(map[y]?.[x] ?? 0)}
      tileEmoji={(x, y) => (tileKind(map[y]?.[x] ?? 0) === 'target' ? '🌿' : null)}
      catPos={catPos}
      flash={flash}
      level={state.level}
      streak={{ current: state.streak, target: CONFIG.advanceStreak }}
      counter={`${state.totalTrials} / ${CONFIG.minTrials}`}
      pathTileClass="bg-slate-300"
      instructions={
        <>
          Bewege die Katze (🐱) mit Joystick oder Pfeiltasten zum Gras (🌿).
          <br />
          <span className="text-red-500 font-bold">Vermeide den Schlamm!</span>
        </>
      }
      onExit={onCancel}
    />
  );
}
