import { useCallback, useEffect, useRef, useState } from 'react';
import { useContinuousDirection } from '../../../platform/input';
import type { TrialFlash } from '../../../ui';
import { createTrialGate, useExerciseEngine } from '../../engine';
import { EXERCISE_CONFIGS } from '../../exerciseConfigs';
import ArenaWorld from '../../shared/ArenaWorld';
import { circleRectOverlap, clampPos, useAnimationLoop, type Vec2 } from '../../shared/arenaMath';
import type { ExerciseProps } from '../../types';
import { SIDE_CAT_RADIUS, SIDE_CAT_SIZE, getSideLayout, getStartPosition } from './maps';

/** Side (Plan §6.2, Übung 1): motorische Kontrolle. a=7, b=21, c=3. */
const CONFIG = EXERCISE_CONFIGS.side;

const FLASH_MS = 500;
const CAT_SPEED = 45;

export default function SideExercise({ onComplete, onCancel, initialState, onLevelUp }: ExerciseProps) {
  const { state, recordTrial } = useExerciseEngine('side', CONFIG, onComplete, { initialState, onLevelUp });
  const [catPos, setCatPos] = useState<Vec2>(() => getStartPosition(initialState?.level ?? 1));
  const [flash, setFlash] = useState<TrialFlash>(null);
  const catPosRef = useRef(catPos);
  const gateRef = useRef(createTrialGate());

  const layout = getSideLayout(state.level);
  const inputEnabled = flash === null && !state.done;
  const dirRef = useContinuousDirection({ enabled: inputEnabled });

  const handleTrialEnd = useCallback(
    (success: boolean) => {
      if (!gateRef.current.tryClose()) return;
      setFlash(success ? 'success' : 'error');
      recordTrial({ result: success ? 'correct' : 'error' });
    },
    [recordTrial],
  );

  useAnimationLoop((dtMs) => {
    const { dx, dy } = dirRef.current;
    if (dx === 0 && dy === 0) return;

    const step = (CAT_SPEED * dtMs) / 1000;
    const next = clampPos(
      { x: catPosRef.current.x + dx * step, y: catPosRef.current.y + dy * step },
      SIDE_CAT_RADIUS,
      100 - SIDE_CAT_RADIUS,
    );
    catPosRef.current = next;
    setCatPos(next);

    if (layout.grass.some((r) => circleRectOverlap(next, SIDE_CAT_RADIUS, r))) {
      handleTrialEnd(true);
    } else if (layout.mud.some((r) => circleRectOverlap(next, SIDE_CAT_RADIUS, r))) {
      handleTrialEnd(false);
    }
  }, inputEnabled);

  useEffect(() => {
    if (flash === null) return;
    const timeout = setTimeout(() => {
      const start = getStartPosition(state.level);
      catPosRef.current = start;
      setCatPos(start);
      setFlash(null);
      gateRef.current.reset();
    }, FLASH_MS);
    return () => clearTimeout(timeout);
  }, [flash, state.level]);

  return (
    <ArenaWorld
      catPos={catPos}
      catSize={SIDE_CAT_SIZE}
      flash={flash}
      level={state.level}
      streak={{ current: state.streak, target: CONFIG.advanceStreak }}
      counter={`${state.totalTrials} / ${CONFIG.minTrials}`}
      arenaClassName="bg-slate-300"
      instructions={
        <>
          Bewege die Katze (🐱) mit Joystick oder Pfeiltasten zum Gras (🌿).
          <br />
          <span className="text-red-500 font-bold">Vermeide den Schlamm!</span>
        </>
      }
      onExit={onCancel}
    >
      {layout.mud.map((r, i) => (
        <div
          key={`mud-${i}`}
          data-testid="side-mud"
          className="absolute bg-[radial-gradient(circle_at_30%_30%,#9c6b3c,#7a4a1f)] shadow-inner"
          style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.width}%`, height: `${r.height}%` }}
        />
      ))}
      {layout.grass.map((r, i) => (
        <div
          key={`grass-${i}`}
          data-testid="side-grass"
          className="absolute flex items-center justify-center text-2xl sm:text-3xl bg-[radial-gradient(circle_at_35%_35%,#66ce6a,#3f9e44)] animate-pulse-soft"
          style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.width}%`, height: `${r.height}%` }}
        >
          <span className="animate-pop">🌿</span>
        </div>
      ))}
    </ArenaWorld>
  );
}
