import { useCallback, useEffect, useRef, useState } from 'react';
import { useDirectionalInput } from '../../../platform/input';
import { createTrialRng } from '../../../platform/rng';
import { createTrialGate, useExerciseEngine } from '../../engine';
import { EXERCISE_CONFIGS } from '../../exerciseConfigs';
import GridWorld from '../../shared/GridWorld';
import type { ExerciseProps } from '../../types';
import {
  type AnticipationPhase,
  catchWindowMsForLevel,
  isDuckVisibleInPond,
  lanesForLevel,
  pickTargetLane,
  travelMsForLevel,
} from './anticipationEngine';

/**
 * Anticipation (Plan §6.2, Übung 4, zwei Varianten): antizipatorische
 * Aufmerksamkeit. a=7, b=21, c=3 je Variante. Eine Ente schwimmt über
 * `travelMs` auf eine von `LANES` Spuren zu und "taucht" dort für
 * `catchWindowMs` auf — die Katze muss zu diesem Zeitpunkt in der richtigen
 * Spur stehen. `visible` steuert nur die Anzeige während der Anflugphase
 * (durchgehend sichtbare Annäherung vs. verdeckt) — die Erfolgsbedingung
 * (richtige Spur beim Auftauchen) ist in beiden Varianten identisch.
 */
const CONFIG = EXERCISE_CONFIGS['anticipation-visible']; // identisch für beide Varianten
const TICK_MS = 100;
const FLASH_MS = 500;

type Phase = 'approaching' | 'catchable';

interface AnticipationExerciseProps extends ExerciseProps {
  visible: boolean;
}

