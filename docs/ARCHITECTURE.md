# AI Task Secretary - Architecture Documentation

## Overview
AI-powered personal secretary system that synchronizes tasks from multiple sources (Jira, Telegram) into TickTick using a NestJS backend with PostgreSQL (Prisma). The system uses LLMs for intelligent task planning, time estimation, and daily checkups.

As of **v3.0**, the project utilizes a **Hexagonal Architecture (Ports & Adapters)** combined with an **Event-Driven** asynchronous flow (BullMQ + EventEmitter) to ensure high decoupling, scalability, and clean boundaries between the business logic and external integrations.

> 🚀 **For server infrastructure, CI/CD pipelines, and deployment instructions, refer to the [Deployment Guide](DEPLOYMENT.md).**

## Tech Stack
- **Backend Framework:** NestJS (TypeScript)
- **Database:** PostgreSQL with Prisma ORM
- **Message Broker:** Redis / BullMQ (for background jobs)
- **Event Bus:** @nestjs/event-emitter (for internal domain events)
- **LLM:** gpt-4o-mini via RouteLLM (Abacus AI)
- **Task Manager:** TickTick (Official OAuth API)
- **Issue Tracker:** Jira (REST API v3)
- **Messaging:** Telegram Bot API (`nestjs-telegraf`)
- **Scheduling:** @nestjs/schedule (Cron jobs)
- **Timezone:** Europe/Kiev (UTC+2)

## Architecture Principles

### 1. Hexagonal Architecture (Ports and Adapters)
The codebase is strictly separated into three distinct layers to decouple business rules from external technologies:

- **Transport Layer (`src/transport/`)**: The "Primary Adapters" (Driving). Handles incoming requests via REST endpoints, Webhooks, Cron jobs, and Telegram interactions. It only parses inputs and delegates execution to Application Orchestrators.
- **Core Layer (`src/core/`)**: The "Hexagon". Contains pure business logic.
  - **Domain (`core/domain/`)**: Entities (`TaskEntity`) and Interface Contracts ("Ports") defining how the core communicates with the outside world (`ITaskRepository`, `ISyncSourceAdapter`, etc.).
  - **Application (`core/application/`)**: Orchestrators (`TaskSyncOrchestrator`, `PlanningOrchestrator`) representing Use Cases, and internal Events (`task.created`, `task.updated`).
- **Infrastructure Layer (`src/infrastructure/`)**: The "Secondary Adapters" (Driven). Implementations of the core interfaces interacting with real external systems (Jira API, TickTick API, PostgreSQL, Redis Queues).

### 2. Event-Driven Asynchronous Processing
To prevent UI blocking and API timeouts (especially important for LLM calls and third-party syncs), the system uses an event-driven data flow:
`Controller / Webhook → Orchestrator → EventEmitter → BullMQ Queue → External API`

### Database as Single Source of Truth
The PostgreSQL database is the **single source of truth** for all task data. External systems (TickTick, Jira) are treated as **synchronized reflections** (Viewers) of the database state.

## Services Structure

### 1. Core: Domain Boundaries (Ports)
- `ITaskRepository`: Contract for database CRUD operations.
- `ISyncSourceAdapter` (e.g. Jira): Contract for fetching tasks from external trackers.
- `ISyncTargetAdapter` (e.g. TickTick): Contract for pushing tasks to viewer apps.
- `IMessagingAdapter` (e.g. Telegram): Contract for communicating with the user.
- `IIntelligenceAdapter` (e.g. LLM): Contract for AI time estimation and planning logic.

### 2. Core: Application Orchestrators
- **`TaskSyncOrchestrator`**: Manages the synchronization flow (Jira → DB). Instead of calling external APIs directly, it saves to the DB and emits `TaskCreatedEvent` or `TaskUpdatedEvent`.
- **`PlanningOrchestrator`**: Handles complex business workflows like Morning Planning (calculating capacity, postponing tasks, asking LLM for plans) and Evening Checkups.

### 3. Infrastructure Adapters
Located in `src/infrastructure/adapters/`, these classes implement the Domain Ports:
- `JiraAdapter` (implements `ISyncSourceAdapter`)
- `TickTickAdapter` (implements `ISyncTargetAdapter`)
- `TelegramAdapter` (implements `IMessagingAdapter`)
- `LlmAdapter` (implements `IIntelligenceAdapter`)
- `TaskRepository` (implements `ITaskRepository` using Prisma)

### 4. Background Queues (BullMQ)
- **`EstimateTimeProcessor`** (`estimate-queue`): Listens for new tasks, calls the `LlmAdapter` to estimate time, updates the DB, and queues a sync-viewers job.
- **`SyncViewersProcessor`** (`sync-viewers-queue`): syncs the finalized task from the DB out to TickTick, and sends Telegram notifications if it's a new task.

