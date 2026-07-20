import { useCallback, useEffect, useRef, useState } from 'react';
import { useDirectionalInput } from '../../../platform/input';
import { createRng, type Rng } from '../../../platform/rng';
import { useExerciseEngine, type LevelConfig } from '../../engine';
import GridWorld from '../../shared/GridWorld';
import type { ExerciseProps } from '../../types';

/**
 * Chase (Plan §6.2, Übung 2): Verfolgung/Sustained Attention. a=7, b=21, c=3.
 * Ein Regenschirm macht in festem Intervall einen Zufallsschritt; die Katze
 * muss ihn innerhalb eines Pro-Trial-Zeitfensters erreichen. Level ↑ = kürzeres
 * Zeitfenster und schnellere Schirm-Schritte (Gittergröße bleibt konstant).
 */
const CONFIG: LevelConfig = { levels: 7, minTrials: 21, advanceStreak: 3 };
const GRID_SIZE = 8;
const FLASH_MS = 500;
const TICK_MS = 100;

type Pos = { x: number; y: number };

function centerPos(): Pos {
  return { x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) };
}

function timeLimitForLevel(level: number): number {
  return Math.max(4200, 9000 - (level - 1) * 800);
}

function stepIntervalForLevel(level: number): number {
  return Math.max(400, 700 - (level - 1) * 50);
}

function randomPos(rng: Rng, exclude: Pos): Pos {
  let pos: Pos;
  let guard = 0;
  do {
    pos = { x: rng.int(0, GRID_SIZE), y: rng.int(0, GRID_SIZE) };
    guard += 1;
  } while (pos.x === exclude.x && pos.y === exclude.y && guard < 20);
  return pos;
}

const STEP_OPTIONS: Pos[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
  { x: 0, y: 0 },
];

function stepRandomly(rng: Rng, pos: Pos): Pos {
  const choice = rng.pick(STEP_OPTIONS);
  return {
    x: Math.min(Math.max(pos.x + choice.x, 0), GRID_SIZE - 1),
    y: Math.min(Math.max(pos.y + choice.y, 0), GRID_SIZE - 1),
  };
}

export default function ChaseExercise({ seed, onComplete, onCancel }: ExerciseProps) {
  const { state, recordTrial } = useExerciseEngine('chase', CONFIG, onComplete);
  const rngRef = useRef<Rng>(createRng(seed));
  const [trialId, setTrialId] = useState(0);
  const [catPos, setCatPos] = useState<Pos>(centerPos);
  // Platzhalter — die Trial-Setup-Effekt-Funktion platziert den Schirm beim
  // Mount sofort neu (seeded RNG darf nicht während des Renders gelesen werden).
  const [targetPos, setTargetPos] = useState<Pos>({ x: 0, y: 0 });
  const [flash, setFlash] = useState<'success' | 'error' | null>(null);
  const [remainingMs, setRemainingMs] = useState(() => timeLimitForLevel(1));

  const targetPosRef = useRef(targetPos);
  useEffect(() => {
    targetPosRef.current = targetPos;
  }, [targetPos]);

  const endTrial = useCallback(
    (caught: boolean) => {
      setFlash(caught ? 'success' : 'error');
      recordTrial({ result: caught ? 'correct' : 'missed' });
    },
    [recordTrial],
  );
  const endTrialRef = useRef(endTrial);
  useEffect(() => {
    endTrialRef.current = endTrial;
  }, [endTrial]);

  // Neuer Trial: Positionen setzen, Schirm-Schritt- und Zeitlimit-Timer starten.
  useEffect(() => {
    if (state.done) return;

    // In einer verschachtelten Funktion statt direkt im Effect-Body (vgl.
    // ChildAnt.tsx' `run()`) — das Setup reagiert auf einen neuen Trial
    // (externes Ereignis), keine reine Render-Ableitung.
    const setupTrial = () => {
      const cat = centerPos();
      setCatPos(cat);
      setTargetPos(randomPos(rngRef.current, cat));
      setRemainingMs(timeLimitForLevel(state.level));
    };
    setupTrial();

    const stepMs = stepIntervalForLevel(state.level);
    const stepInterval = setInterval(() => {
      setTargetPos((prev) => stepRandomly(rngRef.current, prev));
    }, stepMs);

    const tickInterval = setInterval(() => {
      setRemainingMs((prev) => {
        const next = prev - TICK_MS;
        if (next <= 0) {
          clearInterval(stepInterval);
          clearInterval(tickInterval);
          endTrialRef.current(false);
          return 0;
        }
        return next;
      });
    }, TICK_MS);

    return () => {
      clearInterval(stepInterval);
      clearInterval(tickInterval);
    };
  }, [trialId, state.level, state.done]);

  const handleMove = useCallback(
    ({ dx, dy }: { dx: number; dy: number }) => {
      if (flash !== null) return;
      setCatPos((prev) => {
        const next = {
          x: Math.min(Math.max(prev.x + dx, 0), GRID_SIZE - 1),
          y: Math.min(Math.max(prev.y + dy, 0), GRID_SIZE - 1),
        };
        if (next.x === targetPosRef.current.x && next.y === targetPosRef.current.y) {
          endTrialRef.current(true);
        }
        return next;
      });
    },
    [flash],
  );

  useDirectionalInput(handleMove, { enabled: flash === null && !state.done, repeatDelayMs: 150 });

  useEffect(() => {
    if (flash === null) return;
    const timeout = setTimeout(() => {
      setFlash(null);
      setTrialId((id) => id + 1);
    }, FLASH_MS);
    return () => clearTimeout(timeout);
  }, [flash]);

  return (
    <GridWorld
      cols={GRID_SIZE}
      rows={GRID_SIZE}
      tileAt={(x, y) => (x === targetPos.x && y === targetPos.y ? 'target' : 'path')}
      catPos={catPos}
      flash={flash}
      title={`Level ${state.level}`}
      subtitle={`(${state.streak}/${CONFIG.advanceStreak} für Aufstieg)`}
      counter={`Zeit: ${(remainingMs / 1000).toFixed(1)}s`}
      catEmoji="🐱"
      instructions={
        <>
          Fang den Schirm (🌂), bevor er wegläuft!
          <br />
          <span className="text-red-500 font-bold">Halt die Katze trocken.</span>
        </>
      }
      onExit={onCancel}
    />
  );
}
