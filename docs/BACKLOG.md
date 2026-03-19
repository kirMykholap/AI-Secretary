# AI Secretary - Roadmap & Backlog

This document serves as the central repository for ideas, technical debt, and future features. 
AI Agents must consult this document at the start of new sessions and append ideas here instead of deviating from their current tasks.

## 🚀 Future Features
- **Multi-user Support (Multi-tenancy):** Allow multiple Telegram users to have their own AI Secretary instances. Store `TickTickToken` and `JiraToken` in the DB linked to a specific `TelegramUserID`.

### Core Improvements
- **Two-way sync:** TickTick completion → Jira status update
- **Task deletion:** Handle deleted tasks in Jira
- **Bulk operations:** Telegram command to mark multiple tasks done
- **Error recovery:** Retry failed TickTick API calls

### LLM Integration
- **Smart categorization:** Auto-detect task category from description
- **Deadline suggestion:** LLM suggests due dates based on task content
- **Voice input:** Telegram voice messages → structured tasks
- **Priority prediction:** Auto-assign priority based on keywords

### Additional Sources
- **Notion integration:** Sync from Notion databases
- **Google Calendar:** Calendar events → tasks
- **Email parsing:** Important emails → tasks
- **GitHub issues:** Repo issues → personal tasks

### Advanced Features
- **Recurring tasks:** Support for repeating tasks
- **Subtasks:** Task hierarchy and dependencies
- **Time tracking:** Log time spent on tasks
- **Analytics dashboard:** Task completion stats, productivity insights
- **Multi-user Support (Multi-tenancy):** Allow multiple Telegram users to have their own AI Secretary instances. Store `TickTickToken` and `JiraToken` in the DB linked to a specific `TelegramUserID`.

## 🛠 Technical Debt & Refactoring
- 

## 💡 AI Secretary Best Practices
### Programming & Architecture
1. Keep services focused (Single Responsibility).
2. Database is the Single Source of Truth; TickTick and Jira are reflections. Always execute DB first.
3. Don't use infinite loops (`while(true)`). Always rely on external CRON via endpoints.
4. Always use Timezone `Europe/Kiev` (UTC+2). Due dates in TickTick should be `23:59:00`.

### UI / Telegram
1. Remove inline keyboards after button click to prevent double-clicks.
2. Provide context for any errors. Keep responses concise and user-friendly.

### Integrations
1. Jira: Use Account ID for assignee checks. Map priorities Highest->5, High->3, Medium->1, Low->0.
2. TickTick: Auto-create "Jira" project. Sync tags `['jira']`.
3. LLM: Use `gpt-4o-mini` via RouteLLM. Handle API errors gracefully with fallback defaults.

## 🧱 Tips for Extending

### Adding New Task Source (e.g. Notion)
1. Create service: `src/infrastructure/adapters/notion.adapter.ts`
2. Implement sync logic in `TaskSyncOrchestrator`.
3. Add database external IDs to Prisma: `notion_id String? @unique`

### Adding New Telegram Command
1. Add command handler in `telegram.update.ts` (e.g., `@Command('complete')`).
2. Fetch the task via `TaskRepository` and update its status.
3. Push status to TickTick via `TickTickAdapter`.

### Adding LLM Processing (e.g. Deadline Suggestion)
1. Use `LlmAdapter` to call OpenAI with specific prompt.
2. Return parsed values (e.g., expected date) and inject them before DB creation.
