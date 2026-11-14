import { useCallback, useEffect, useRef, useState } from 'react';
import { useContinuousDirection } from '../../../platform/input';
import { createTrialRng } from '../../../platform/rng';
import { createTrialGate, useExerciseEngine } from '../../engine';
import { EXERCISE_CONFIGS } from '../../exerciseConfigs';
import ArenaWorld from '../../shared/ArenaWorld';
import { circlesOverlap, clampPos, useAnimationLoop } from '../../shared/arenaMath';
import type { ExerciseProps } from '../../types';
import {
  type AnticipationPhase,
  CAT_MAX_X,
  CAT_MIN_X,
  CAT_RADIUS,
  CAT_SHORE_Y,
  CAT_SIZE,
  CAT_SPEED,
  DUCK_CATCH_RADIUS,
  type DuckTrajectory,
  INVISIBLE_VISIBLE_PROGRESS_LIMIT,
  SHORE_TOP_Y,
  catchWindowMsForLevel,
  duckPositionAt,
  isDuckVisibleInPond,
  pickDuckTrajectory,
  travelMsForLevel,
} from './anticipationEngine';

/**
 * Anticipation (Plan §6.2, Übung 4, zwei Varianten): antizipatorische
 * Aufmerksamkeit nach Rueda et al. (2005). a=7, b=21, c=3 je Variante.
 * Eine Ente schwimmt geradlinig mit konstantem Vektor über den Teich auf einen
 * Zielpunkt am Ufer zu; die Katze bewegt sich stufenlos entlang des Ufers.
 */
const CONFIG = EXERCISE_CONFIGS['anticipation-visible']; // identisch für beide Varianten
const FLASH_MS = 500;
const INITIAL_CAT_X = 50;

interface AnticipationExerciseProps extends ExerciseProps {
  visible: boolean;
}

