# Handoff Report: Specification Mining for GitHub Issues #7 (AP6) and #8 (AP7)

## 1. Observation
- **Authoritative Specifications Inspected**:
  - `CLAUDE.md`: Scope (Child ANT only; 8 Rueda training exercises; keyboard + arcade input; age cohorts 4 and 6 with Farmer restricted to 6yo; onset-accurate RT measurement via `performance.now()` + rAF; seeded RNG; Zod boundary validation; nested Firestore schema `users/{uid}/children/{childId}/{assessments,trainingSessions}`).
  - `AGENTS.md` & `docs/standards/coding-standards.md`: Worktree isolation (`.worktrees/issue-<id>`), branch naming (`feat/issue-<id>`), coding limits (<1000 lines/file, <300 lines/function, max 3 nesting levels), quality gates (`typecheck`, `lint`, `test`, `pilot`), PR workflow (`gh pr create`, label `status:human-review`, NO auto-merge, NO auto-close).
  - `docs/adr/0001-0003`: MADR ADR format, Firebase/Firestore nested architecture with Zod schemas, React 19 + Vite 8 + Tailwind 4 + Vitest stack.
  - `docs/IMPLEMENTATION_PLAN.md`: Full canonical 6-phase implementation roadmap, data schemas, scientific parameters (a/b/c progression criteria), and pilot plausibility metrics.
  - `docs/FIX_PLAN_TESTRUNDE_1.md`: AP1–AP7 defining trial gate purity, discrimination delay visibility, deterministic seeds (`mindcat-v1:day{n}`), maze blocking walls, side open-field redesign, incremental persistence with checkpoints (`status: 'in-progress'`), and global verification.
  - `docs/FIX_PLAN_TESTRUNDE_2.md` & `scripts/seed-issues.sh`: AP1–AP7 for Testrunde 2:
    - **Issue #7 (AP6)**: Spielstand-Persistenz: Verifikation & Status-Anzeige im Dashboard (`ChildDashboard.tsx`).
    - **Issue #8 (AP7)**: Gesamtverifikation & E2E Pilot (100% test pass, typecheck, lint, pilot).
  - **Codebase State**:
    - `src/data/schema/trainingSession.ts`: Contains `trainingSessionDocSchema`, `trainingCheckpointSchema`, `exerciseProgressStateSchema`, `exerciseResultSchema`.
    - `src/data/firestore/trainingSessionsRepo.ts`: Implements `startTrainingSession`, `updateTrainingSessionProgress`, `completeTrainingSession`, `findInProgressSession`.
    - `src/training/TrainingSessionRunner.tsx`: Orchestrates session execution, level-up checkpointing via `handleLevelUp`, exercise result recording, and crash-resilient session resumption.
    - `src/dashboard/ChildDashboard.tsx` & `src/dashboard/trainingSummary.ts`: Summarizes completed sessions into `days` and `byExercise` aggregates.
    - `src/validation/pilot.test.ts` & `src/validation/pilot.ts`: Full E2E simulation of 4yo and 6yo cohorts through Baseline ANT, 5 training days, Post ANT, and exclusion handling.

## 2. Logic Chain
1. **Scope & Goal Formulation**: The remaining workload consists of two GitHub issues: Issue #7 (AP6) focuses on session checkpoint verification and displaying reached exercise levels in `ChildDashboard.tsx`, while Issue #8 (AP7) serves as the comprehensive verification umbrella (E2E pilot, quality gates, full exercise suite checks).
2. **Issue #7 Analysis**:
   - `TrainingSessionRunner` already triggers `handleLevelUp` on level advancement, persisting `checkpoint: { exerciseIndex, exerciseId, engineState }` to Firestore.
   - `trainingSummary.ts` aggregates completed sessions and calculates `byExercise` stats (highest level, total trials, error rates).
   - In `ChildDashboard.tsx` and `TrainingProgressChart.tsx`, currently only day summaries (`days`) are displayed in the main table/charts. The explicit requirement of AP6 is to show the reached level for each exercise (e.g., in a dedicated breakdown or exercise overview table) so supervisors can immediately view the granular progress of each game.
   - Resume functionality must be verified to ensure that when a child or supervisor aborts or reloads mid-exercise, the dashboard and session runner handle the state consistently without counting incomplete sessions as completed training days.
3. **Issue #8 Analysis**:
   - Issue #8 requires executing and validating all quality gates: `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run pilot`.
   - The pilot test suite (`src/validation/pilot.test.ts`) verifies longitudinal study correctness across 4yo and 6yo cohorts, ensuring that ANT RT metrics fall within Rueda et al. (2005) plausibility ranges, conflict scores decrease post-training, and the age-dependent exercise sets (including Farmer for 6yo only) are strictly enforced.