### 5. Transport Controllers
Located in `src/transport/`:
- **`WebhookController`**: Handles standard REST endpoints and Jira Webhooks.
- **`SchedulerController`**: Triggers Cron jobs at 10:00 and 21:00.
- **`TelegramUpdate`**: Handles raw Telegram commands (`/start`, `/today`, `/list`) and inline button clicks.

## Database Schema (Prisma)

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
  
  // Planning fields
  estimated_minutes Int?      // LLM-estimated task duration
  actual_minutes    Int?      // Actual time spent (future feature)
  postponed_count   Int       @default(0) // How many times postponed
  parent_id         String?   // For subtasks (future feature)
  
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
}
```

## Key Workflows

### 1. New Jira Task Creation (Data Flow)
```
1. Jira Webhook triggers → WebhookController
2. WebhookController calls → TaskSyncOrchestrator
3. TaskSyncOrchestrator:
   - Saves basic task to Database (via ITaskRepository)
   - Emits `TaskCreatedEvent`
4. TaskEventListener catches event → Adds job to `estimate-queue`
5. EstimateTimeProcessor (BullMQ):
   - Calls LLM (IIntelligenceAdapter) to estimate minutes
   - Updates task in Database
   - Adds job to `sync-viewers-queue`
6. SyncViewersProcessor (BullMQ):
   - Creates task in TickTick (ISyncTargetAdapter)
   - Sends Telegram notification (IMessagingAdapter)
```

### 2. Morning Planning (10:00 Kyiv)
```
1. SchedulerController (Cron) triggers → TelegramAdapter.sendCapacitySelection()
2. User clicks capacity button in Telegram → TelegramUpdate catches Action
3. PlanningOrchestrator.processMorningPlan():
   - Fetches today's and overdue tasks from DB
   - If total time > selected capacity, auto-postpones low-priority tasks
   - Generates plan via LLM
   - Sends Telegram plan message
```

### 3. Evening Checkup (21:00 Kyiv)
```
1. SchedulerController (Cron) triggers → PlanningOrchestrator.processEveningCheckup()
2. Separates incomplete tasks into regular and frequently postponed (>3 times).
3. Sends batched reminder for regular tasks.
4. Uses LLM to generate custom suggestions (Delete, Split, Postpone) for frequently postponed tasks.
```

## Environment Variables

> [!IMPORTANT]
> **Локальный файл `.env` используется только для песочницы/разработки!**
> В Production-окружении (на VPS) переменные среды не тянутся из локального `.env`. Все ключи хранятся в **GitHub Secrets**. При деплое (через GitHub Actions `.github/workflows/deploy.yml`) из этих секретов "на лету" собирается `.env` файл прямо на сервере. Не хардкодьте секреты в код и не рассчитывайте на залив `.env` через Git.

### Webhooks & Routing (Caddy)
> [!IMPORTANT]
> **Маршрутизация Webhook-ов.** Caddy-сервер (reverse proxy) настроен строго на значение секрета `DOMAIN_NAME`. Это значит, что все внешние интеграции (например, вебхуки из Jira или TickTick) **обязаны** стучаться именно по этому доменному имени (и строго по HTTPS). 
> Прямые запросы по IP-адресу сервера будут отброшены веб-сервером с ошибкой сертификата (SSL protocol error / 308 Permanent Redirect).

### Required
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
REDIS_HOST="localhost"
REDIS_PORT=6379

# Integrations
JIRA_DOMAIN="..."
JIRA_EMAIL="..."
JIRA_API_TOKEN="..." 
JIRA_ACCOUNT_ID="..."
TICKTICK_ACCESS_TOKEN="..."
TELEGRAM_BOT_TOKEN="..." 
ABACUSAI_API_KEY="..."

# App Settings
SYNC_API_KEY="..."
DAILY_CAPACITY_MINUTES=360
TIMEZONE="Europe/Kiev"
```

## Version History

### v3.0 (March 2026 - Hexagonal Refactor)
- **Refactoring:** Fully migrated to Hexagonal Architecture (Ports & Adapters).
- **Decoupling:** Transport layer, Core logic, and Infrastructure adapters strictly separated.
- **Asynchronous Flow:** Replaced blocking API calls with BullMQ processing queues + EventEmitter.
- **Reliability:** Background retry support, structured domain events.

### v2.1 (March 2026)
- Enhanced Telegram UI (prevented double-clicks on inline buttons).
- Improved Morning plan UI (per-task time and total).
- Two-way sync when postponing tasks (DB + TickTick + Jira).

### v2.0 (February 2026)
- Introduced LLM integrations (Morning Planning, Evening Checkups, Time Estimation).
- Added Smart postponement tracking.

### v1.0 (January 2026)
- Initial release. Basic Jira ↔ TickTick sync. Database as a single source of truth.
