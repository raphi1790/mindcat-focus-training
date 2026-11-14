import { useCallback, useEffect, useRef, useState } from 'react';
import { useContinuousDirection } from '../../../platform/input';
import { createTrialRng, type Rng } from '../../../platform/rng';
import type { TrialFlash } from '../../../ui';
import { createTrialGate, useExerciseEngine } from '../../engine';
import { EXERCISE_CONFIGS } from '../../exerciseConfigs';
import ArenaWorld from '../../shared/ArenaWorld';
import { clampPos, useAnimationLoop, type Vec2 } from '../../shared/arenaMath';
import type { ExerciseProps } from '../../types';
import {
  CAT_RADIUS,
  CAT_SIZE,
  CAT_SPEED,
  CHASE_CENTER,
  UMBRELLA_SIZE,
  checkChaseOverlap,
  chooseUmbrellaDirection,
  spawnUmbrellaPos,
  stepUmbrellaContinuous,
  timeLimitForLevel,
} from './collision';

/**
 * Chase (Plan §6.2, Übung 2): Verfolgung/Sustained Attention. a=7, b=21, c=3.
 * Ein Regenschirm bewegt sich kontinuierlich entlang von 2D-Vektoren (`0..100 %`),
 * prallt an Rändern ab und passt seine Richtung periodisch mit Level-abhängigem
 * Flucht-Bias an; die Katze verfolgt ihn stufenlos in 8 Richtungen.
 */
const CONFIG = EXERCISE_CONFIGS.chase;
const FLASH_MS = 500;

export default function ChaseExercise({ seed, onComplete, onCancel, initialState, onLevelUp }: ExerciseProps) {
  const { state, recordTrial } = useExerciseEngine('chase', CONFIG, onComplete, { initialState, onLevelUp });
  const [trialId, setTrialId] = useState(0);
  const [catPos, setCatPos] = useState<Vec2>(() => ({ ...CHASE_CENTER }));
  // Platzhalter — `setupTrial()` setzt Position & Vektor beim Mount deterministisch via `createTrialRng`.
  const [targetPos, setTargetPos] = useState<Vec2>({ x: 20, y: 20 });
  const [flash, setFlash] = useState<TrialFlash>(null);
  const [remainingMs, setRemainingMs] = useState(() => timeLimitForLevel(initialState?.level ?? 1));

  const catPosRef = useRef<Vec2>(catPos);
  const targetPosRef = useRef<Vec2>(targetPos);
  const targetVelRef = useRef<Vec2>({ x: 1, y: 0 });
  const turnTimerRef = useRef(0);
  const remainingRef = useRef(remainingMs);
  const trialRngRef = useRef<Rng | null>(null);
  const gateRef = useRef(createTrialGate());

  const inputEnabled = flash === null && !state.done;
  const dirRef = useContinuousDirection({ enabled: inputEnabled });

  const endTrial = useCallback(
    (caught: boolean) => {
      if (!gateRef.current.tryClose()) return;
      setFlash(caught ? 'success' : 'error');
      recordTrial({ result: caught ? 'correct' : 'missed' });
    },
    [recordTrial],
  );

  // Neuer Trial: deterministische Schirm-Startposition, Richtungsvektor und Zeitlimit setzen.
  useEffect(() => {
    if (state.done || flash !== null) return;

    const trialRng = createTrialRng(seed, state.totalTrials);
    trialRngRef.current = trialRng;

    const setupTrial = () => {
      gateRef.current.reset();
      const cat = { ...CHASE_CENTER };
      catPosRef.current = cat;
      setCatPos(cat);

      const target = spawnUmbrellaPos(cat, trialRng);
      targetPosRef.current = target;
      setTargetPos(target);

      targetVelRef.current = chooseUmbrellaDirection(target, cat, state.level, trialRng);
      turnTimerRef.current = 0;

      const limit = timeLimitForLevel(state.level);
      remainingRef.current = limit;
      setRemainingMs(limit);
    };
    setupTrial();
  }, [trialId, state.level, state.done, state.totalTrials, seed, flash]);

  // Kontinuierliche Bewegungs-, Kollisions- und Countdown-Schleife.
  useAnimationLoop((dtMs) => {
    const rng = trialRngRef.current;
    if (!rng) return;

    const { dx, dy } = dirRef.current;
    let nextCat = catPosRef.current;
    if (dx !== 0 || dy !== 0) {
      const catStep = (CAT_SPEED * dtMs) / 1000;
      nextCat = clampPos(
        { x: nextCat.x + dx * catStep, y: nextCat.y + dy * catStep },
        CAT_RADIUS,
        100 - CAT_RADIUS,
      );
      catPosRef.current = nextCat;
      setCatPos(nextCat);
    }

    const umbrellaStep = stepUmbrellaContinuous(
      targetPosRef.current,
      targetVelRef.current,
      nextCat,
      state.level,
      dtMs,
      turnTimerRef.current,
      rng,
    );
    targetPosRef.current = umbrellaStep.pos;
    targetVelRef.current = umbrellaStep.vel;
    turnTimerRef.current = umbrellaStep.turnTimerMs;
    setTargetPos(umbrellaStep.pos);

    if (checkChaseOverlap(nextCat, umbrellaStep.pos)) {
      // Issue #44: Katze bleibt während des 500ms-Erfolgsflashs sichtbar auf dem gefangenen Schirm.
      catPosRef.current = umbrellaStep.pos;
      setCatPos(umbrellaStep.pos);
      endTrial(true);
      return;
    }

    const prevRemaining = remainingRef.current;
    const nextRemaining = Math.max(0, prevRemaining - dtMs);
    remainingRef.current = nextRemaining;
    if (Math.ceil(nextRemaining / 100) !== Math.ceil(prevRemaining / 100) || nextRemaining === 0) {
      setRemainingMs(nextRemaining);
    }
    if (nextRemaining <= 0) {
      endTrial(false);
    }
  }, inputEnabled);

  useEffect(() => {
    if (flash === null) return;
    const timeout = setTimeout(() => {
      setFlash(null);
      setTrialId((id) => id + 1);
    }, FLASH_MS);
    return () => clearTimeout(timeout);
  }, [flash]);

  const speedIcon = state.level >= 4 ? '💨⚡' : state.level >= 2 ? '⚡' : '';
  const counterText = speedIcon
    ? `${speedIcon} Zeit: ${(remainingMs / 1000).toFixed(1)}s`
    : `Zeit: ${(remainingMs / 1000).toFixed(1)}s`;
  const umbrellaEmoji = state.level >= 3 ? '💨🌂' : '🌂';

  return (
    <ArenaWorld
      catPos={catPos}
      catSize={CAT_SIZE}
      flash={flash}
      level={state.level}
      streak={{ current: state.streak, target: CONFIG.advanceStreak }}
      counter={counterText}
      instructions={
        <>
          Fang den Schirm (🌂), bevor er wegläuft!
          <br />
          <span className="text-red-500 font-bold">Halt die Katze trocken.</span>
        </>
      }
      onExit={onCancel}
    >
      <div
        data-testid="chase-umbrella"
        className="absolute flex items-center justify-center text-2xl sm:text-4xl pointer-events-none"
        style={{
          width: `${UMBRELLA_SIZE}%`,
          height: `${UMBRELLA_SIZE}%`,
          left: `${targetPos.x}%`,
          top: `${targetPos.y}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <span className="animate-pop">{umbrellaEmoji}</span>
      </div>
    </ArenaWorld>
  );
}
