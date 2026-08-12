import { describe, expect, it } from 'vitest';
import {
  applyTrialOutcome,
  createExerciseProgress,
  finalizeExerciseResult,
  type LevelConfig,
} from './exerciseProgress';

const SIDE_CONFIG: LevelConfig = { levels: 7, minTrials: 21, advanceStreak: 3 };
const MAZE_CONFIG: LevelConfig = { levels: 6, minTrials: 6, advanceStreak: 1 };

function correct(count: number) {
  return Array.from({ length: count }, () => ({ result: 'correct' as const }));
}

describe('applyTrialOutcome — a/b/c-Advancement (Side-Parameter)', () => {
  it('3 korrekte Trials in Folge steigen ein Level auf und setzen den Streak zurück', () => {
    let state = createExerciseProgress();
    for (const outcome of correct(3)) {
      state = applyTrialOutcome(state, SIDE_CONFIG, outcome);
    }
    expect(state.level).toBe(2);
    expect(state.streak).toBe(0);
    expect(state.perLevel).toHaveLength(2);
    expect(state.perLevel[0]).toEqual({ level: 1, trials: 3, correct: 3, errors: 0 });
  });

  it('ein Fehler setzt den Streak zurück, ohne Level-Aufstieg', () => {
    let state = createExerciseProgress();
    state = applyTrialOutcome(state, SIDE_CONFIG, { result: 'correct' });
    state = applyTrialOutcome(state, SIDE_CONFIG, { result: 'correct' });
    state = applyTrialOutcome(state, SIDE_CONFIG, { result: 'error' });
    expect(state.level).toBe(1);
    expect(state.streak).toBe(0);
    expect(state.errors).toBe(1);
    expect(state.perLevel[0]).toEqual({ level: 1, trials: 3, correct: 2, errors: 1 });
  });

  it('missed zählt separat von error, setzt den Streak aber ebenfalls zurück', () => {
    let state = createExerciseProgress();
    state = applyTrialOutcome(state, SIDE_CONFIG, { result: 'correct' });
    state = applyTrialOutcome(state, SIDE_CONFIG, { result: 'missed' });
    expect(state.missed).toBe(1);
    expect(state.errors).toBe(0);
    expect(state.streak).toBe(0);
  });

  it('schließt erst ab, wenn auf dem letzten Level der Streak UND minTrials erreicht sind', () => {
    let state = createExerciseProgress();
    // Level 1 → 7 (6 Aufstiege à 3 korrekte Trials = 18 Trials).
    for (let i = 0; i < 6; i++) {
      state = applyTrialOutcome(state, SIDE_CONFIG, { result: 'correct' });
      state = applyTrialOutcome(state, SIDE_CONFIG, { result: 'correct' });
      state = applyTrialOutcome(state, SIDE_CONFIG, { result: 'correct' });
    }
    expect(state.level).toBe(7);
    expect(state.totalTrials).toBe(18);
    expect(state.done).toBe(false); // Streak erreicht, aber erst 18 < 21 Trials

    // Zwei weitere korrekte Trials auf Level 7 (Streak bleibt "bereit").
    state = applyTrialOutcome(state, SIDE_CONFIG, { result: 'correct' });
    state = applyTrialOutcome(state, SIDE_CONFIG, { result: 'correct' });
    expect(state.totalTrials).toBe(20);
    expect(state.done).toBe(false);

    state = applyTrialOutcome(state, SIDE_CONFIG, { result: 'correct' });
    expect(state.totalTrials).toBe(21);
    expect(state.done).toBe(true);
    expect(state.level).toBe(7);
  });

  it('ein Fehler nach erreichtem Streak auf dem letzten Level setzt den Streak zurück und verzögert den Abschluss', () => {
    // Ein-Level-Konfiguration: startet bereits auf dem "letzten" Level.
    const CONFIG: LevelConfig = { levels: 1, minTrials: 10, advanceStreak: 3 };
    let state = createExerciseProgress();
    for (const outcome of correct(3)) state = applyTrialOutcome(state, CONFIG, outcome);
    expect(state.streak).toBe(3); // Streak "bereit", aber erst 3 < 10 Trials → kein Reset
    expect(state.done).toBe(false);

    state = applyTrialOutcome(state, CONFIG, { result: 'error' });
    expect(state.streak).toBe(0);
    expect(state.done).toBe(false);

    for (const outcome of correct(6)) state = applyTrialOutcome(state, CONFIG, outcome);
    expect(state.totalTrials).toBe(10);
    expect(state.done).toBe(true);
  });

  it('ist danach ein No-Op (keine weiteren State-Änderungen)', () => {
    let state = createExerciseProgress();
    for (let i = 0; i < 7; i++) {
      state = applyTrialOutcome(state, MAZE_CONFIG, { result: 'correct' });
    }
    expect(state.done).toBe(true);
    const after = applyTrialOutcome(state, MAZE_CONFIG, { result: 'correct' });
    expect(after).toBe(state);
  });
});

