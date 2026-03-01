# AI Task Secretary - Project Documentation

## 📋 Project Overview

**AI Task Secretary** is a personal task management system that automatically synchronizes tasks from multiple sources (Jira, Telegram) into **TickTick** using a **NestJS backend** with **PostgreSQL database**.

### Core Features
- ✅ **Real-time Jira → Database → TickTick synchronization**
- ✅ **Telegram bot** for task listing and management
- ✅ **Webhook-based** automatic updates
- ✅ **Database as single source of truth** architecture
- 🚧 **LLM-powered task categorization** (planned)
- 🚧 **Two-way synchronization** (planned)
- 🚧 **Notion integration** (planned)

---

## 🏗️ Architecture

### High-Level Flow

```
Jira Task Created/Updated
         ↓
  [Jira Webhook]
         ↓
  [NestJS Backend]
         ↓
  [PostgreSQL Database] ← Single Source of Truth
         ↓
  [TickTick API]
         ↓
  [TickTick App]

Telegram Bot → [NestJS Backend] → [Database] → Response
```

### Architecture Evolution

**Initial Approach (Deprecated):**
- Direct Jira → TickTick synchronization
- No persistent storage
- Data inconsistency issues

**Current Approach (Active):**
- **Database-first architecture**
- All operations go through PostgreSQL
- Cross-references maintained: `jira_id`, `ticktick_id`
- Telegram reads directly from database

---

## 🛠️ Technical Stack

### Backend
- **Framework:** NestJS (TypeScript)
- **Runtime:** Node.js 18+
- **Package Manager:** Yarn
- **Database:** PostgreSQL (hosted by Abacus.AI)
- **ORM:** Prisma

### External Services
- **Jira:** Task source (kir-home-test.atlassian.net)
- **TickTick:** Task destination
- **Telegram:** Bot interface (@ai_task_secretary_bot)

### Deployment
- **Platform:** Abacus.AI
- **Production URL:** `https://ai-task-secretary-lt40q6.abacusai.app`
- **Environment:** Containerized, stateless

---

## 📊 Database Schema

### Prisma Schema (`prisma/schema.prisma`)

```prisma
model Task {
  id          String   @id @default(uuid())
  title       String
  description String?
  priority    Int      @default(1)  // 0=low, 1=medium, 3=high, 5=urgent
  status      String   @default("active")  // active, completed, deleted
  due_date    DateTime?
  
  // Cross-references
  jira_id     String?  @unique
  jira_key    String?  // e.g., "HOME-7"
  ticktick_id String?  @unique
  
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  @@index([jira_id])
  @@index([ticktick_id])
  @@index([status])
}
```

### Key Fields
- **id:** UUID primary key
- **jira_id:** Jira issue ID (e.g., "10005")
- **jira_key:** Human-readable key (e.g., "HOME-7")
- **ticktick_id:** TickTick task ID
- **priority:** 0-5 scale (mapped from Jira priorities)
- **status:** Task lifecycle state

---

## 🔗 Integrations

### 1. Jira Integration

**Connection Details:**
- **Domain:** `<YOUR_DOMAIN>.atlassian.net`
- **User Email:** `<YOUR_EMAIL>@gmail.com`
- **Account ID:** `<YOUR_JIRA_ACCOUNT_ID>`
- **Authentication:** API Token (stored in env)

**Webhook Configuration:**
- **URL:** `https://ai-task-secretary-lt40q6.abacusai.app/webhook/jira`
- **Events:** `issue_created`, `issue_updated`
- **JQL Filter:** `assignee = <YOUR_JIRA_ACCOUNT_ID>`

**Priority Mapping:**
```typescript
Jira Priority → System Priority → TickTick Priority
─────────────────────────────────────────────────
Highest       → 5 (urgent)     → 5 (Urgent)
High          → 3 (high)       → 3 (High)
Medium        → 1 (medium)     → 1 (Medium)
Low/Lowest    → 0 (low)        → 0 (None)
```

