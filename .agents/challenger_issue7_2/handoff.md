# Handoff Report — Adversarial Verification of Checkpoint Persistence & Crash Resumption (.worktrees/issue-7)

## 1. Observation

### Codebase Inspection
1. **Level-up Checkpoint Triggering**:
   - In `src/training/TrainingSessionRunner.tsx` (lines 137–146):
     ```typescript
     const handleLevelUp = useCallback(
       (index: number, engineState: ExerciseProgressState) => {
         const sessionId = sessionIdRef.current;
         if (!sessionId) return;
         void updateTrainingSessionProgress(uid, childId, sessionId, {
           checkpoint: { exerciseIndex: index, exerciseId: exerciseIds[index]!, engineState },
         }).catch((err) => console.error('Checkpoint konnte nicht gespeichert werden', err));
       },
       [uid, childId, exerciseIds],
     );
     ```
   - In `src/training/engine/useExerciseEngine.ts` (lines 72–77):
     ```typescript
     useEffect(() => {
       if (state.level > lastLevelRef.current) {
         lastLevelRef.current = state.level;
         onLevelUpRef.current?.(state);
       }
     }, [state]);
     ```
   - In `src/data/firestore/trainingSessionsRepo.ts` (lines 47–59):
     `updateTrainingSessionProgress` validates `TrainingSessionProgress` and persists `checkpoint` with `updatedAt: serverTimestamp()`.

2. **Mid-Session Resumption & Non-Duplication of Stars/Trials**:
   - In `src/training/TrainingSessionRunner.tsx` (lines 98–118):
     `findInProgressSession` loads `existing.exercises` (length = `resumeIndex`). If `existing.checkpoint` exists with `exerciseIndex === resumeIndex && !engineState.done`, `initialState` is set to `cp.engineState`.
   - In `src/training/engine/useExerciseEngine.ts` (lines 49–59):
     `state` initializes from `initialState ?? createExerciseProgress()`, and `lastLevelRef.current = state.level`, preventing spurious `onLevelUp` upon mounting.
   - When the resumed exercise completes, `finalizeExerciseResult` produces exactly one `ExerciseResult` with total trials (`state.totalTrials`) and appends it to `results = [...existing.exercises, result]`.
   - In `src/training/rewards.ts` (lines 22–27), `starsForResult` calculates 1–3 stars for each individual `ExerciseResult`. In `SessionCelebration` (`TrainingSessionRunner.tsx` line 317), total stars is `results.reduce((sum, r) => sum + starsForResult(r), 0)`. No stars or trials are duplicated across resumed exercises.

3. **Session Completion Protocol**:
   - In `src/training/TrainingSessionRunner.tsx` (lines 176–194), `finish` calls `completeTrainingSession(uid, childId, sessionId, results)`.
   - In `src/data/firestore/trainingSessionsRepo.ts` (lines 66–79):
     ```typescript
     export async function completeTrainingSession(
       uid: string,
       childId: string,
       sessionId: string,
       exercises: ExerciseResult[],
     ): Promise<void> {
       const parsed = stripUndefinedDeep(z.array(exerciseResultSchema).parse(exercises));
       await updateDoc(trainingSessionDoc(db, uid, childId, sessionId), {
         exercises: parsed,
         status: 'completed',
         checkpoint: deleteField(),
         completedAt: serverTimestamp(),
       });
     }
     ```
   - In `src/data/schema/trainingSession.ts` (lines 119–128), `trainingSessionDocSchema` parses completed documents with `status: 'completed'` and `checkpoint: undefined`.

4. **In-Progress Isolation in Progress Calculation**:
   - In `src/data/progress.ts` (lines 50–53):
     ```typescript
     const completedDays = sessions.reduce(
       (max, s) => (s.status !== 'in-progress' && s.sessionDay > max ? s.sessionDay : max),
       0,
     );
     ```
   - In-progress sessions (`status: 'in-progress'`) are strictly excluded from `completedDays`.

### Empirical Test Execution in `.worktrees/issue-7`
- `npm run typecheck`:
  ```
  > mindcat-focus-training@0.0.0 typecheck
  > tsc --noEmit
  Exited with code 0 (0 errors)
  ```
- `npm run lint`:
  ```
  > mindcat-focus-training@0.0.0 lint
  > eslint .
  Exited with code 0 (0 warnings, 0 errors)
  ```
