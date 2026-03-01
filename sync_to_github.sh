#!/bin/bash
# Sync project to GitHub
# Usage: ./sync_to_github.sh "commit message"

cd /home/ubuntu/ai_task_secretary

# Check if there are changes (excluding platform files)
CHANGES=$(git status --porcelain | grep -v ".abacus.donotdelete" | grep -v "^?? nodejs_space/.env")

if [ -z "$CHANGES" ]; then
  echo "✓ No changes to push"
  exit 0
fi

# Show what will be committed
echo "📝 Changes to commit:"
git status --short | grep -v ".abacus.donotdelete" | grep -v "^?? nodejs_space/.env"
echo ""

# Add all tracked changes
git add -A

# Reset files that should never be committed
git reset nodejs_space/.env 2>/dev/null || true

# Commit with message
COMMIT_MSG="${1:-Auto-sync: $(date '+%Y-%m-%d %H:%M:%S')}"
git commit -m "$COMMIT_MSG" || {
  echo "ℹ️  No changes to commit"
  exit 0
}

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin master

if [ $? -eq 0 ]; then
  echo "✅ Successfully synced to GitHub!"
else
  echo "❌ Push failed. Check error above."
  exit 1
fi
