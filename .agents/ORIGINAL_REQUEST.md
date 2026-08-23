# Original User Request

## 2026-08-23T18:54:12Z

Abarbeitung der verbleibenden GitHub Issues (#7 AP6 und #8 AP7) im Projekt Mindcat Focus Training mit einem autonomen Entwickler-Team, das strikt nach den Coding Standards und ADRs arbeitet und die PRs für das abschließende Human Review vorbereitet (ohne Auto-Merge und ohne Auto-Close).

Working directory: /Users/raphscho/Documents/Projects/mindcat-focus-training
Integrity mode: development

## Requirements

### R1. Autonomous Issue Execution & Worktree Isolation
For each open GitHub Issue with label `ready-for-agent` (Issues #7 and #8):
- **Issue #7 (AP6: Spielstand-Persistenz & Dashboard)**: Implement session level checkpointing and display reached exercise levels in the supervisor `ChildDashboard` overview.
- **Issue #8 (AP7: Gesamtverifikation & E2E Pilot)**: Execute comprehensive verification across all 8 exercises, ANT test, and E2E pilot test suite.
Each worker subagent must claim their issue via `npm run agent:take <issue_id>`, work in `.worktrees/issue-<id>`, write Vitest tests, and adhere to `AGENTS.md`, `docs/standards/coding-standards.md`, and `docs/adr/`.

### R2. Strict Quality Gate Enforcement
Before completing a ticket, each worker subagent must run and pass the full quality gate:
- `npm run typecheck` (0 TypeScript errors)
- `npm run lint` (0 ESLint warnings/errors)
- `npm run test` (100% Vitest unit and integration tests passing)
- `npm run pilot` (100% E2E longitudinal scenarios passing for AP7)

### R3. Pull Request Creation & Human-Review Transition (NO AUTO-MERGE, NO AUTO-CLOSE)
Once quality gates pass, each worker subagent must execute `npm run agent:finish <issue_id>`:
- Pushes branch `feat/issue-<id>` to origin.
- Creates GitHub Pull Request via `gh pr create`.
- Updates GitHub Issue label to `status:human-review`.
- **CRITICAL RULE**: The PR must **NOT** be auto-merged into `main` and the GitHub Issue must **NOT** be closed. Both PR and Issue must remain **OPEN** for the human reviewer.

## Acceptance Criteria

### Automated Quality Verification
- [ ] `npm run typecheck` passes with zero errors across all files.
- [ ] `npm run lint` passes with zero warnings or errors.
- [ ] `npm run test` executes all Vitest unit and integration test suites with 100% pass rate.
- [ ] `npm run pilot` (E2E pilot test) executes and passes successfully for AP7.

### Workflow & Repository Integrity
- [ ] No direct commits to `main`; all changes routed through `.worktrees/issue-<id>` branches and PRs.
- [ ] All code changes abide by `docs/standards/coding-standards.md` (< 1000 lines/file, < 300 lines/function, max 3 nesting levels).
- [ ] Pull Requests for Issue #7 and Issue #8 are created and remain **OPEN**.
- [ ] Issues #7 and #8 updated on GitHub to `status:human-review` and remain **OPEN**.
