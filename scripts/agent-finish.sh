#!/usr/bin/env bash
set -e

ISSUE_ID="$1"

if [ -z "$ISSUE_ID" ]; then
  echo "❌ Error: Please specify a GitHub Issue ID."
  echo "Usage: npm run agent:finish <issue_id>"
  exit 1
fi

if ! command -v gh &> /dev/null; then
  echo "❌ Error: GitHub CLI ('gh') is required."
  exit 1
fi

BRANCH_NAME="feat/issue-${ISSUE_ID}"

echo "🔍 Running Quality Gate checks (typecheck, lint, test)..."
npm run typecheck
npm run lint
npm run test

echo "✅ All Quality Gate checks passed!"

# Commit any uncommitted changes if staged/unstaged files exist
if ! git diff-index --quiet HEAD --; then
  echo "💾 Committing pending changes..."
  git add .
  git commit -m "feat: complete tasks for issue #${ISSUE_ID}"
fi

echo "🚀 Pushing branch ${BRANCH_NAME} to remote..."
git push origin "$BRANCH_NAME" --set-upstream || git push origin "$BRANCH_NAME"

echo "📝 Creating GitHub Pull Request..."
gh pr create --title "feat: resolve issue #${ISSUE_ID}" --body "Resolves #${ISSUE_ID}. Ready for human review." || true

echo "🏷️ Updating GitHub Issue #${ISSUE_ID} label to status:human-review..."
gh issue edit "$ISSUE_ID" --add-label "status:human-review" --remove-label "agent:in-progress" || true

echo ""
echo "🎉 Issue #${ISSUE_ID} completed and submitted for Human Review!"