export default function AnticipationExercise({ seed, visible, onComplete, onCancel, initialState, onLevelUp }: AnticipationExerciseProps) {
  const exerciseId = visible ? 'anticipation-visible' : 'anticipation-invisible';
  const { state, recordTrial } = useExerciseEngine(exerciseId, CONFIG, onComplete, { initialState, onLevelUp });
  const initialLanes = lanesForLevel(initialState?.level ?? 1);
  const [activeLanes, setActiveLanes] = useState(initialLanes);
  const [lane, setLane] = useState(() => Math.floor(initialLanes / 2));
  const [targetLane, setTargetLane] = useState(0);
  const [phase, setPhase] = useState<Phase>('approaching');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [flash, setFlash] = useState<'success' | 'error' | null>(null);

  // Quelle der Wahrheit außerhalb von State-Updatern (React StrictMode ruft
  // Updater-Funktionen im Dev-Modus doppelt auf — Seiteneffekte wie
  // `endTrial` dürfen deshalb nie darin stehen).
  const laneRef = useRef(lane);
  const targetLaneRef = useRef(targetLane);
  const phaseRef = useRef<Phase>('approaching');
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
  const endTrialRef = useRef(endTrial);
  useEffect(() => {
    endTrialRef.current = endTrial;
  }, [endTrial]);

  // Neuer Trial: Zielspur wählen, Anflug- und Auftauch-Timer starten.
  // Während der 500ms Flash-Phase darf kein neuer Trial starten, damit Spur-Anzahl
  // (z. B. beim Level-Up 3 -> 4 von 5 auf 7 Spuren) und getroffene Zielspur während
  // der Erfolgsanimation stabil bleiben.
  useEffect(() => {
    if (state.done || flash !== null) return;

    // Eigene Rng-Instanz je Trial (AP3) — siehe Begründung in ChaseExercise.tsx.
    const trialRng = createTrialRng(seed, state.totalTrials);

    const setupTrial = () => {
      gateRef.current.reset();
      const currentLanes = lanesForLevel(state.level);
      setActiveLanes(currentLanes);
      const retainedCat = Math.min(Math.max(laneRef.current, 0), currentLanes - 1);
      laneRef.current = retainedCat;
      setLane(retainedCat);
      const target = pickTargetLane(trialRng, currentLanes, retainedCat);
      targetLaneRef.current = target;
      setTargetLane(target);
      phaseRef.current = 'approaching';
      setPhase('approaching');
      elapsedRef.current = 0;
      setElapsedMs(0);
    };
    setupTrial();

    const travelMs = travelMsForLevel(state.level);
    const catchWindowMs = catchWindowMsForLevel(state.level);

    const tick = setInterval(() => {
      const next = elapsedRef.current + TICK_MS;
      elapsedRef.current = next;
      setElapsedMs(next);

      if (next >= travelMs && phaseRef.current === 'approaching') {
        phaseRef.current = 'catchable';
        setPhase('catchable');
        if (laneRef.current === targetLaneRef.current) {
          clearInterval(tick);
          endTrialRef.current(true);
          return;
        }
      }

      if (next >= travelMs + catchWindowMs) {
        clearInterval(tick);
        if (phaseRef.current === 'catchable') endTrialRef.current(false);
      }
    }, TICK_MS);

    return () => clearInterval(tick);
  }, [flash, state.level, state.done, state.totalTrials, seed]);

  const handleMove = useCallback(
    ({ dx }: { dx: number; dy: number }) => {
      if (flash !== null || dx === 0) return;
      const currentLanes = lanesForLevel(state.level);
      const next = Math.min(Math.max(laneRef.current + dx, 0), currentLanes - 1);
      laneRef.current = next;
      setLane(next);
      if (phaseRef.current === 'catchable' && next === targetLaneRef.current) {
        endTrialRef.current(true);
      }
    },
    [flash, state.level],
  );

  useDirectionalInput(handleMove, { enabled: flash === null && !state.done, repeatDelayMs: 140 });

  useEffect(() => {
    if (flash === null) return;
    const timeout = setTimeout(() => {
      setFlash(null);
    }, FLASH_MS);
    return () => clearTimeout(timeout);
  }, [flash]);

  const travelMs = travelMsForLevel(state.level);
  const progress = Math.min(1, elapsedMs / travelMs);
  const duckTopPercent = phase === 'catchable' ? 82 : 8 + progress * 74;
  const duckVisible = isDuckVisibleInPond(visible ? 'visible' : 'invisible', phase as AnticipationPhase, progress);

  return (
    <GridWorld
      cols={activeLanes}
      rows={1}
      tileAt={(x) => (phase === 'catchable' && x === targetLane ? 'target' : 'path')}
      catPos={{ x: lane, y: 0 }}
      flash={flash}
      level={state.level}
      streak={{ current: state.streak, target: CONFIG.advanceStreak }}
      counter={`${state.totalTrials} / ${CONFIG.minTrials}`}
      aboveGrid={
        <div
          data-testid="anticipation-lanes"
          className="mt-16 w-[90vw] max-w-[600px] border-4 border-white rounded-2xl overflow-hidden shadow-lg grid"
          style={{ gridTemplateColumns: `repeat(${activeLanes}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: activeLanes }, (_, i) => {
            const isTarget = targetLane === i;
            const showDuckHere = isTarget && duckVisible;
            const duckSubmergedHere = isTarget && !duckVisible && phase === 'approaching';
            return (
              <div
                key={i}
                data-testid={`anticipation-lane-${i}`}
                className="aspect-[3/1] h-44 sm:h-52 relative min-w-0 overflow-hidden flex items-center justify-center text-2xl sm:text-3xl leading-none bg-gradient-to-b from-sky-200 via-sky-300 to-cyan-400 border border-sky-300/60 shadow-inner"
              >
                {/* Untere Teich-/Seerosen-Abdeckung in der Unsichtbar-Variante (ab 38% bis kurz vor dem Ufer) */}
                {!visible && (
                  <div
                    data-testid={`lily-cover-${i}`}
                    aria-hidden
                    className="absolute inset-x-0 top-[38%] bottom-[18%] bg-emerald-600/35 backdrop-blur-[2px] border-y border-emerald-400/50 flex items-center justify-center z-10 pointer-events-none"
                  >
                    <span className="text-lg sm:text-xl opacity-80 select-none">🌿</span>
                  </div>
                )}

                {/* Uferkante / Ankunftszone unten in jeder Spur */}
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-[18%] bg-amber-200/50 border-t-2 border-amber-300/80 flex items-center justify-center pointer-events-none"
                >
                  <span className="text-sm sm:text-base opacity-45 select-none">🌊</span>
                </div>

                {/* Dezente Bläschen an der Eintauchstelle, wenn die Ente unter Wasser schwimmt */}
                {duckSubmergedHere && (
                  <span
                    data-testid="duck-submerged-cue"
                    aria-hidden
                    className="absolute left-1/2 -translate-x-1/2 top-[34%] text-base sm:text-lg opacity-75 animate-pulse z-20 pointer-events-none"
                  >
                    🫧
                  </span>
                )}

                {/* Ente schwimmt vertikal in ihrer Zielspur von oben (8%) nach unten zum Ufer (82%) */}
                {showDuckHere && (
                  <span
                    data-testid="anticipation-duck"
                    className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-100 linear leading-none ${
                      phase === 'catchable' ? 'animate-pop' : 'animate-float-slow'
                    }`}
                    style={{ top: `${duckTopPercent}%` }}
                  >
                    🦆
                  </span>
                )}
              </div>
            );
          })}
        </div>
      }
      instructions={
        visible ? (
          <>
            Beobachte die Ente (🦆) und bring die Katze rechtzeitig in ihre Spur.
            <br />
            <span className="text-red-500 font-bold">Sei da, wenn sie auftaucht!</span>
          </>
        ) : (
          <>
            Die Ente taucht unter — wo kommt sie wieder hoch?
            <br />
            <span className="text-red-500 font-bold">Bring die Katze rechtzeitig in die richtige Spur!</span>
          </>
        )
      }
      onExit={onCancel}
    />
  );
}