**Description Format:**
- Handles **Atlassian Document Format (ADF)** → converts to plain text
- Extracts text from nested content structures

---

### 2. TickTick Integration

**Connection:**
- **Authentication:** Access Token (OAuth-based)
- **Project:** "Jira" (auto-created on first sync if doesn't exist)
- **Auto-detection:** Project is found/created by name

**Task Format:**
- **Title:** `[HOME-7] Task Name`
- **Tags:** `#jira`
- **Due Date:** Set to 23:59:00 in Kyiv timezone (UTC+2)
- **Timezone:** `Europe/Kiev`

---

### 3. Telegram Bot Integration

**Bot Details:**
- **Username:** `@ai_task_secretary_bot`
- **Webhook:** `https://ai-task-secretary-lt40q6.abacusai.app/telegram/webhook`

**Available Commands:**

#### `/list`
Displays all active tasks from the database.

**Response Format:**
```
📋 Ваши задачи:

🔹 [HOME-7] extra
   📅 Срок: 27.02.2026
   🔥 Приоритет: средний

🔹 [HOME-6] 3 test task
   📅 Срок: 27.02.2026
   🔥 Приоритет: средний

📊 Всего задач: 2
```

**Priority Labels:**
- `5` → 🔴 срочный
- `3` → 🟡 высокий
- `1` → 🟢 средний
- `0` → ⚪ низкий

---

## 🔌 API Endpoints

### Authentication
All protected endpoints require API Key authentication:
```bash
X-API-Key: <SYNC_API_KEY from environment>
```

### Endpoints

#### `POST /webhook/jira`
**Purpose:** Receive Jira webhook events  
**Authentication:** None (public webhook)  
**Payload:** Jira webhook JSON  
**Logic:**
- `issue_created` → Always process (even if assignee undefined)
- `issue_updated` → Only process if `assignee.accountId == JIRA_ACCOUNT_ID`

**Response:**
```json
{
  "success": true,
  "message": "Задача HOME-7 синхронизирована успешно",
  "taskKey": "HOME-7"
}
```

---

#### `GET /sync`
**Purpose:** Manual full synchronization  
**Authentication:** Required (`X-API-Key`)  
**Logic:**
1. Fetch all tasks assigned to user from Jira
2. Update/create in database
3. Sync to TickTick

**Response:**
```json
{
  "success": true,
  "created": 1,
  "updated": 5,
  "errors": 0
}
```

**cURL Example:**
```bash
curl -H "X-API-Key: <YOUR_SYNC_API_KEY>" \
     https://ai-task-secretary-lt40q6.abacusai.app/sync
```

---

#### `POST /telegram/webhook`
**Purpose:** Receive Telegram bot updates  
**Authentication:** None (public webhook)  
**Handled Commands:**
- `/list` → Fetch tasks from database and send formatted list

---

#### `GET /api-docs`
**Purpose:** Swagger API documentation  
**Authentication:** None  
**URL:** https://ai-task-secretary-lt40q6.abacusai.app/api-docs

---

## 🔐 Environment Variables

### Production Environment (`.env`)

```bash
# Database
DATABASE_URL='<AUTO_CONFIGURED_BY_ABACUS_AI>'

# API Security
SYNC_API_KEY='<YOUR_GENERATED_API_KEY>'

# Jira Integration
JIRA_DOMAIN='<YOUR_DOMAIN>.atlassian.net'
JIRA_EMAIL='<YOUR_EMAIL>@gmail.com'
JIRA_ACCOUNT_ID='<YOUR_JIRA_ACCOUNT_ID>'
JIRA_API_TOKEN='<YOUR_JIRA_API_TOKEN>'

# TickTick Integration
TICKTICK_ACCESS_TOKEN='<YOUR_TICKTICK_ACCESS_TOKEN>'

# Telegram Bot
TELEGRAM_BOT_TOKEN='<YOUR_TELEGRAM_BOT_TOKEN>'

# LLM (v2.0+)
ABACUSAI_API_KEY='<AUTO_CONFIGURED_BY_PLATFORM>'
DAILY_CAPACITY_MINUTES=360
MORNING_CRON='0 10 * * *'
EVENING_CRON='0 21 * * *'
TIMEZONE='Europe/Kiev'
```

### Important Notes
- **DATABASE_URL:** Auto-configured by Abacus.AI
- **JIRA_ACCOUNT_ID:** Critical for webhook filtering (not email!)
- **Tokens:** Never commit to version control

---

## 📁 Project Structure

```
/home/ubuntu/ai_task_secretary/
├── nodejs_space/
│   ├── src/
│   │   ├── main.ts                 # Application entry point
│   │   ├── app.module.ts           # Root module
│   │   ├── app.controller.ts       # Health check endpoint
│   │   ├── prisma.service.ts       # Prisma client service
│   │   │
│   │   ├── jira.service.ts         # Jira API integration
│   │   ├── ticktick.service.ts     # TickTick API integration
│   │   ├── telegram.service.ts     # Telegram bot logic
│   │   ├── task.service.ts         # Database operations
│   │   ├── sync.service.ts         # Sync orchestration
│   │   │
│   │   ├── webhook.controller.ts   # Jira webhook handler
│   │   ├── sync.controller.ts      # Manual sync endpoint
│   │   ├── telegram.controller.ts  # Telegram webhook handler
│   │   │
│   │   └── types.ts                # TypeScript interfaces
│   │
│   ├── prisma/
│   │   ├── schema.prisma           # Database schema
│   │   └── migrations/             # Database migrations
│   │
│   ├── test/
│   │   └── app.e2e-spec.ts         # End-to-end tests
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   └── .env                        # Environment variables
│
└── PROJECT_SUMMARY.md              # This file
```

---

## 🔄 Synchronization Logic

### Webhook-Based Sync (Automatic)

**Trigger:** Jira webhook event

**Flow:**
```
1. Jira sends webhook → POST /webhook/jira
2. Check event type (issue_created / issue_updated)
3. Validate assignee (accountId match)
4. Call syncService.syncSingleJiraTask(issue.key)
5. Fetch full issue details from Jira API
6. Check if task exists in database (by jira_id)
7. Update or create task in database
8. Update or create task in TickTick
9. Return success response
```

**Important Logic:**
- **issue_created:** Process even if assignee is undefined
- **issue_updated:** Only process if `assignee.accountId == JIRA_ACCOUNT_ID`

---

### Manual Sync

**Trigger:** `GET /sync` with API key

**Flow:**
```
1. Fetch ALL tasks assigned to user from Jira
2. For each Jira task:
   - Check if exists in database (by jira_id)
   - Update or create in database
   - Sync to TickTick (update if ticktick_id exists, else create)
3. Return statistics (created, updated, errors)
```

---

### Date/Time Handling

**Timezone:** `Europe/Kiev` (UTC+2)

**Due Date Logic:**
```typescript
// Set due date to 23:59:00 in Kyiv timezone
const formatTickTickDate = (date: Date | null): string | undefined => {
  if (!date) return undefined;
  
  const kyivDate = new Date(date);
  kyivDate.setHours(23, 59, 0, 0);
  
  return kyivDate.toISOString().slice(0, 19) + '+0200';
  // Example: "2026-02-27T23:59:00+0200"
};
```

---

## 🐛 Known Issues & Solutions

### Issue 1: Webhook Not Triggering

**Symptom:** New Jira tasks don't appear in TickTick/Telegram

**Causes:**
1. ❌ Webhook not configured in Jira
2. ❌ Wrong webhook URL
3. ❌ JQL filter excluding tasks

**Solution:**
- Configure webhook at: `https://<YOUR_DOMAIN>.atlassian.net/plugins/servlet/webhooks`
- URL: `https://ai-task-secretary-lt40q6.abacusai.app/webhook/jira`
- Events: `issue_created`, `issue_updated`
- JQL: `assignee = <YOUR_JIRA_ACCOUNT_ID>`

---

### Issue 2: Assignee Check Failing

**Symptom:** Webhook arrives but task skipped with "not assigned to target user"

**Root Cause:** Jira uses `accountId` (hashed), not email

**Solution (FIXED):**
- Use `issue.fields.assignee.accountId` instead of `emailAddress`
- Compare with `JIRA_ACCOUNT_ID` env variable

**Before:**
```typescript
assigneeEmail === targetEmail  // ❌ undefined === email
```

**After:**
```typescript
assigneeAccountId === targetAccountId  // ✅ Matches by account ID
```

---

### Issue 3: ADF Description Parsing

**Symptom:** Tasks with complex descriptions fail to save

**Root Cause:** Jira uses Atlassian Document Format (ADF) - nested JSON structure

**Solution (FIXED):**
```typescript
private extractTextFromADF(adf: any): string {
  if (!adf || !adf.content) return '';
  
  const extractText = (node: any): string => {
    if (node.type === 'text') return node.text || '';
    if (node.content && Array.isArray(node.content)) {
      return node.content.map(extractText).join('');
    }
    return '';
  };
  
  return adf.content.map(extractText).join('\n').trim();
}
```

---

## 🚀 Deployment

### Local Development

```bash
cd /home/ubuntu/ai_task_secretary/nodejs_space

# Install dependencies
yarn install

# Generate Prisma client
yarn prisma generate

# Run database migrations
yarn prisma migrate deploy

# Start development server
yarn start:dev

# Server runs on http://localhost:3000
```

### Production Deployment

**Automatic via Abacus.AI:**
1. Code changes committed
2. Build triggered: `yarn build`
3. Service packaged into artifact
4. Deployed to production URL
5. Live in ~2 minutes

**Manual Trigger:**
- Use "Deploy" button in Abacus.AI UI
- Or call deployment API

**Health Check:**
```bash
curl https://ai-task-secretary-lt40q6.abacusai.app/
# Response: {"message":"AI Task Secretary is running!"}
```

---

## 🧪 Testing

### Manual Testing Checklist

#### Test 1: Jira → Database → TickTick
1. Create new task in Jira (e.g., HOME-10)
2. Assign to yourself
3. Check production logs for webhook event
4. Verify task appears in TickTick "Jira" project
5. Run `/list` in Telegram - should show new task

#### Test 2: Manual Sync
```bash
curl -H "X-API-Key: <YOUR_SYNC_API_KEY>" \
     https://ai-task-secretary-lt40q6.abacusai.app/sync
```
Expect: `{"success": true, "created": 0, "updated": N, "errors": 0}`

#### Test 3: Telegram Bot
1. Open `@ai_task_secretary_bot`
2. Send `/list`
3. Should receive formatted task list

### Checking Logs

**Via Abacus.AI UI:**
- Click "Logs" button → "Production Logs"

**Look for:**
- `[WebhookController] Received Jira webhook` → Webhook working
- `[SyncService] Sync completed: X created, Y updated` → Sync success
- `[ERROR]` logs → Issues to investigate

---

## 📈 Future Enhancements

### Phase 1: Core Improvements
- [ ] **Two-way sync:** TickTick completion → Jira status update
- [ ] **Task deletion:** Handle deleted tasks in Jira
- [ ] **Bulk operations:** Telegram command to mark multiple tasks done
- [ ] **Error recovery:** Retry failed TickTick API calls

### Phase 2: LLM Integration
- [ ] **Smart categorization:** Auto-detect task category from description
- [ ] **Deadline suggestion:** LLM suggests due dates based on task content
- [ ] **Voice input:** Telegram voice messages → structured tasks
- [ ] **Priority prediction:** Auto-assign priority based on keywords

### Phase 3: Additional Sources
- [ ] **Notion integration:** Sync from Notion databases
- [ ] **Google Calendar:** Calendar events → tasks
- [ ] **Email parsing:** Important emails → tasks
- [ ] **GitHub issues:** Repo issues → personal tasks

### Phase 4: Advanced Features
- [ ] **Recurring tasks:** Support for repeating tasks
- [ ] **Subtasks:** Task hierarchy and dependencies
- [ ] **Time tracking:** Log time spent on tasks
- [ ] **Analytics dashboard:** Task completion stats, productivity insights

---

## 💡 Tips for Extending

### Adding New Task Source

**Example: Notion Integration**

1. **Create service:** `src/notion.service.ts`
```typescript
@Injectable()
export class NotionService {
  async fetchTasks(): Promise<NotionTask[]> {
    // Notion API integration
  }
}
```

2. **Update sync service:**
```typescript
async syncNotionTasks() {
  const notionTasks = await this.notionService.fetchTasks();
  
  for (const task of notionTasks) {
    // Check if exists by notion_id
    // Update or create in database
    // Sync to TickTick
  }
}
```

3. **Add database field:**
```prisma
model Task {
  // ...
  notion_id String? @unique
}
```

4. **Run migration:**
```bash
yarn prisma migrate dev --name add_notion_integration
```

---

### Adding New Telegram Command

**Example: `/complete` command**

1. **Update telegram.service.ts:**
```typescript
private async handleCompleteCommand(chatId: number, text: string) {
  const taskKey = text.split(' ')[1]; // e.g., /complete HOME-7
  
  const task = await this.taskService.getTaskByJiraKey(taskKey);
  if (!task) {
    await this.sendMessage(chatId, 'Задача не найдена');
    return;
  }
  
  await this.taskService.updateTask(task.id, { status: 'completed' });
  
  // Update in TickTick
  await this.tickTickService.completeTask(task.ticktick_id);
  
  await this.sendMessage(chatId, `✅ Задача ${taskKey} завершена!`);
}
```

2. **Add command handler:**
```typescript
if (command === '/complete') {
  await this.handleCompleteCommand(chatId, text);
}
```

---

### Adding LLM Processing

**Example: Smart Deadline Suggestion**

1. **Initialize LLM API** (Abacus.AI RouteLLM):
```bash
# Agent will run: initialize_llm_apis
# This sets ABACUSAI_API_KEY in .env
```

2. **Create LLM service:**
```typescript
import { OpenAI } from 'openai';

@Injectable()
export class LlmService {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.ABACUSAI_API_KEY,
      baseURL: 'https://routellm.abacus.ai/v1',
    });
  }
  
  async suggestDeadline(taskDescription: string): Promise<Date | null> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You suggest realistic deadlines for tasks. Return ONLY ISO date or "none".'
        },
        {
          role: 'user',
          content: `Task: ${taskDescription}`
        }
      ],
    });
    
    const suggestion = response.choices[0].message.content;
    return suggestion === 'none' ? null : new Date(suggestion);
  }
}
```

3. **Use in sync logic:**
```typescript
if (!jiraTask.fields.duedate) {
  const suggestedDeadline = await this.llmService.suggestDeadline(
    jiraTask.fields.summary + ' ' + jiraTask.fields.description
  );
  dueDate = suggestedDeadline;
}
```

---

## 🔧 Troubleshooting

### Webhook Not Receiving Events

**Check:**
1. Jira webhook status (green = enabled)
2. Webhook URL is correct
3. Production logs show incoming requests

**Test webhook manually:**
```bash
curl -X POST https://ai-task-secretary-lt40q6.abacusai.app/webhook/jira \
  -H "Content-Type: application/json" \
  -d '{
    "webhookEvent": "jira:issue_created",
    "issue": {
      "key": "TEST-1",
      "fields": {
        "summary": "Test task",
        "assignee": {
          "accountId": "<YOUR_JIRA_ACCOUNT_ID>"
        }
      }
    }
  }'
```

---

### Tasks Not Appearing in TickTick

**Check:**
1. TickTick project "Jira" exists (auto-created on first sync)
2. TickTick access token is valid
3. Logs show `[TickTickService] Created task with ID: ...`

**Test TickTick API manually:**
```bash
curl https://api.ticktick.com/open/v1/project \
  -H "Authorization: Bearer <YOUR_TICKTICK_ACCESS_TOKEN>"
```

---

### Database Connection Issues

**Symptoms:**
- `PrismaClientInitializationError`
- `Connection timeout`

**Solutions:**
1. Verify `DATABASE_URL` in `.env`
2. Run `yarn prisma generate`
3. Check database server status
4. Restart service

---

## 📚 Resources

### Documentation
- [NestJS Docs](https://docs.nestjs.com/)
- [Prisma Docs](https://www.prisma.io/docs)
- [Jira REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [TickTick Open API](https://developer.ticktick.com/api)
- [Telegram Bot API](https://core.telegram.org/bots/api)

### API References
- **Jira Webhook Docs:** https://developer.atlassian.com/cloud/jira/platform/webhooks/
- **TickTick API:** https://developer.ticktick.com/api
- **Abacus RouteLLM:** https://abacus.ai/help/developer-platform/route-llm/api

---

## 📞 Support

### Current Setup
- **Owner:** `<YOUR_EMAIL>`
- **Jira:** `<YOUR_DOMAIN>.atlassian.net`
- **Telegram Bot:** `@ai_task_secretary_bot`
- **Production:** `https://ai-task-secretary-lt40q6.abacusai.app`

### Key Credentials Location
- Environment variables: `/home/ubuntu/ai_task_secretary/nodejs_space/.env`
- API secrets: Managed by Abacus.AI (Jira, Telegram, TickTick)
- Database: Hosted by Abacus.AI

---

## 🎯 Quick Commands Reference

```bash
# Manual sync
curl -H "X-API-Key: <YOUR_SYNC_API_KEY>" \
     https://ai-task-secretary-lt40q6.abacusai.app/sync

# Health check
curl https://ai-task-secretary-lt40q6.abacusai.app/

# View logs (UI)
# Click "Logs" → "Production Logs" in Abacus.AI

# Telegram commands
/list - Show all active tasks

# Database access (local dev)
cd /home/ubuntu/ai_task_secretary/nodejs_space
yarn prisma studio  # Opens GUI at http://localhost:5555

# Run migrations
yarn prisma migrate deploy

# Generate Prisma client
yarn prisma generate
```

---

## ✅ Current Status

**Working Features:**
- ✅ Jira webhook → Database → TickTick sync
- ✅ Manual sync endpoint
- ✅ Telegram `/list` command
- ✅ ADF description parsing
- ✅ Priority mapping
- ✅ Timezone handling (Kyiv UTC+2)
- ✅ Account ID-based filtering

**Known Limitations:**
- ⚠️ One-way sync only (Jira → TickTick)
- ⚠️ No task deletion handling
- ⚠️ No subtask support
- ⚠️ No recurring tasks

**Next Priorities:**
1. Test HOME-9 creation (verify full webhook flow works)
2. Implement two-way sync (TickTick → Jira)
3. Add LLM categorization
4. Integrate Notion

---

## 📝 Changelog

### 2026-02-27
- ✅ Fixed webhook assignee check (email → accountId)
- ✅ Added `JIRA_ACCOUNT_ID` environment variable
- ✅ Improved webhook logging (shows accountId + email)
- ✅ Updated logic: `issue_created` always processes, `issue_updated` checks accountId
- ✅ Deployed to production

### Earlier
- ✅ Migrated from TickTick-first to Database-first architecture
- ✅ Fixed ADF description parsing
- ✅ Implemented Telegram bot with `/list` command
- ✅ Set up Jira webhooks
- ✅ Created TickTick "Jira" project auto-creation
- ✅ Configured Kyiv timezone for due dates

---

**Last Updated:** February 27, 2026  
**Version:** 1.0  
**Status:** Production-ready ✅