describe('applyTrialOutcome — Maze-Parameter (c=1)', () => {
  it('jeder Erfolg steigt sofort ein Level auf', () => {
    let state = createExerciseProgress();
    state = applyTrialOutcome(state, MAZE_CONFIG, { result: 'correct' });
    expect(state.level).toBe(2);
    state = applyTrialOutcome(state, MAZE_CONFIG, { result: 'correct' });
    expect(state.level).toBe(3);
  });

  it('schließt nach 6 korrekten Trials ab (a=6, b=6)', () => {
    let state = createExerciseProgress();
    for (let i = 0; i < 5; i++) {
      state = applyTrialOutcome(state, MAZE_CONFIG, { result: 'correct' });
      expect(state.done).toBe(false);
    }
    state = applyTrialOutcome(state, MAZE_CONFIG, { result: 'correct' });
    expect(state.done).toBe(true);
    expect(state.level).toBe(6);
    expect(state.totalTrials).toBe(6);
  });
});

describe('applyTrialOutcome — countsTowardStreak (Number-Stroop: nur inkongruente Trials)', () => {
  const CONFIG: LevelConfig = { levels: 2, minTrials: 3, advanceStreak: 2 };

  it('korrekte Trials ohne countsTowardStreak bewegen den Streak nicht, setzen ihn aber auch nicht zurück', () => {
    let state = createExerciseProgress();
    state = applyTrialOutcome(state, CONFIG, { result: 'correct', countsTowardStreak: true });
    state = applyTrialOutcome(state, CONFIG, { result: 'correct', countsTowardStreak: false }); // kongruent, zählt nicht
    expect(state.streak).toBe(1);
    state = applyTrialOutcome(state, CONFIG, { result: 'correct', countsTowardStreak: true });
    expect(state.streak).toBe(0); // Aufstieg ausgelöst (2 zählende korrekte Trials)
    expect(state.level).toBe(2);
  });
});

describe('applyTrialOutcome — satisfiesQualifier (Farmer: ≥1 No-Go im Streak)', () => {
  const CONFIG: LevelConfig = { levels: 2, minTrials: 1, advanceStreak: 3 };

  it('Streak ohne qualifizierenden Trial löst keinen Aufstieg aus', () => {
    let state = createExerciseProgress();
    for (let i = 0; i < 3; i++) {
      state = applyTrialOutcome(state, CONFIG, { result: 'correct', satisfiesQualifier: false });
    }
    expect(state.streak).toBe(3);
    expect(state.level).toBe(1); // kein Aufstieg trotz erreichtem Streak
  });

  it('sobald ein qualifizierender Trial im Streak vorkommt, steigt das Level auf', () => {
    let state = createExerciseProgress();
    state = applyTrialOutcome(state, CONFIG, { result: 'correct', satisfiesQualifier: false });
    state = applyTrialOutcome(state, CONFIG, { result: 'correct', satisfiesQualifier: true }); // No-Go korrekt zurückgehalten
    state = applyTrialOutcome(state, CONFIG, { result: 'correct', satisfiesQualifier: false });
    expect(state.level).toBe(2);
  });
});

describe('finalizeExerciseResult', () => {
  it('baut ein schema-konformes ExerciseResult aus dem finalen Zustand', () => {
    let state = createExerciseProgress();
    for (let i = 0; i < 6; i++) {
      state = applyTrialOutcome(state, MAZE_CONFIG, { result: 'correct' });
    }
    const result = finalizeExerciseResult('maze', state, 12345);
    expect(result).toEqual({
      exerciseId: 'maze',
      levelsCompleted: 6,
      highestLevel: 6,
      trials: 6,
      correct: 6,
      errors: 0,
      missed: 0,
      trialToAdvanceRate: 1,
      durationMs: 12345,
      perLevel: state.perLevel,
      rawEvents: undefined,
    });
  });
});
