# AI Secretary — Claude Instructions

> Эти правила обязательны для всех сессий, если явно не переопределены в запросе.

---

## 🔐 Security & Privacy

**КРИТИЧНО:** Никогда не коммить и не показывать в документации:
- API ключи (Jira, TickTick, Telegram, OpenAI и т.д.)
- DATABASE_URL с паролем
- Access токены, email адреса, account ID
- Любые production credentials

**Используй placeholder'ы:**
```
JIRA_API_TOKEN='<YOUR_JIRA_API_TOKEN>'
JIRA_EMAIL='<YOUR_EMAIL>'
TELEGRAM_CHAT_ID='<YOUR_TELEGRAM_CHAT_ID>'
```

Перед завершением сессии запускай security scan (см. `.agent/workflows/session-end.md`).

---

## 💬 Стиль общения

- Короткие ответы по существу — без лишних объяснений если не просят
- Общение свободное, без официоза
- Не использовать таблицы без явного запроса
- Не генерировать .pdf файлы без явного запроса
- Объяснять **почему** делаем изменение, а не только что

---

## 📋 BACKLOG

Никогда не терять идеи и технический долг. Правила:

1. **Во время задачи:** Нашёл баг не по теме, пришла идея — молча добавь в `docs/BACKLOG.md`, не отвлекайся от текущего плана.
2. **Начало новой сессии:** Если нет жёсткого плана — предложи 1-2 задачи из `docs/BACKLOG.md`.
3. Задачи из BACKLOG переходят в `implementation_plan.md` только после явного утверждения.

---

## 🏗️ Архитектура проекта

**Стек:** NestJS (TypeScript), PostgreSQL + Prisma, Redis/BullMQ, Telegram Bot, Jira API, TickTick API, OpenAI.

**Слои (строго соблюдать):**
- `transport/` — контроллеры, webhooks, cron. Только парсинг и делегирование.
- `core/domain/` — entities и interfaces (ports). Никаких внешних зависимостей.
- `core/application/` — orchestrators (use cases) и события.
- `infrastructure/` — реализации адаптеров, БД, очереди.

**Принципы:**
- БД — единственный источник правды. TickTick/Jira — отражения. Всегда сначала DB.
- Timezone: `Europe/Kiev` (UTC+2). Due dates в TickTick: `23:59:00+0200`.
- Никогда не использовать `while(true)` — только внешний CRON через endpoints.
- Secrets живут в GitHub Secrets → `.env` на сервере. Локальный `.env` пустой.

**Telegram UI:**
- Убирать inline keyboard после нажатия кнопки (предотвращение double-click).
- Ошибки кратко и понятно пользователю.

---

## 📁 Сессии и документация

- Артефакты сессии сохраняются в `docs/sessions/{VERSION}/`.
- Workflow завершения сессии: `.agent/workflows/session-end.md`.

---

## 🛠 Команды

```bash
# Сборка и запуск
cd nodejs_space
npm run build
npm run start:prod

# Разработка
npm run start:dev

# БД
npx prisma generate
npx prisma migrate dev
```
