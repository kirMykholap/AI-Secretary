# AI Task Secretary - Architecture Documentation

## Overview
AI-powered personal secretary system that synchronizes tasks from multiple sources (Jira, Telegram) into TickTick using a NestJS backend with PostgreSQL (Prisma). The system uses LLM for intelligent task planning and time estimation.

## Tech Stack
- **Backend Framework:** NestJS (TypeScript)
- **Database:** PostgreSQL with Prisma ORM
- **LLM:** gpt-4o-mini via RouteLLM (Abacus AI)
- **Task Manager:** TickTick (Official OAuth API)
- **Issue Tracker:** Jira (REST API v3)
- **Messaging:** Telegram Bot API
- **Scheduling:** @nestjs/schedule with cron jobs
- **Timezone:** Europe/Kiev (UTC+2)

## Architecture Principles

### Database as Single Source of Truth
The PostgreSQL database is the **single source of truth** for all task data. External systems (TickTick, Jira) are treated as **synchronized reflections** of the database state.

**Data Flow:**
```
Jira Webhook → Database → TickTick
Telegram Bot → Database → TickTick + Jira (for updates)
```

### Services Structure

#### Core Services

**1. TaskService** (`src/task.service.ts`)
- CRUD operations for tasks in database
- Database queries and filtering
- Key methods:
  - `createTask()` - Create new task
  - `updateTask()` - Update existing task
  - `getTasksByDueDateRange()` - Get tasks by date range
  - `getActiveTasksByDueDateRange()` - Get active tasks only
  - `getOverdueTasks()` - Get tasks past due date
  - `getPostponedTasks()` - Get tasks with postponed_count > 0
  - `getTaskByJiraKey()` - Find by Jira key (e.g., HOME-7)

**2. SyncService** (`src/sync.service.ts`)
- Synchronizes Jira tasks to database and TickTick
- LLM time estimation for new tasks
- Telegram notifications for new tasks (24/7)
- Key methods:
  - `syncSingleJiraTask()` - Sync one Jira issue
  - `syncAllJiraTasks()` - Full sync of all assigned tasks
- **New Task Flow:**
  1. Receive Jira webhook
  2. Create task in database
  3. Estimate time using LLM
  4. Create task in TickTick
  5. Send Telegram notification with estimated time

**3. LlmService** (`src/llm.service.ts`)
- LLM integration using RouteLLM API
- Uses gpt-4o-mini model
- Key methods:
  - `estimateTaskTime()` - Estimate task duration in minutes
  - `generateMorningPlan()` - Create motivational daily plan
  - `generatePostponeReason()` - Explain task postponement
  - `generateEveningReminder()` - Friendly incomplete task reminders
  - `generatePostponedTaskSuggestion()` - Suggestions for tasks postponed >3 times

**4. SchedulerService** (`src/scheduler.service.ts`)
- Automated cron jobs for planning and checkups
- **Morning Planning (10:00 Kyiv):**
  - Sends capacity selection buttons (💪 100%=360min, 😐 60%=216min, 😴 30%=108min)
  - Calculates workload based on estimated task times
  - Postpones low-priority tasks if capacity exceeded
  - Shows per-task time estimates and total time
  - Displays postponed tasks separately with LLM-generated reasons
  - Syncs postponed tasks to TickTick and Jira
- **Evening Checkup (21:00 Kyiv):**
  - Checks incomplete tasks for today
  - Sends **single message** with all incomplete tasks
  - Provides "Перенести все на завтра" button
  - Special handling for tasks postponed >3 times (individual messages with suggestions)
- Key methods:
  - `processMorningPlan()` - Process capacity selection and generate plan
  - `handleEveningCheckup()` - Evening task review
  - `postponeAllIncompleteTasks()` - Postpone all tasks with DB + TickTick + Jira sync

**5. TelegramService** (`src/telegram.service.ts`)
- Telegram Bot API integration
- User commands and inline button handlers
- **Commands:**
  - `/start` - Welcome message and feature list
  - `/list` - All active tasks
  - `/today` - Today's plan with time estimates
  - `/postponed` - Tasks that were postponed
- **Inline Button Handling:**
  - Removes buttons after any click (prevents multiple clicks)
  - `capacity_*` - Morning capacity selection
  - `postpone_all` - Postpone all incomplete tasks (evening)
  - `postpone_*` - Postpone single task
  - `delete_*` - Close task as irrelevant
  - `split_*` - Task decomposition (placeholder)