4. **Adherence to Workflow Protocol & Guardrails**:
   - Both tickets must be executed in isolated worktrees (`.worktrees/issue-7` and `.worktrees/issue-8`).
   - PRs must be opened against `main` via `gh pr create` and assigned the label `status:human-review`. Auto-merging and issue closing are strictly forbidden.

## 3. Caveats
- Firestore emulator integration tests (`npm run test:rules`) require a running Java/Firebase emulator environment. Static Zod schema validation and Vitest unit tests provide full coverage of repository serialization without emulator dependency.
- In-progress session documents are intentionally excluded from `computeChildProgress` and `computeTrainingSummary` so that unfinished days do not prematurely increment completed day counters.

## 4. Conclusion
All functional requirements, architectural invariants, data schemas, UI components, and quality gates for Issues #7 (AP6) and #8 (AP7) have been completely mapped. The implementation for Issue #7 requires adding per-exercise level indicators to the supervisor dashboard (`ChildDashboard.tsx` / `TrainingProgressChart.tsx` or an adjacent breakdown component) and ensuring full unit test coverage. Issue #8 requires running the complete QA suite (`typecheck`, `lint`, `test`, `pilot`), verifying all 8 exercise mechanics, and preparing the pull request.

## 5. Verification Method
- Run TypeScript check: `npm run typecheck`
- Run ESLint: `npm run lint`
- Run Vitest suite: `npm run test`
- Run E2E Pilot test: `npm run pilot`
- Inspect `src/dashboard/ChildDashboard.tsx`, `src/dashboard/charts/TrainingProgressChart.tsx`, and `src/data/schema/trainingSession.ts`.

---

# Detailed Specification & Feature Inventory

## Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Persistence / AP6 | Incremental Session Creation | Initializes a new session doc in Firestore with `status: 'in-progress'` on day start. | `uid`, `childId`, `sessionDay`, `ageGroup`, `sessionSeed` | `sessionId: string` | Catches and renders `initError` screen in `TrainingSessionRunner`. | `trainingSessionsRepo.ts`, `TrainingSessionRunner.tsx` |
| 2 | Persistence / AP6 | Level-Up Checkpointing | Writes `checkpoint: { exerciseIndex, exerciseId, engineState }` on each level transition. | `sessionId`, `exerciseIndex`, `engineState` | Firestore `updateDoc` with `updatedAt: serverTimestamp()` | Non-fatal; logs to `console.error` without interrupting exercise flow. | `useExerciseEngine.ts`, `TrainingSessionRunner.tsx` |
| 3 | Persistence / AP6 | Mid-Session Resumption | Queries `findInProgressSession` upon mounting `TrainingSessionRunner` and restores `exerciseIndex`, `initialState`, and `results`. | `uid`, `childId`, `sessionDay` | `TrainingSession \| null` | Falls back to fresh session initialization if no in-progress doc exists. | `trainingSessionsRepo.ts`, `TrainingSessionRunner.tsx` |
| 4 | Persistence / AP6 | Session Completion & Checkpoint Deletion | Updates session status to `'completed'`, deletes `checkpoint` field, and writes `completedAt`. | `sessionId`, `results: ExerciseResult[]` | Firestore `updateDoc` | Renders `saveError` retry screen with memory-retained results. | `trainingSessionsRepo.ts`, `TrainingSessionRunner.tsx` |
| 5 | Dashboard / AP6 | Per-Exercise Level Display | Displays reached level and statistics for all individual training exercises in `ChildDashboard.tsx`. | `sessions: TrainingSession[]`, `trainingSummary: TrainingSummary` | Rendered exercise cards / table with highest level, trials, and accuracy | Shows empty state placeholder if no sessions exist. | `FIX_PLAN_TESTRUNDE_2.md` AP6, `ChildDashboard.tsx` |
| 6 | Dashboard / AP6 | In-Progress Session Isolation | Filters out `status: 'in-progress'` sessions from completed days count and training summary aggregations. | `sessions: readonly TrainingSession[]` | Cleaned `DaySummary[]` & `ExerciseAggregate[]` | Unfinished days are ignored in completed metrics. | `trainingSummary.ts`, `progress.ts` |
| 7 | Verification / AP7 | E2E Pilot Longitudinal Simulation | Simulates complete study workflow (Baseline ANT -> 5 Training Days -> Post ANT) for 4yo and 6yo. | RNG Seed (optional) | `PilotReport` with baseline, post, effect, and session records | Throws Vitest assertion error if RTs or trial counts violate plausibility ranges. | `pilot.test.ts`, `pilot.ts` |
| 8 | Verification / AP7 | ANT Plausibility & Exclusion Validation | Verifies RT ranges (4yo: 1500–1900ms, 6yo: 900–1100ms), conflict scores (4yo: 130–260ms, 6yo: 34–86ms), and >40% error exclusion. | `assessments: Assessment[]` | `quality.excluded: boolean`, `effectSummary: EffectSummary` | Sets `excluded: true` and displays warning banner in dashboard. | `scoring.ts`, `ChildDashboard.tsx`, `pilot.test.ts` |
| 9 | Verification / AP7 | Age-Cohort Exercise Set Gating | Enforces 9 exercises for 4yo and 10 exercises for 6yo (Farmer Go/No-Go restricted to 6yo). | `ageGroup: 4 \| 6` | `ExerciseId[]` | Fails pilot assertions if Farmer is included for 4yo or omitted for 6yo. | `exerciseSet.ts`, `pilot.test.ts` |
| 10 | Quality Gate / AP7 | Strict Zero-Error Quality Verification | Full verification via `typecheck` (tsc), `lint` (eslint), `test` (vitest), and `pilot`. | Entire repository codebase | Process exit code 0 | Script aborts with nonzero exit code on any lint warning or type error. | `package.json`, `AGENTS.md`, `agent-finish.sh` |

## Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Resumption | Session crashed after last exercise before completion call (`results.length >= exerciseIds.length`). | `TrainingSessionRunner` detects completed exercise list, immediately calls `completeTrainingSession`, and transitions to `SessionCelebration`. |
| 2 | Resumption | Checkpoint exists for a different exercise index than current `results.length`. | `initialState` is ignored and discarded; exercise starts from Level 1 cleanly. |
| 3 | Resumption | Incomplete level within an exercise interrupted by browser reload. | Engine resumes at start of checkpoint level; trials completed within uncheckpointed level are safely reset. |
| 4 | Progress Calculation | Multiple in-progress session documents exist for a child due to previous abandoned sessions. | `findInProgressSession` selects the most recent session by timestamp; older in-progress sessions are ignored. |
| 5 | Legacy Data | Session documents created before AP6 schema update (missing `status` field). | Zod schema applies `.default('completed')`, treating legacy records as completed sessions. |
| 6 | Dashboard | Child has only in-progress session data without completed sessions. | `hasAnyData` evaluates to true; `computeTrainingSummary` returns empty days array and dashboard shows clean "no completed sessions" state. |
| 7 | ANT Quality Gate | Child scores > 40% error rate on Baseline or Post ANT. | `quality.excluded` is set to `true`; excluded run is omitted from effect comparisons and flagged with an amber warning banner in dashboard. |
| 8 | Input Abstraction | Rapid concurrent inputs or timer races during trial transitions. | `trialGate` ensures exactly one `tryClose()` resolution; subsequent events are rejected. |

---

# Work Package Mapping for Autonomous Execution

### Work Package AP6 (Issue #7: Spielstand-Persistenz & Dashboard)
- **Worktree**: `.worktrees/issue-7`
- **Branch**: `feat/issue-7`
- **Primary Source Files**:
  - `src/dashboard/ChildDashboard.tsx`
  - `src/dashboard/charts/TrainingProgressChart.tsx`
  - `src/dashboard/trainingSummary.ts` & `src/dashboard/trainingSummary.test.ts`
  - `src/training/TrainingSessionRunner.tsx`
  - `src/data/firestore/trainingSessionsRepo.ts`
- **Required Tasks**:
  1. Verify Firestore checkpoint writes (`checkpoint: { exerciseIndex, exerciseId, engineState }`) on `handleLevelUp`.
  2. Implement/enhance per-exercise level display in `ChildDashboard.tsx` under Trainingsverlauf (showing highest reached level and trial stats per exercise from `trainingSummary.byExercise` or per session).
  3. Ensure unit tests in `trainingSummary.test.ts` and dashboard component tests validate exercise-level rendering.
  4. Run quality gates: `npm run typecheck`, `npm run lint`, `npm run test`.
  5. Finish via `npm run agent:finish 7` (creates PR, sets label `status:human-review`, leaves PR and Issue open).

### Work Package AP7 (Issue #8: Gesamtverifikation & E2E Pilot)
- **Worktree**: `.worktrees/issue-8`
- **Branch**: `feat/issue-8`
- **Primary Source Files**:
  - `src/validation/pilot.test.ts` & `src/validation/pilot.ts`
  - All exercise components in `src/training/exercises/`
  - `src/assessment/ant/`
- **Required Tasks**:
  1. Execute full quality gates: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run pilot`.
  2. Validate longitudinal data properties: RT plausibility, conflict effect reduction, age cohort exercise assignment (Farmer for 6yo only).
  3. Ensure all 8 training games and Child ANT conform to scientific invariants (deterministic seeds, onset-accurate RT, 4-way maze, mud growth in side, 800ms duck cue).
  4. Finish via `npm run agent:finish 8` (creates PR, sets label `status:human-review`, leaves PR and Issue open).