export default function AnticipationExercise({
  seed,
  visible,
  onComplete,
  onCancel,
  initialState,
  onLevelUp,
}: AnticipationExerciseProps) {
  const exerciseId = visible ? 'anticipation-visible' : 'anticipation-invisible';
  const { state, recordTrial } = useExerciseEngine(exerciseId, CONFIG, onComplete, {
    initialState,
    onLevelUp,
  });

  const initialLevel = initialState?.level ?? 1;
  const [displayLevel, setDisplayLevel] = useState(initialLevel);
  const [catX, setCatX] = useState(INITIAL_CAT_X);
  const [trajectory, setTrajectory] = useState<DuckTrajectory>(() =>
    pickDuckTrajectory(createTrialRng(seed, initialState?.totalTrials ?? 0), INITIAL_CAT_X),
  );
  const [phase, setPhase] = useState<AnticipationPhase>('approaching');
  const [progress, setProgress] = useState(0);
  const [flash, setFlash] = useState<'success' | 'error' | null>(null);

  const catXRef = useRef(catX);
  const trajectoryRef = useRef(trajectory);
  const displayLevelRef = useRef(displayLevel);
  const phaseRef = useRef<AnticipationPhase>('approaching');
  const elapsedRef = useRef(0);
  const gateRef = useRef(createTrialGate());

  const endTrial = useCallback(
    (caught: boolean) => {
      if (!gateRef.current.tryClose()) return;
      setFlash(caught ? 'success' : 'error');
      recordTrial({ result: caught ? 'correct' : 'missed' });
    },
    [recordTrial],
  );

  // Neuen Trial erst nach Ablauf des 500ms-Flashs aufsetzen, damit Level,
  // Enten-Position und Teich-Abdeckung während der Feedback-Phase stabil bleiben.
  useEffect(() => {
    if (state.done || flash !== null) return;

    const trialRng = createTrialRng(seed, state.totalTrials);
    const nextTrajectory = pickDuckTrajectory(trialRng, catXRef.current);

    trajectoryRef.current = nextTrajectory;
    displayLevelRef.current = state.level;
    phaseRef.current = 'approaching';
    elapsedRef.current = 0;
    gateRef.current.reset();

    setTrajectory(nextTrajectory);
    setDisplayLevel(state.level);
    setPhase('approaching');
    setProgress(0);
  }, [flash, state.level, state.done, state.totalTrials, seed]);

  const inputEnabled = flash === null && !state.done;
  const dirRef = useContinuousDirection({ enabled: inputEnabled });

  useAnimationLoop((dtMs) => {
    if (flash !== null || state.done) return;

    const dir = dirRef.current;
    let nextCatX = catXRef.current;
    if (dir.dx !== 0) {
      nextCatX = clampPos(
        { x: nextCatX + dir.dx * CAT_SPEED * (dtMs / 1000), y: CAT_SHORE_Y },
        { x: CAT_MIN_X, y: CAT_SHORE_Y },
        { x: CAT_MAX_X, y: CAT_SHORE_Y },
      ).x;
      catXRef.current = nextCatX;
      setCatX(nextCatX);
    }

    const level = displayLevelRef.current;
    const travelMs = travelMsForLevel(level);
    const catchWindowMs = catchWindowMsForLevel(level);
    const nextElapsed = elapsedRef.current + dtMs;
    elapsedRef.current = nextElapsed;

    const nextProgress = Math.min(1, nextElapsed / travelMs);
    setProgress(nextProgress);

    if (nextElapsed >= travelMs && phaseRef.current === 'approaching') {
      phaseRef.current = 'catchable';
      setPhase('catchable');
    }

    if (phaseRef.current === 'catchable') {
      const target = trajectoryRef.current.target;
      if (circlesOverlap({ x: nextCatX, y: CAT_SHORE_Y }, CAT_RADIUS, target, DUCK_CATCH_RADIUS)) {
        endTrial(true);
        return;
      }
      if (nextElapsed >= travelMs + catchWindowMs) {
        endTrial(false);
      }
    }
  }, inputEnabled);

  useEffect(() => {
    if (flash === null) return;
    const timeout = setTimeout(() => {
      setFlash(null);
    }, FLASH_MS);
    return () => clearTimeout(timeout);
  }, [flash]);

  const duckPos = duckPositionAt(trajectory, progress);
  const divePos = duckPositionAt(trajectory, INVISIBLE_VISIBLE_PROGRESS_LIMIT);
  const duckVisible = isDuckVisibleInPond(visible ? 'visible' : 'invisible', phase, progress);
  const facingRight = trajectory.target.x >= trajectory.start.x;

  return (
    <ArenaWorld
      catPos={{ x: catX, y: CAT_SHORE_Y }}
      catSize={CAT_SIZE}
      flash={flash}
      level={state.level}
      streak={{ current: state.streak, target: CONFIG.advanceStreak }}
      counter={`${state.totalTrials} / ${CONFIG.minTrials}`}
      arenaClassName="bg-amber-100/95"
      instructions={
        visible ? (
          <>
            Beobachte die Ente (🦆) und lauf rechtzeitig zum Landepunkt am Ufer.
            <br />
            <span className="text-red-500 font-bold">Sei da, wenn sie ankommt!</span>
          </>
        ) : (
          <>
            Die Ente taucht unter — wohin schwimmt sie weiter?
            <br />
            <span className="text-red-500 font-bold">Lauf rechtzeitig zum erwarteten Punkt am Ufer!</span>
          </>
        )
      }
      onExit={onCancel}
    >
      {/* Teichfläche (oberer Bereich 0..82%) */}
      <div
        data-testid="anticipation-pond"
        className="absolute inset-x-0 top-0 bg-gradient-to-b from-sky-200 via-sky-300 to-cyan-400 pointer-events-none"
        style={{ height: `${SHORE_TOP_Y}%` }}
      />

      {/* Uferzone (unten 82..100%) */}
      <div
        data-testid="anticipation-shore"
        aria-hidden
        className="absolute inset-x-0 bottom-0 bg-amber-100/95 border-t-4 border-amber-300/80 pointer-events-none flex items-start justify-around pt-1"
        style={{ height: `${100 - SHORE_TOP_Y}%` }}
      >
        <span className="text-sm sm:text-base opacity-35 select-none">🌊</span>
        <span className="text-sm sm:text-base opacity-35 select-none">🌊</span>
        <span className="text-sm sm:text-base opacity-35 select-none">🌊</span>
      </div>

      {/* Teich-Abdeckung in der Unsichtbar-Variante (ab ~35% bis zum Ufer) */}
      {!visible && (
        <div
          data-testid="pond-cover"
          aria-hidden
          className="absolute inset-x-0 bg-emerald-600/35 backdrop-blur-[2px] border-y border-emerald-400/50 flex items-center justify-around z-10 pointer-events-none"
          style={{
            top: `${INVISIBLE_VISIBLE_PROGRESS_LIMIT * 100}%`,
            bottom: `${100 - SHORE_TOP_Y}%`,
          }}
        >
          <span className="text-xl sm:text-2xl opacity-75 select-none">🌿</span>
          <span className="text-xl sm:text-2xl opacity-75 select-none">🪷</span>
          <span className="text-xl sm:text-2xl opacity-75 select-none">🌿</span>
        </div>
      )}

      {/* Bläschen an der Eintauchstelle bei abgetauchter Ente */}
      {!duckVisible && phase === 'approaching' && (
        <span
          data-testid="duck-submerged-cue"
          aria-hidden
          className="absolute text-base sm:text-lg opacity-80 animate-pulse z-20 pointer-events-none"
          style={{
            left: `${divePos.x}%`,
            top: `${divePos.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          🫧
        </span>
      )}

      {/* Ankunftsziel-Markierung am Ufer während des Fangfensters */}
      {phase === 'catchable' && (
        <div
          data-testid="duck-landing-ring"
          aria-hidden
          className="absolute rounded-full bg-emerald-400/35 border-2 border-emerald-500/70 animate-pulse pointer-events-none z-10"
          style={{
            width: `${DUCK_CATCH_RADIUS * 2}%`,
            height: `${DUCK_CATCH_RADIUS * 2}%`,
            left: `${trajectory.target.x}%`,
            top: `${trajectory.target.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}

      {/* Ente auf ihrer kontinuierlichen Vektor-Bahn */}
      {duckVisible && (
        <span
          data-testid="anticipation-duck"
          className={`absolute z-20 text-2xl sm:text-4xl leading-none pointer-events-none ${
            phase === 'catchable' ? 'animate-pop' : 'animate-float-slow'
          }`}
          style={{
            left: `${duckPos.x}%`,
            top: `${duckPos.y}%`,
            transform: `translate(-50%, -50%) scaleX(${facingRight ? -1 : 1})`,
          }}
        >
          🦆
        </span>
      )}
    </ArenaWorld>
  );
}