- **Two-Way Sync:**
  - Postponing tasks updates DB, TickTick, and Jira
  - Uses `updateJiraDueDate()` to update Jira due dates
  - Uses TickTick API to update task due dates
- **Notifications:**
  - New task from Jira (24/7, no time restrictions)
  - Shows Jira key, title, and LLM time estimate

**6. JiraService** (`src/jira.service.ts`)
- Jira REST API v3 integration
- Fetch assigned tasks
- Update task fields (due date)
- Key methods:
  - `getTaskById()` - Fetch single issue
  - `getAssignedTasks()` - Get all assigned unresolved issues

**7. TickTickService** (`src/ticktick.service.ts`)
- TickTick Open API integration
- Create and update tasks in "Jira" project
- Key methods:
  - `createTask()` - Create new task
  - `updateTask()` - Update task fields (including due date)

## Database Schema

### Tasks Table
```prisma
model Task {
  id                String    @id @default(uuid())
  source            String    // 'jira' | 'ticktick' | 'telegram' | 'notion'
  source_id         String
  title             String
  description       String?
  status            String    @default("active") // 'active' | 'completed' | 'deleted'
  priority          Int       @default(1) // 0-5, higher = more urgent
  due_date          DateTime?
  tags              String[]
  
  // Cross-reference IDs
  jira_id           String?   @unique
  jira_key          String?   // e.g., HOME-10
  ticktick_id       String?   @unique
  
  // Planning fields (v2.0)
  estimated_minutes Int?      // LLM-estimated task duration
  actual_minutes    Int?      // Actual time spent (future feature)
  postponed_count   Int       @default(0) // How many times postponed
  parent_id         String?   // For subtasks (future feature)
  
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
}
```

## Key Workflows

### 1. New Jira Task Creation
```
1. Jira Webhook → JiraController
2. JiraController → SyncService.syncSingleJiraTask()
3. SyncService:
   - Create task in database
   - LlmService.estimateTaskTime() → update estimated_minutes
   - Create task in TickTick
   - TelegramService.sendNewTaskNotification() (24/7)
```

### 2. Morning Planning (10:00 Kyiv)
```
1. SchedulerService cron job triggers
2. Send capacity selection message to Telegram
3. User clicks capacity button
4. SchedulerService.processMorningPlan():
   - Fetch today's tasks + overdue tasks
   - Calculate total estimated time
   - If overloaded, postpone low-priority tasks:
     - Update due_date in database
     - Update TickTick task
     - Update Jira issue due date
   - Generate plan message:
     - List tasks with Jira keys and estimated times
     - Show total time
     - Show postponed tasks separately
     - Add LLM motivational text
   - Send plan to Telegram
```

### 3. Evening Checkup (21:00 Kyiv)
```
1. SchedulerService cron job triggers
2. Fetch all active tasks due today
3. Separate into:
   - Regular incomplete (postponed_count ≤ 3)
   - Frequently postponed (postponed_count > 3)
4. Send **single message** with all regular incomplete tasks
   - Show button "Перенести все на завтра"
5. Send individual messages for frequently postponed tasks
   - LLM-generated suggestion
   - Options: delete, split, or postpone again
```

### 4. Postpone All Tasks
```
1. User clicks "Перенести все на завтра" button
2. TelegramService removes inline keyboard
3. SchedulerService.postponeAllIncompleteTasks():
   - For each incomplete task:
     - Increment postponed_count in database
     - Update due_date to tomorrow in database
     - Update TickTick task due date via API
     - Update Jira issue due date via API
   - Send confirmation message
```

### 5. Jira Task Update
```
1. Jira Webhook (issue_updated) → JiraController
2. JiraController → SyncService.syncSingleJiraTask()
3. SyncService:
   - Update task in database
   - Update task in TickTick
   - No Telegram notification for updates (only new tasks)
```

## Environment Variables

### Required
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# Jira
JIRA_DOMAIN="kir-home-test.atlassian.net"
JIRA_EMAIL="kir.mykholap@gmail.com"
JIRA_API_TOKEN="..." # From API secrets

# TickTick
TICKTICK_ACCESS_TOKEN="..." # From API secrets

# Telegram
TELEGRAM_BOT_TOKEN="..." # From API secrets

# LLM
ABACUSAI_API_KEY="..." # Auto-configured by platform

