# AI Secretary - Roadmap & Backlog

This document serves as the central repository for project vision, features, and technical debt. 

## 🗺 PROJECT ROADMAP (Vision)
- **Phase 1: Foundation (Done)** — Basic Jira/TickTick/Telegram integration, Hexagonal architecture, stable VPS deployment.
- **Phase 2: AI Intelligence (Active)** — STT (Whisper), Smart planning, LLM categorization, Automated daily/evening routines.
- **Phase 3: Ecosystem Expansion (Planned)** — Multi-tenancy, Notion/Google Calendar support, Mobile UI (Telegram Mini App).
- **Phase 4: Personal Wisdom (Future)** — Integration with Obsidian, Deep productivity analytics, autonomous task execution.

## 🚀 Future Features
- **Multi-user Support (Multi-tenancy):** Allow multiple Telegram users to have their own AI Secretary instances. Store `TickTickToken` and `JiraToken` in the DB linked to a specific `TelegramUserID`.

### Core Improvements
- **Security Scanning (CI/CD):** Интеграция Snyk (или аналога) в GitHub Actions для проверки уязвимостей перед деплоем.
- **Morning Question Rework:** Привязка времени ответа пользователя (для трекинга сна), изменение формулировки, добавление кнопки "Сегодня выходной".
- **Critical Server Events Alerts:** Отправка важных системных сообщений (например, падение процессов) напрямую в ТГ-бота.
- **Global Task Sync:** Периодическая (раз в день / при старте) полная синхронизация задач из Jira с БД (БД - источник правды).
- **Code Quality Audit:** Разобраться более детально с SonarCloud / DeepSource для автоматической проверки качества кода.
- **Motivation & Obsidian:** Внедрение системы мотивации и интеграция с Obsidian.
- **Telegram Mini App / Native Dashboard:** Build a powerful UI inside Telegram to manage tasks (complete, postpone, prioritize, delete) and view server logs. Telegram will act as the primary controller for Jira.
- **TickTick Deprecation:** Keep TickTick as a read-only visual widget for now. Do NOT add two-way sync to it. In the future, replace it with a custom personal widget.
- **Task deletion:** Handle deleted tasks in Jira
- **Error recovery:** Retry failed API calls

### LLM Integration
- **Smart categorization:** Auto-detect task category from description
- **Deadline suggestion:** LLM suggests due dates based on task content
- **Voice input (Telegram → Task):**
  - Telegram voice/audio message → Speech-to-Text (Whisper API) → текст
  - Текст → LLM парсинг: извлечь название задачи, дату, приоритет, категорию
  - Если дата не указана — спросить или поставить "сегодня"
  - Если приоритет не указан — LLM предлагает на основе контекста
  - Создать задачу через существующий flow (DB → Jira → TickTick)
  - Отправить подтверждение в Telegram с кнопками "✅ Ок" / "✏️ Изменить"
  - **STT провайдер:** Groq Whisper API (free tier: 2000 req/day, 20 req/min). OpenAI-совместимый SDK, base URL: `https://api.groq.com/openai/v1`. Ключ в `GROQ_API_KEY` (GitHub Secrets → .env)
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
- **Daily/Evening Check Bug:** Утренний чек находит задачу (напр. HOME-18), а вечерний говорит, что всё закрыто.
- **Ghost Task Bug:** Периодически всплывает задача "Новый тест" в дневном плане.
- ~~**Jira -> TG Sync Bug & Freeze:** Добавление задачи в Джире не отправляет сообщение в ТГ. Зависает процесс.~~ *(Решено: Проблема была в блокировке вебхуков Cloudflare Bot Fight Mode)*
- **TickTick Reschedule Bug:** Перенос задачи в ТГ переносит её в Jira, но НЕ в TickTick.
- **Text adjustments:** Небольшие правки текстов сообщений бота.
- **Command Bug:** Команда `/logs` в Telegram не работает.

## 💡 AI Secretary Best Practices
### Programming & Architecture
1. **Тестовые Среды (Песочницы).** До момента реализации полноценного CI/CD пайплайна с разделением Dev/Prod, текущий деплой-сервер (VPS) считается "песочницей". В будущем необходимо создать отдельного бота и отдельную БД для честного Staging/Dev окружения.
2. Keep services focused (Single Responsibility).
3. Database is the Single Source of Truth; TickTick and Jira are reflections. Always execute DB first.
4. Don't use infinite loops (`while(true)`). Always rely on external CRON via endpoints.
5. Always use Timezone `Europe/Kiev` (UTC+2). Due dates in TickTick should be `23:59:00`.

### Infrastructure & Security
1. **Cloudflare WAF (Bot Fight Mode):** Если включен "Bot Fight Mode", он блокирует вебхуки Jira (AWS IPs). Чтобы получать вебхуки, сделай Custom WAF Rule: `Если URI Path содержит /webhook/jira -> Действие: Skip -> Галочка: Bot Fight Mode`.

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
