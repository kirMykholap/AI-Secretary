# GitHub Quick Start Guide

## ✅ Setup Complete!

**Repository:** https://github.com/kirMykholap/AI-Secretary  
**Status:** ✅ Synced and ready

---

## 🚀 Daily Workflow

### For AI Agent (автоматически)

Когда пользователь просит:
> "Сохрани checkpoint и залей на GitHub"

Выполняю:
```bash
cd /home/ubuntu/ai_task_secretary
git add -A
git reset .abacus.donotdelete nodejs_space/.env 2>/dev/null
git commit -m "v2.x: Description of changes"
git push origin master
```

### For Manual Sync (вручную)

```bash
cd /home/ubuntu/ai_task_secretary
./sync_to_github.sh "Commit message"
```

---

## 🔐 Security Status

### ✅ Protected (NOT in GitHub):
- `nodejs_space/.env` - real API keys
- `.abacus.donotdelete` - platform file
- `node_modules/` - dependencies
- `dist/` - build artifacts
- `.logs/` - log files

### ✅ Public (in GitHub):
- Source code (`src/`)
- Documentation (`*.md`)
- Configuration (`tsconfig.json`, `package.json`)
- `.env.example` - template without secrets
- `.gitignore` - security rules

---

## 📝 Common Commands

### Push to GitHub
```bash
./sync_to_github.sh "feat: Add new feature"
./sync_to_github.sh "fix: Fix bug in scheduler"
./sync_to_github.sh "docs: Update README"
```

### Check Status
```bash
git status
git log --oneline -5
```

### Pull from GitHub (if working from multiple places)
```bash
git pull origin master
```

---

## ⚠️ Important Notes

1. **Never commit .env files** - они автоматически игнорируются
2. **Use sync_to_github.sh** - он проверяет что .env не добавлен
3. **AI Agent will auto-sync** - при запросе "залей на GitHub"
4. **Clean history** - старые коммиты с секретами удалены

---

## 🔄 If You Need to Clone Elsewhere

```bash
# Clone repository
git clone https://github.com/kirMykholap/AI-Secretary.git
cd AI-Secretary

# Copy .env.example to .env and fill in secrets
cp nodejs_space/.env.example nodejs_space/.env
nano nodejs_space/.env  # edit with your real secrets

# Install dependencies
cd nodejs_space
yarn install
yarn prisma generate

# Run locally
yarn start:dev
```

---

## 📚 Full Documentation

See `README_GITHUB_SYNC.md` for detailed instructions.

---

**Last Updated:** March 1, 2026  
**Status:** ✅ Working perfectly
