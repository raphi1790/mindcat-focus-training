## 2026-08-23T20:43:10Z

You are a Developer Worker assigned to GitHub Issue #8 (AP7: Gesamtverifikation & E2E Pilot).

MANDATORY FIRST STEP: Read /Users/raphscho/Documents/Projects/mindcat-focus-training/.agents/ORIGINAL_REQUEST.md and /Users/raphscho/Documents/Projects/mindcat-focus-training/PROJECT.md. Also review the technical exploration in /Users/raphscho/Documents/Projects/mindcat-focus-training/.agents/survey_explorer_2/handoff.md.

Your working directory for metadata is /Users/raphscho/Documents/Projects/mindcat-focus-training/.agents/worker_issue8.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Workflow & Verification Instructions:
1. Work in the isolated worktree at .worktrees/issue-8 on branch feat/issue-8 (claim if needed via npm run agent:take 8).
2. Inside .worktrees/issue-8, execute and verify all quality gates:
   - npm run typecheck
   - npm run lint
   - npm run test
   - npm run pilot
3. Verify that all 8 exercises, ANT scoring, trial generators, and longitudinal pilot simulation (4yo and 6yo cohorts) execute cleanly and pass 100%.
4. Finalize Issue #8 by running:
   npm run agent:finish 8
   (This runs quality gates, pushes feat/issue-8, creates a GitHub PR, and updates label to status:human-review).
   CRITICAL RULE: The PR and Issue #8 must remain OPEN. Do NOT merge the PR and do NOT close the issue.
5. Write your comprehensive handoff report to /Users/raphscho/Documents/Projects/mindcat-focus-training/.agents/worker_issue8/handoff.md.
6. Send a message to the orchestrator when completed.
