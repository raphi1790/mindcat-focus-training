## 2026-08-23T19:52:29Z

You are a Developer Worker assigned to GitHub Issue #7 (AP6: Spielstand-Persistenz & Dashboard).

MANDATORY FIRST STEP: Read /Users/raphscho/Documents/Projects/mindcat-focus-training/.agents/ORIGINAL_REQUEST.md and /Users/raphscho/Documents/Projects/mindcat-focus-training/PROJECT.md. Also review the technical exploration in /Users/raphscho/Documents/Projects/mindcat-focus-training/.agents/survey_explorer_1/handoff.md.

Your working directory for metadata is /Users/raphscho/Documents/Projects/mindcat-focus-training/.agents/worker_issue7.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Workflow & Implementation Instructions:
1. Claim Issue #7 by running:
   npm run agent:take 7
   This creates and checks out the isolated worktree at .worktrees/issue-7 on branch feat/issue-7.
2. In .worktrees/issue-7, implement the requirements for AP6:
   - Implement `src/dashboard/exerciseLevelStatus.ts`: Pure function `computeExerciseLevelOverview(sessions, ageGroup)` returning per-exercise status (highest level, total levels, completion status, trials, correct, errors, active in-progress checkpoint).
   - Implement `src/dashboard/charts/ExerciseLevelGrid.tsx`: Visual cards/grid displaying the reached level for each exercise with badges, progress bars, active checkpoint callout banner, and accessible data table.
   - Update `src/dashboard/ChildDashboard.tsx`: Memoize `computeExerciseLevelOverview` and render `ExerciseLevelGrid` under the "Trainingsverlauf" section.
   - Update `src/dashboard/index.ts` to export new symbols.
   - Add unit and component tests:
     - `src/dashboard/exerciseLevelStatus.test.ts`
     - `src/dashboard/charts/ExerciseLevelGrid.test.tsx`
     - `src/dashboard/ChildDashboard.test.tsx`
3. Comply strictly with `docs/standards/coding-standards.md`:
   - < 1000 lines per file, < 300 lines per function, max 3 nesting levels.
4. Execute and pass all quality gates inside the worktree:
   npm run typecheck
   npm run lint
   npm run test
5. Finalize the issue by running:
   npm run agent:finish 7
   (This runs quality gates, pushes feat/issue-7, creates a GitHub PR, and updates label to status:human-review).
   CRITICAL RULE: The PR and Issue #7 must remain OPEN. Do NOT merge the PR and do NOT close the issue.
6. Write your comprehensive handoff report to /Users/raphscho/Documents/Projects/mindcat-focus-training/.agents/worker_issue7/handoff.md.
7. Send a message to the orchestrator when completed.