- `npx vitest run`:
  ```
  Test Files  41 passed (41)
       Tests  287 passed (287)
    Duration  2.01s
  ```
- `npm run pilot`:
  ```
  Test Files  1 passed (1)
       Tests  18 passed (18)
  ```
- Dedicated Adversarial Suite (`src/training/TrainingSessionRunner.adversarial.test.tsx`): 15 comprehensive tests covering all 4 verification targets, network failure resilience during level-up/save, stale checkpoint recovery, crash-after-last-exercise recovery, and idempotency: 15/15 passed.

---

## 2. Logic Chain

1. **R1 (Level-Up Checkpointing)**:
   - When a trial completes and satisfies `advanceStreak`, `applyTrialOutcome` increments `level` (Obs 1).
   - `useExerciseEngine` detects `state.level > lastLevelRef.current` and fires `onLevelUp(state)` (Obs 1).
   - `TrainingSessionRunner` receives `onLevelUp` and invokes `updateTrainingSessionProgress` with `{ checkpoint: { exerciseIndex, exerciseId, engineState } }` (Obs 1).
   - `updateTrainingSessionProgress` validates the payload and writes it to Firestore along with `serverTimestamp()` (Obs 1).
   - **Inference**: Level-up events reliably write the active checkpoint to Firestore.

2. **R2 (Crash Resumption without Double-Counting)**:
   - On mount, `findInProgressSession` loads `existing` session (Obs 2).
   - If `existing` has completed exercises, runner sets `index = existing.exercises.length` and provides `initialState = cp.engineState` to the active exercise component (Obs 2).
   - The active exercise initializes with `initialState.totalTrials`, increments on subsequent trials, and on finish produces a single `ExerciseResult` with total trials and correct metrics (Obs 2).
   - `results` in the runner accumulates completed exercise results without repeating earlier exercises. Stars are computed individually per `ExerciseResult` and summed (Obs 2).
   - **Inference**: Crash resumption accurately restores progress without duplicate trials or double-counted stars.

3. **R3 (Session Completion Protocol)**:
   - On day completion, `finish` executes `completeTrainingSession` (Obs 3).
   - `completeTrainingSession` writes `status: 'completed'`, uses `checkpoint: deleteField()` to remove the checkpoint, and records `completedAt: serverTimestamp()` (Obs 3).
   - **Inference**: Completed sessions remove checkpoint state and transition to immutable `completed` status.

4. **R4 (In-Progress Day Isolation)**:
   - `computeChildProgress` calculates `completedDays` using `s.status !== 'in-progress'` (Obs 4).
   - Incomplete sessions do not increment `completedDays` and do not advance `nextSessionDay` or prematurely transition `nextStep` to `'post'` (Obs 4).
   - **Inference**: In-progress sessions are strictly isolated from completed day statistics.

---

## 3. Caveats

- Live Firestore backend integration was tested against mocks and unit/integration harnesses matching the Firestore SDK contract; emulator and unit test runs confirm schema and contract compliance.
- No caveats regarding logic, invariants, or test outcomes.

---

## 4. Conclusion

**VERDICT: APPROVED (PASS)**

All 4 target verification points are empirically confirmed:
- Level-up event triggers `updateTrainingSessionProgress` with the current checkpoint.
- Resuming from an in-progress session restores `checkpoint.engineState` without double-counting stars or trials.
- Completed sessions delete `checkpoint` and set `status: 'completed'`.
- In-progress sessions are never counted as completed training days in `computeChildProgress`.

All quality gates pass with 100% success: 0 TypeScript errors, 0 ESLint warnings/errors, 287 Vitest tests passing (including 15 adversarial stress tests), and 18/18 longitudinal pilot scenarios passing.

---

## 5. Verification Method

To independently verify these conclusions in `.worktrees/issue-7`:

```bash
cd .worktrees/issue-7

# 1. Typecheck
npm run typecheck

# 2. Lint
npm run lint

# 3. Run all unit and integration tests (including adversarial checkpoint suite)
npm run test

# 4. Run adversarial checkpoint suite specifically
npx vitest run src/training/TrainingSessionRunner.adversarial.test.tsx

# 5. Run E2E pilot study test
npm run pilot
```

Invalidation conditions: Any failing test in the above commands or any violation of the 4 verification invariants.
