import { useCallback, useEffect, useRef, useState } from 'react';
import { useDirectionalInput } from '../../../platform/input';
import { createTrialRng, type Rng } from '../../../platform/rng';
import { createTrialGate, useExerciseEngine } from '../../engine';
import { EXERCISE_CONFIGS } from '../../exerciseConfigs';
import GridWorld from '../../shared/GridWorld';
import type { ExerciseProps } from '../../types';

/**
 * Chase (Plan §6.2, Übung 2): Verfolgung/Sustained Attention. a=7, b=21, c=3.
 * Ein Regenschirm macht in festem Intervall einen Zufallsschritt; die Katze
 * muss ihn innerhalb eines Pro-Trial-Zeitfensters erreichen. Level ↑ = kürzeres
 * Zeitfenster und schnellere Schirm-Schritte (Gittergröße bleibt konstant).
 */
const CONFIG = EXERCISE_CONFIGS.chase;
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

export default function ChaseExercise({ seed, onComplete, onCancel, initialState, onLevelUp }: ExerciseProps) {
  const { state, recordTrial } = useExerciseEngine('chase', CONFIG, onComplete, { initialState, onLevelUp });
  const [trialId, setTrialId] = useState(0);
  const [catPos, setCatPos] = useState<Pos>(centerPos);
  // Platzhalter — die Trial-Setup-Effekt-Funktion platziert den Schirm beim
  // Mount sofort neu (seeded RNG darf nicht während des Renders gelesen werden).
  const [targetPos, setTargetPos] = useState<Pos>({ x: 0, y: 0 });
  const [flash, setFlash] = useState<'success' | 'error' | null>(null);
  const [remainingMs, setRemainingMs] = useState(() => timeLimitForLevel(1));

  // Quelle der Wahrheit für Bewegung/Timer außerhalb von State-Updatern
  // (React StrictMode ruft Updater-Funktionen im Dev-Modus doppelt auf —
  // Seiteneffekte wie `endTrial` dürfen deshalb nie darin stehen).
  const catPosRef = useRef(catPos);
  const targetPosRef = useRef(targetPos);
  useEffect(() => {
    targetPosRef.current = targetPos;
  }, [targetPos]);
  const remainingRef = useRef(remainingMs);
  const gateRef = useRef(createTrialGate());

  const updateCatPos = useCallback((pos: Pos) => {
    catPosRef.current = pos;
    setCatPos(pos);
  }, []);

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

  // Neuer Trial: Positionen setzen, Schirm-Schritt- und Zeitlimit-Timer starten.
  useEffect(() => {
    if (state.done) return;

    // Eigene Rng-Instanz je Trial (AP3): Trial `state.totalTrials` ist damit
    // für jedes Kind identisch, unabhängig davon, wie viele Schirm-Schritte
    // frühere Trials verbraucht haben, und ein StrictMode-Doppellauf dieses
    // Effekts erzeugt dieselbe Sequenz erneut statt sie zu verschieben.
    const trialRng = createTrialRng(seed, state.totalTrials);

    // In einer verschachtelten Funktion statt direkt im Effect-Body (vgl.
    // ChildAnt.tsx' `run()`) — das Setup reagiert auf einen neuen Trial
    // (externes Ereignis), keine reine Render-Ableitung.
    const setupTrial = () => {
      gateRef.current.reset();
      const cat = centerPos();
      updateCatPos(cat);
      setTargetPos(randomPos(trialRng, cat));
      remainingRef.current = timeLimitForLevel(state.level);
      setRemainingMs(remainingRef.current);
    };
    setupTrial();

    const stepMs = stepIntervalForLevel(state.level);
    const stepInterval = setInterval(() => {
      setTargetPos((prev) => stepRandomly(trialRng, prev));
    }, stepMs);

    const tickInterval = setInterval(() => {
      const next = remainingRef.current - TICK_MS;
      remainingRef.current = Math.max(0, next);
      setRemainingMs(remainingRef.current);
      if (next <= 0) {
        clearInterval(stepInterval);
        clearInterval(tickInterval);
        endTrialRef.current(false);
      }
    }, TICK_MS);

    return () => {
      clearInterval(stepInterval);
      clearInterval(tickInterval);
    };
  }, [trialId, state.level, state.done, state.totalTrials, seed, updateCatPos]);

  const handleMove = useCallback(
    ({ dx, dy }: { dx: number; dy: number }) => {
      if (flash !== null) return;
      const prev = catPosRef.current;
      const next = {
        x: Math.min(Math.max(prev.x + dx, 0), GRID_SIZE - 1),
        y: Math.min(Math.max(prev.y + dy, 0), GRID_SIZE - 1),
      };
      updateCatPos(next);
      if (next.x === targetPosRef.current.x && next.y === targetPosRef.current.y) {
        endTrialRef.current(true);
      }
    },
    [flash, updateCatPos],
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
      tileEmoji={(x, y) => (x === targetPos.x && y === targetPos.y ? '🌂' : null)}
      catPos={catPos}
      flash={flash}
      level={state.level}
      streak={{ current: state.streak, target: CONFIG.advanceStreak }}
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
