import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { now } from '../../../platform/timing';
import { useContinuousDirection } from '../../../platform/input';
import { createTrialGate, useExerciseEngine } from '../../engine';
import { EXERCISE_CONFIGS } from '../../exerciseConfigs';
import ArenaWorld from '../../shared/ArenaWorld';
import {
  circlesOverlap,
  slideMoveWithObstacles,
  useAnimationLoop,
  type Vec2,
} from '../../shared/arenaMath';
import type { ExerciseProps } from '../../types';
import { getMazeArenaLayout } from './maps';

/** Maze (Plan §6.2, Übung 3): Antizipation/Planung. a=6, b=6, c=1. */
const CONFIG = EXERCISE_CONFIGS.maze;

const FLASH_MS = 500;
const CAT_SPEED = 36; // Prozent der Arena-Breite pro Sekunde
const BUMP_COOLDOWN_MS = 300;

export default function MazeExercise({
  onComplete,
  onCancel,
  initialState,
  onLevelUp,
}: ExerciseProps) {
  const { state, recordTrial, logEvent } = useExerciseEngine('maze', CONFIG, onComplete, {
    logRawEvents: true,
    initialState,
    onLevelUp,
  });
  const initialLevel = initialState?.level ?? 1;
  const [displayLevel, setDisplayLevel] = useState(initialLevel);
  const [catPos, setCatPos] = useState<Vec2>(() => getMazeArenaLayout(initialLevel).startPos);
  const [flash, setFlash] = useState<'success' | null>(null);
  const [bumpSeq, setBumpSeq] = useState(0);

  const posRef = useRef<Vec2>(catPos);
  const lastBumpRef = useRef(-BUMP_COOLDOWN_MS);
  const gateRef = useRef(createTrialGate());

  // Während des 500ms-Erfolgs-Flashs bleibt das abgeschlossene Labyrinth sichtbar,
  // damit Wände/Skalierung nicht vorzeitig umspringen und die Katze während des
  // Jubelns nicht in einer Wand des neuen Levels steht.
  const activeLevel = flash !== null ? displayLevel : state.level;
  const layout = useMemo(() => getMazeArenaLayout(activeLevel), [activeLevel]);

  const handleTrialEnd = useCallback(() => {
    if (!gateRef.current.tryClose()) return;
    setFlash('success');
    recordTrial({ result: 'correct' });
  }, [recordTrial]);

  const inputEnabled = flash === null && !state.done;
  const dirRef = useContinuousDirection({ enabled: inputEnabled });

  useAnimationLoop(
    (dtMs) => {
      if (flash !== null || state.done) return;
      const dir = dirRef.current;
      if (dir.dx === 0 && dir.dy === 0) return;

      const step = (CAT_SPEED * dtMs) / 1000;
      const delta = { x: dir.dx * step, y: dir.dy * step };
      const next = slideMoveWithObstacles(posRef.current, delta, layout.catRadius, layout.walls);
      const moved = Math.hypot(next.x - posRef.current.x, next.y - posRef.current.y);

      posRef.current = next;
      setCatPos(next);

      if (circlesOverlap(next, layout.catRadius, layout.goalPos, layout.goalRadius)) {
        handleTrialEnd();
        return;
      }

      // Nur bei echtem Festlaufen gegen eine Wand (nicht beim freien Korridor-Sliding)
      // gedrosselt einen Bump-Impuls + rawEvent erfassen.
      if (step > 0 && moved < step * 0.25) {
        const ts = now();
        if (ts - lastBumpRef.current >= BUMP_COOLDOWN_MS) {
          lastBumpRef.current = ts;
          logEvent({
            type: 'wallBump',
            level: activeLevel,
            x: Math.round(next.x * 10) / 10,
            y: Math.round(next.y * 10) / 10,
            ts,
          });
          setBumpSeq((n) => n + 1);
        }
      }
    },
    inputEnabled,
  );

  useEffect(() => {
    if (flash === null) return;
    const timeout = setTimeout(() => {
      setFlash(null);
      setDisplayLevel(state.level);
      const nextStart = getMazeArenaLayout(state.level).startPos;
      posRef.current = nextStart;
      setCatPos(nextStart);
      gateRef.current.reset();
    }, FLASH_MS);
    return () => clearTimeout(timeout);
  }, [flash, state.level]);

  return (
    <ArenaWorld
      catPos={catPos}
      catSize={layout.catSize}
      flash={flash}
      bump={bumpSeq}
      level={state.level}
      counter={`Labyrinth ${state.totalTrials} / ${CONFIG.minTrials} geschafft`}
      instructions={<>Navigiere durch das Labyrinth zum Gras (🌿). Wände halten dich nur auf.</>}
      onExit={onCancel}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        data-testid="maze-layout"
        data-grid-size={layout.gridSize}
      >
        {layout.walls.map((w, i) => (
          <div
            key={i}
            data-testid="maze-wall"
            className="absolute bg-[radial-gradient(circle_at_30%_30%,#9c6b3c,#7a4a1f)] shadow-inner border border-amber-950/20"
            style={{
              left: `${w.x}%`,
              top: `${w.y}%`,
              width: `${w.width}%`,
              height: `${w.height}%`,
            }}
          />
        ))}
        <div
          data-testid="maze-goal"
          className="absolute flex items-center justify-center rounded-lg bg-[radial-gradient(circle_at_35%_35%,#66ce6a,#3f9e44)] animate-pulse-soft text-2xl sm:text-3xl"
          style={{
            left: `${layout.goalPos.x}%`,
            top: `${layout.goalPos.y}%`,
            width: `${layout.tileSize}%`,
            height: `${layout.tileSize}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          🌿
        </div>
      </div>
    </ArenaWorld>
  );
}