# Planning
DAILY_CAPACITY_MINUTES=360 # Default capacity (6 hours)
MORNING_CRON="0 10 * * *" # 10:00 Kyiv
EVENING_CRON="0 21 * * *" # 21:00 Kyiv
TIMEZONE="Europe/Kiev"
```

## Deployment

**Production URL:** https://ai-task-secretary-lt40q6.abacusai.app

**Webhook URLs:**
- Jira: `https://ai-task-secretary-lt40q6.abacusai.app/webhook/jira`
- Telegram: `https://ai-task-secretary-lt40q6.abacusai.app/webhook/telegram`

## Future Enhancements

### Planned Features
1. **TickTick → Jira Two-Way Sync**
   - TickTick webhook to detect task completion
   - Update Jira status to "Done" when TickTick task completed

2. **Jira Task Deletion Handling**
   - Webhook for `issue_deleted` event
   - Close task in database and TickTick

3. **Automatic Task Decomposition**
   - LLM-powered task splitting for complex tasks
   - Create subtasks in Jira and link to parent

4. **Subtask Support**
   - Import Jira subtasks to database
   - Link using `parent_id` field
   - Show hierarchical task view

5. **Actual Time Tracking**
   - Record actual time spent on tasks
   - Compare with estimated_minutes
   - Improve LLM estimation over time

6. **Notion Integration**
   - Sync tasks from Notion databases
   - Support for notion:// links

7. **Close Tasks in Jira via Bot**
   - Update Jira status to "Done" through bot
   - Currently shows placeholder message

## Troubleshooting

### Common Issues

**1. Buttons can be clicked multiple times**
- ✅ FIXED: Added `removeInlineKeyboard()` after every callback

**2. Morning plan doesn't show task times**
- ✅ FIXED: Now shows estimated_minutes per task and total time

**3. Evening checkup sends too many messages**
- ✅ FIXED: Combined into single message with "Перенести все на завтра" button

**4. Postponing tasks doesn't update TickTick/Jira**
- ✅ FIXED: Added two-way sync when postponing tasks

**5. No notification for new Jira tasks**
- ✅ FIXED: Added 24/7 Telegram notifications with LLM time estimate

## Code Locations

### Morning/Evening Checkup Logic
- **File:** `src/scheduler.service.ts`
- **Methods:** `handleMorningPlanning()`, `processMorningPlan()`, `handleEveningCheckup()`, `postponeAllIncompleteTasks()`

### TickTick API Integration
- **File:** `src/ticktick.service.ts`
- **Methods:** `createTask()`, `updateTask()`, `ensureJiraProject()`

### Jira API Integration
- **File:** `src/jira.service.ts`
- **Methods:** `getTaskById()`, `getAssignedTasks()`
- **Update Due Date:** `src/telegram.service.ts` and `src/scheduler.service.ts` have `updateJiraDueDate()` helper methods

### LLM Integration
- **File:** `src/llm.service.ts`
- **API:** RouteLLM (Abacus AI) - `https://routellm.abacus.ai/v1`
- **Model:** gpt-4o-mini
- **Methods:** All generation and estimation functions

### Telegram Bot Logic
- **File:** `src/telegram.service.ts`
- **Commands:** `handleStartCommand()`, `handleListCommand()`, `handleTodayCommand()`, `handlePostponedCommand()`
- **Callbacks:** `handleCallbackQuery()` - processes all inline button clicks
- **Notifications:** `sendNewTaskNotification()`, `sendEveningCheckupMessage()`, `sendCapacitySelection()`

## Version History

### v2.1 (Current - March 2026)
- ✅ Fixed: Inline buttons can only be clicked once
- ✅ Enhanced: Morning plan shows per-task time and total
- ✅ Improved: Evening checkup combines tasks into single message
- ✅ Added: Two-way sync when postponing tasks (DB + TickTick + Jira)
- ✅ Added: 24/7 Telegram notifications for new Jira tasks
- ✅ Removed: "Закрою сегодня" button from evening checkup

### v2.0 (February 2026)
- Initial AI secretary features
- Morning planning with capacity selection
- Evening checkup with reminders
- LLM time estimation
- Automated cron jobs
- Smart postponement tracking

### v1.0 (January 2026)
- Basic Jira ↔ TickTick sync
- Database as source of truth
- Telegram bot commands
- Webhook integrations
