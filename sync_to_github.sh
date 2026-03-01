#!/bin/bash
# Sync project to GitHub
# Usage: ./sync_to_github.sh "commit message"

cd /home/ubuntu/ai_task_secretary

# Check if there are changes
CHANGES=$(git status --porcelain)

if [ -z "$CHANGES" ]; then
  echo "✓ No changes to push"
  exit 0
fi

# Show what will be committed
echo "📝 Changes to commit:"
git status --short
echo ""

# Add only tracked files and new files (respects .gitignore)
git add .

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
