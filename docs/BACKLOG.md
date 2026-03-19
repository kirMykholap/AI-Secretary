# AI Secretary - Roadmap & Backlog

This document serves as the central repository for ideas, technical debt, and future features. 
AI Agents must consult this document at the start of new sessions and append ideas here instead of deviating from their current tasks.

## 🚀 Future Features
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
