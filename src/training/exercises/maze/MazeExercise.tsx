import { useCallback, useEffect, useRef, useState } from 'react';
import { now } from '../../../platform/timing';
import { useDirectionalInput } from '../../../platform/input';
import { createTrialGate, useExerciseEngine } from '../../engine';
import { EXERCISE_CONFIGS } from '../../exerciseConfigs';
import GridWorld, { type GridTileKind } from '../../shared/GridWorld';
import type { ExerciseProps } from '../../types';
import { GRID_SIZE, LEVEL_MAPS, getStartPosition } from './maps';

/** Maze (Plan §6.2, Übung 3): Antizipation/Planung. a=6, b=6, c=1. */
const CONFIG = EXERCISE_CONFIGS.maze;

const FLASH_MS = 500;

function tileKind(value: number): GridTileKind {
  if (value === 1) return 'hazard';
  if (value === 2) return 'target';
  return 'path';
}

export default function MazeExercise({ onComplete, onCancel, initialState, onLevelUp }: ExerciseProps) {
  const { state, recordTrial, logEvent } = useExerciseEngine('maze', CONFIG, onComplete, {
    logRawEvents: true,
    initialState,
    onLevelUp,
  });
  const [catPos, setCatPos] = useState(() => getStartPosition(1));
  const [flash, setFlash] = useState<'success' | null>(null);
  const [bumpSeq, setBumpSeq] = useState(0);
  const gateRef = useRef(createTrialGate());

  const map = LEVEL_MAPS[state.level] ?? LEVEL_MAPS[1]!;

  // Trial endet ausschließlich mit Erreichen des Ziels (Befund E/AP4): Wände
  // blockieren nur die Bewegung, sie zählen nicht mehr als Fehler.
  const handleTrialEnd = useCallback(() => {
    if (!gateRef.current.tryClose()) return;
    setFlash('success');
    recordTrial({ result: 'correct' });
  }, [recordTrial]);

  const handleBump = useCallback(
    (x: number, y: number) => {
      logEvent({ type: 'wallBump', level: state.level, x, y, ts: now() });
      setBumpSeq((n) => n + 1);
    },
    [logEvent, state.level],
  );

  const handleMove = useCallback(
    ({ dx, dy }: { dx: number; dy: number }) => {
      if (flash !== null) return;
      const nx = catPos.x + dx;
      const ny = catPos.y + dy;
      if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) return;

      const tile = map[ny]?.[nx];
      if (tile === 1) {
        handleBump(nx, ny);
        return;
      }

      setCatPos({ x: nx, y: ny });
      if (tile === 2) handleTrialEnd();
    },
    [catPos, map, flash, handleBump, handleTrialEnd],
  );

  useDirectionalInput(handleMove, {
    enabled: flash === null && !state.done,
    repeatDelayMs: 150,
    mode: '4-way',
  });

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
      bump={bumpSeq}
      level={state.level}
      counter={`Labyrinth ${state.totalTrials} / ${CONFIG.minTrials} geschafft`}
      instructions={<>Navigiere durch das Labyrinth zum Gras (🌿). Wände halten dich nur auf.</>}
      onExit={onCancel}
    />
  );
}
