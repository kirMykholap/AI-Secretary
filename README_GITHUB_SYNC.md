# GitHub Sync Automation

## 🚀 Quick Start

### Manual Sync (вручную)

```bash
# Sync with auto-generated commit message
./sync_to_github.sh

# Sync with custom commit message
./sync_to_github.sh "Fixed bug in scheduler"
./sync_to_github.sh "Added new feature: task decomposition"
```

### From AI Agent (я буду использовать)

```bash
# После каждого checkpoint я могу запустить:
cd /home/ubuntu/ai_task_secretary && ./sync_to_github.sh "v2.2: Added feature X"
```

---

## 🔧 Как это работает

1. **Скрипт проверяет изменения** в Git
2. **Добавляет все файлы** (кроме .env, благодаря .gitignore)
3. **Делает commit** с вашим сообщением или автоматическим timestamp
4. **Push'ит в GitHub** используя ваш токен

---

## ⚙️ Настройка

### Первый раз (ВАЖНО):

**Если репозиторий уже существует с секретами в истории:**

1. Удалите старый репозиторий: https://github.com/kirMykholap/AI-Secretary/settings
2. Создайте новый с тем же именем (пустой, без README)
3. Выполните:

```bash
cd /home/ubuntu/ai_task_secretary
git remote remove origin
git remote add origin https://<YOUR_GITHUB_TOKEN>@github.com/kirMykholap/AI-Secretary.git
git push -u origin master
```

**Если создаёте новый репозиторий:**

```bash
cd /home/ubuntu/ai_task_secretary
git remote add origin https://<YOUR_GITHUB_TOKEN>@github.com/kirMykholap/AI-Secretary.git
git push -u origin master
```

---

## 🔒 Безопасность

### Что НЕ попадёт в GitHub (защищено .gitignore):

✅ `.env` - файлы с секретами  
✅ `.env.local`, `.env.production` - любые варианты .env  
✅ `node_modules/` - зависимости  
✅ `dist/` - скомпилированные файлы  
✅ `.logs/` - логи  
✅ `*.pdf` - PDF файлы (могут содержать личные данные)  
✅ `.abacus.donotdelete` - платформенный файл  

### Что ПОПАДЁТ в GitHub:

✓ Исходный код (`src/`, `*.ts`, `*.js`)  
✓ Конфигурация (`tsconfig.json`, `package.json`, `prisma/schema.prisma`)  
✓ Документация (`*.md`)  
✓ `.gitignore`  
✓ `.env.example` (шаблон без реальных секретов)  

---

## 🤖 Автоматизация через AI Agent

**Я (AI Agent) буду автоматически sync'ить после каждого checkpoint, если вы попросите:**

> "Сохрани checkpoint и залей на GitHub"

**Workflow:**

1. Я делаю изменения в коде
2. Тестирую локально
3. Сохраняю checkpoint (build_and_save_nodejs_service_checkpoint)
4. Запускаю `./sync_to_github.sh "v2.2: Feature description"`
5. Готово! ✅

---

## 📚 Примеры команд

### После добавления новой фичи:

```bash
./sync_to_github.sh "feat: Add task decomposition with LLM"
```

### После исправления бага:

```bash
./sync_to_github.sh "fix: Resolve timezone issue in evening checkup"
```

### После обновления документации:

```bash
./sync_to_github.sh "docs: Update ARCHITECTURE.md with new flows"
```

### Быстрый sync без кастомного сообщения:

```bash
./sync_to_github.sh
# Создаст commit: "Auto-sync: 2026-03-01 20:30:45"
```

---

## ⚠️ Troubleshooting

### 🚫 "Push declined due to repository rule violations"

**Причина:** GitHub обнаружил секреты в коммитах

**Решение:** Удалите репозиторий и создайте новый (см. раздел "Настройка" выше)

---

### 🚫 "Authentication failed"

**Причина:** GitHub token истёк или неверный

**Решение:** Обновите токен в скрипте:

1. Создайте новый токен: https://github.com/settings/tokens
2. Права: `repo` (full control of private repositories)
3. Обновите в `sync_to_github.sh`: 
   ```bash
   git push https://ghp_NEW_TOKEN@github.com/kirMykholap/AI-Secretary.git master
   ```

---

### ℹ️ "No changes to push"

**Причина:** Нет новых изменений с последнего commit

**Решение:** Это нормально! Скрипт просто пропускает push.

---

## 🔄 Git Workflow

```
[Abacus AI Platform] ←→ [Local Git] → [GitHub]
      |
      |—— AI Agent делает изменения
      |—— Сохраняет checkpoint
      |—— Запускает sync_to_github.sh
      |—— Push в GitHub ✅
```

---

**Last Updated:** March 1, 2026  
**Автор:** AI Agent + User  
**Версия:** 1.0
