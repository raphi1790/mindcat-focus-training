#!/usr/bin/env bash
set -e

ISSUE_ID="$1"

if [ -z "$ISSUE_ID" ]; then
  echo "❌ Error: Please specify a GitHub Issue ID."
  echo "Usage: npm run agent:take <issue_id>"
  exit 1
fi

if ! command -v gh &> /dev/null; then
  echo "❌ Error: GitHub CLI ('gh') is required."
  exit 1
fi

WORKTREE_DIR=".worktrees/issue-${ISSUE_ID}"
BRANCH_NAME="feat/issue-${ISSUE_ID}"

echo "📌 Claiming GitHub Issue #${ISSUE_ID}..."

# Update issue status/labels on GitHub
gh issue edit "$ISSUE_ID" --add-label "agent:in-progress" --remove-label "ready-for-agent" || true

echo "📁 Creating Git Worktree in ${WORKTREE_DIR} (branch: ${BRANCH_NAME})..."

mkdir -p .worktrees

if [ -d "$WORKTREE_DIR" ]; then
  echo "⚠️ Worktree ${WORKTREE_DIR} already exists."
else
  git worktree add -b "$BRANCH_NAME" "$WORKTREE_DIR" main
fi

echo ""
echo "🎉 Issue #${ISSUE_ID} successfully claimed!"
echo "➡️ To start working, switch into the worktree:"
echo "   cd ${WORKTREE_DIR}"
