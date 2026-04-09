# AI Secretary - реализованные фичи (Project Overview)

Этот файл — «карта памяти» проекта. Здесь фиксируются только ключевые функциональные изменения. Для глубокого погружения читай соответствующие `walkthrough.md`.

---

## 🎙 Голосовой ввод задач (v2.1.7)
*   **Суть:** Бот принимает голосовые сообщения, превращает в текст через Groq Whisper, анализирует через LLM и создает структурированную задачу.
*   **Ключевые файлы:** `stt.adapter.ts`, `telegram.update.ts`, `llm.adapter.ts`.
*   **Статус:** Внедрено, работает. Есть лимит на длину текста в кнопке (64б).
*   **Детали:** [Сессия 2.1.7](docs/sessions/2.1.7/walkthrough.md)

## 🧠 Умная приоритизация (Smart Priority) (v2.1.6)
*   **Суть:** Автоматический «прогрев» старых задач. Если задача просрочена на 1 день — приоритет +1, на 3 дня — MAX (5).
*   **Устойчивость:** Добавлены `try-catch` блоки для всех внешних API, чтобы битые ID в TickTick не ломали утренний план.
*   **Статус:** Внедрено. Ошибки рассинхрона больше не крашат систему.
*   **Детали:** [Сессия 2.1.6](docs/sessions/2.1.6/walkthrough.md)

### Infrastructure & Tooling
*   **Version Control & Repo**: Git + GitHub.
*   **Deployment**: VPS Environment Setup based on Docker and `docker-compose.yml`. CI/CD using GitHub Actions (`quality.yml`, `security.yml`).
*   **Secret Management**: Environment variables (.env).
*   **Security Scanning**: Checkov, Snyk, and detect-secrets integration in CI/CD pipeline.
*   **Automated Backups**: Nightly encrypted ZIP backups via Cron, uploaded to Telegram.

### AI Agentic Workflows
Проект использует строгую систему сменных ролей (шляп) для AI Агентов, описанную в папке `.agent/`. При выполнении задач используются следующие роли:
*   **BA (System Analyst)** — сбор требований и создание планов. Находится в `.agent/roles/ba.md`. Инвокация: `/role-ba`
*   **Architect** — дизайн слоев и интерфейсов. Инвокация: `/role-architect`
*   **Developer** — написание кода. Инвокация: `/role-developer`
*   **QA / Tester** — написание тестов и поиск багов. Инвокация: `/role-tester`
*   **DevSecOps** — настройка инфраструктуры и безопасности. Инвокация: `/role-devops`
*   **Manager** — файловая оркестрация и процессы. Инвокация: `/role-manager`
Для комплексных задач используется `/feature-pipeline` (последовательная оркестрация ролей).

## Context Management Philosophy

## 🛡 Безопасность и CI/CD (Snyk) (v2.1.5)
*   **Суть:** Разделение на два пайплайна. Сначала проверка безопасности Snyk, и только если всё чисто — автоматический деплой на VPS.
*   **Статус:** Настроено в GitHub Actions (`security.yml`, `deploy.yml`).
*   **Детали:** [Сессия 2.1.5](docs/sessions/2.1.5/walkthrough.md)

## 🔄 Авто-обновление токенов (TickTick) (v2.1.5)
*   **Суть:** Реализован Axios Interceptor, который ловит 401 ошибку, сам делает Refresh Token, обновляет базу и повторяет оригинальный запрос.
*   **Статус:** Внедрено. Проблема «вылетающих» сессий TickTick решена.
*   **Детали:** [Сессия 2.1.5](docs/sessions/2.1.5/walkthrough.md)

## 🛠 Memory Management & Roadmap (v2.1.8)
*   **Суть:** Создание воркфлоу `session-start` и `session-end` для «дистилляции» памяти агентов. Внедрение Роадмапа проекта и стратегии экономии токенов.
*   **Ключевые файлы:** `.agent/workflows/session-start.md`, `.agent/workflows/session-end.md`, `BACKLOG.md`.
*   **Статус:** Внедрено. Теперь сессии завершаются архивированием и очисткой лишних KIs.
*   **Детали:** [Сессия 2.1.8](docs/sessions/2.1.8/walkthrough.md)

---
*Последнее обновление: 31.03.2026*
