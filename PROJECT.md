# Project: Mindcat Focus Training — Issues #7 (AP6) & #8 (AP7)

## Architecture
- **Tech Stack**: React 19, Vite 8, Tailwind 4, Firebase / Firestore (Zod boundary validation), TypeScript, Vitest.
- **Workflow & Isolation**: Isolated Git Worktrees in `.worktrees/issue-<id>`, branch `feat/issue-<id>`.
- **Quality Gates**: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run pilot`.
- **Human Review**: `npm run agent:finish <id>` creates PR (`gh pr create`), sets label `status:human-review`. PRs and Issues remain OPEN (NO auto-merge, NO auto-close).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Incremental Session Persistence | Firestore doc with `status: 'in-progress'` on day start | M1 (Issue #7) | survey |
| 2 | Level-Up Checkpointing | Writes `checkpoint: { exerciseIndex, exerciseId, engineState }` on level advancement | M1 (Issue #7) | survey |
| 3 | Mid-Session Resumption | Restores active in-progress session and checkpoint level upon reload/mount | M1 (Issue #7) | survey |
| 4 | Session Completion Protocol | Sets `status: 'completed'`, removes checkpoint, records `completedAt` | M1 (Issue #7) | survey |
| 5 | Per-Exercise Level Overview Display | Renders granular reached exercise level badges and stats in `ChildDashboard.tsx` | M1 (Issue #7) | survey |
| 6 | In-Progress Isolation in Stats | Incomplete sessions are excluded from completed day counts in dashboard | M1 (Issue #7) | survey |
| 7 | Dashboard Status Calculation | Pure function `computeExerciseLevelOverview(sessions, ageGroup)` | M1 (Issue #7) | survey |
| 8 | Comprehensive Unit/Integration QA | 38+ Vitest suites across exercises, ANT, engine, and platform | M2 (Issue #8) | survey |
| 9 | E2E Longitudinal Pilot Verification | 5-day study simulation for 4yo & 6yo cohorts in `pilot.test.ts` | M2 (Issue #8) | survey |
| 10 | Scientific & Invariant Enforcement | Deterministic seeds, 800ms duck cue, 4-way maze, mud growth, ANT scoring | M2 (Issue #8) | survey |
| 11 | Zero-Error Quality Gates | Strict zero-tolerance check (`typecheck`, `lint`, `test`, `pilot`) | M2 (Issue #8) | survey |
| 12 | PR & Review Transition | Automated push, PR creation, and transition to `status:human-review` | M1 & M2 | survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Issue #7 (AP6: Spielstand-Persistenz & Dashboard) | Checkpoint verification + `ExerciseLevelGrid` & `exerciseLevelStatus` in `ChildDashboard.tsx` + tests | none | DONE |
| 2 | Issue #8 (AP7: Gesamtverifikation & E2E Pilot) | Full test verification (`typecheck`, `lint`, `test`, `pilot`) + E2E pilot validation | M1 | DONE |

## Code Layout
- `src/dashboard/exerciseLevelStatus.ts`: Pure reducer computing per-exercise level status for children.
- `src/dashboard/charts/ExerciseLevelGrid.tsx`: UI component displaying exercise cards with reached levels, badges, and active checkpoint banner.
- `src/dashboard/ChildDashboard.tsx`: Integrates `ExerciseLevelGrid` in the supervisor dashboard.
- `src/validation/pilot.test.ts`: E2E longitudinal study test simulating 4yo and 6yo cohorts.
- `src/training/`: Training engine, schedulers, and 8 exercise implementations.
- `src/assessment/`: Child ANT test suite, timing engine, and scoring logic.
- `src/data/`: Zod schemas and Firestore repositories.

## Interface Contracts
### `computeExerciseLevelOverview`
```ts
export interface ExerciseLevelStatus {
  exerciseId: ExerciseId;
  name: string;
  totalLevels: number;
  highestLevel: number;
  completed: boolean;
  totalTrials: number;
  correctTrials: number;
  errorTrials: number;
  lastPlayedAt?: Date;
  isInProgress?: boolean;
}

export function computeExerciseLevelOverview(
  sessions: readonly TrainingSession[],
  ageGroup: 4 | 6
): ExerciseLevelStatus[];
```
