# AI Secretary - С4 Архитектура

Этот документ описывает статичную архитектуру системы AI Secretary на уровнях C1 (Системный контекст), C2 (Контейнеры) и C3 (Компоненты ядра), следуя философии `Tasks -> Result -> Thoughts -> Tasks`.

## C1: Системный контекст (System Context)
Центром экосистемы является ядро AI Secretary, которое связывает разрозненные инструменты вместе, опираясь на [Фундаментальную философию проекта](file:///c:/Projects/AI%20Secretary/AI-Secretary/docs/mind_cycle_philosophy.md).

```mermaid
C4Context
    title C1: System Context - AI Secretary

    Person(user, "User", "Владелец системы. Ставит задачи, записывает мысли, контролирует результаты.")
    
    System(ai_secretary, "AI Secretary Server", "Центральный мозг. Обрабатывает задачи, подсчитывает время и нагрузку, анализирует мысли через LLM.")
    
    System_Ext(jira, "Jira", "Источник рабочих тасок.")
    System_Ext(telegram, "Telegram Bot", "Главная контрольная панель пользователя.")
    System_Ext(ticktick, "TickTick", "Визуальный агрегатор (только для визуализации).")
    System_Ext(obsidian, "Obsidian / Notion", "Персональная база знаний и источник мыслей (Планы на будущее).")
    System_Ext(llm, "LLM Provider", "RouteLLM / OpenAI. Движок для декомпозиции, оценки времени и мотивации.")
    System_Ext(github, "GitHub Actions", "Репозиторий кода и CI/CD деплой.")
    System_Ext(finance, "External Billing", "Stripe / PayPal - входящие платежи (на будущее).")

    Rel(user, telegram, "Управляет задачами (отменить/перенести)", "Команды")
    Rel(user, ticktick, "Смотрит список задач", "UI")
    Rel(user, obsidian, "Записывает мысли", "Заметки")
    
    Rel(ai_secretary, telegram, "Отправляет утренний план и пуши", "API")
    Rel(telegram, ai_secretary, "Специфичные команды (напр. /today)", "Webhook")
    
    Rel(jira, ai_secretary, "Хук о создании/обновлении таски", "Webhook")
    Rel(ai_secretary, jira, "Обновляет Due Date и статусы", "REST API")
    
    Rel(ai_secretary, ticktick, "Пушит таски для удобного отображения", "REST API")
    Rel(ai_secretary, llm, "Запрашивает анализ и естимейты", "REST API")
```

## C2: Контейнеры (Containers)
Уровень контейнеров показывает из каких крупных технических компонентов состоит система, где находится база данных и очереди.

```mermaid
C4Container
    title C2: Containers - AI Secretary Ecosystem

    Person(user, "User", "Взаимодействует через Telegram и TickTick.")

    System_Boundary(c1, "AI Secretary Infrastructure (Hosting: Contabo VPS)") {
        Container(server, "AI Task Server", "NestJS", "Ядро бизнес логики. Оркестрирует задачи, хуки и LLM анализ.")
        ContainerDb(db, "Primary Database", "PostgreSQL", "Единый источник правды. Хранит Tasks, Thoughts, метрики.")
        ContainerDb(vector_db, "Vector DB (Future)", "Pinecone / pgvector", "Семантический поиск для скрытого сбора и связи Мыслей (Thoughts) без прямого опроса.")
        Container(queue, "Message Broker", "Redis (BullMQ)", "Очередь задач для асинхронных операций (сетевые запросы, LLM). Гарантирует надежность.")
    }

    System_Ext(jira, "Jira", "Бэкенд рабочих задач")
    System_Ext(telegram_api, "Telegram API", "Интерфейс бота")
    System_Ext(ticktick_api, "TickTick API", "Визуальный календарь")
    System_Ext(llm_api, "RouteLLM API", "Интеллект")

    Rel(user, telegram_api, "Читает/Пишет")
    Rel(telegram_api, server, "Webhooks (действия)", "JSON/HTTPS")
    Rel(server, telegram_api, "Отправляет Сообщения", "JSON/HTTPS")
    
    Rel(jira, server, "Webhooks (Task Added)", "JSON/HTTPS")
    Rel(server, jira, "REST API (Update Task)", "JSON/HTTPS")
    
    Rel(server, ticktick_api, "Создает/Обновляет задачи", "JSON/HTTPS")
    Rel(server, llm_api, "JSON Промпты", "JSON/HTTPS")
    
    Rel(server, db, "Чтение/Изменение данных", "Prisma/TCP")
    Rel(server, queue, "Ставит Jobs в очередь", "Redis Protocol")
    Rel(queue, server, "Триггерит Queue Workers", "Redis Protocol")
```

## C3: Компоненты (Components - AI Task Server)
Внутренняя структура NestJS приложения, следующая подходу Гексагональной архитектуры (Разделение на транпорт, ядро и адаптеры).

```mermaid
C4Component
    title C3: Components - AI Task Server (NestJS)

    ContainerDb(db, "PostgreSQL", "External", "Database")
    Container(queue, "BullMQ / Redis", "External", "Message Broker")
    System_Ext(external_apis, "Внешние API", "Jira, TickTick, Telegram, LLM")

    Container_Boundary(server, "AI Task Server Core") {
        
        Boundary(transport, "Transport Layer (Inbound Ports)") {
            Component(webhook_ctrl, "Webhooks Controller", "NestJS", "Принимает входящие хуки извне.")
            Component(telegram_ctrl, "Telegram Controller", "NestJS", "Парсит команды бота.")
            Component(cron, "Scheduler Component", "Cron", "Генерирует утренние/вечерние события времени.")
        }

        Boundary(usecases, "Application Flow / Orchestrators") {
            Component(task_sync_orch, "Task Sync Orchestrator", "Service", "Управляет флоу добавления новой задачи.")
            Component(planning_orch, "Planning Orchestrator", "Service", "Собирает утренний и вечерний план.")
            Component(event_listener, "Event Bus Listener", "Emitter", "Слушает внутренние события.")
        }

        Boundary(domain, "Domain Logic (Core)") {
            Component(task_service, "Task Entity & Service", "Service", "Смысловая логика: статусы, лимиты откладываний.")
            Component(capacity, "Capacity Logic", "Module", "Подсчет нагрузки времени.")
        }

        Boundary(infrastructure, "Infrastructure Layer (Outbound Adapters)") {
            Component(db_adapter, "Database Adapter", "Prisma", "Абстракция для работы в БД.")
            Component(queue_adapter, "Queue Adapter", "BullMQ", "Абстракция для постановки тяжелых задач.")
            Component(api_adapters, "External API Adapters", "Services", "Реализации работы с HTTP API внешних систем.")
            Component(crypto_adapter, "Crypto & Security (Future)", "ZKP/E2EE", "Модуль для локального шифрования 'Мыслей' и Zero-Knowledge Proof.")
        }
    }

    Rel(webhook_ctrl, task_sync_orch, "Прокидывает payload")
    Rel(task_sync_orch, task_service, "Добавляет Task в базу")
    Rel(task_service, db_adapter, "Сохраняет состояние")
    Rel(task_sync_orch, event_listener, "Кидает событие (сохранено)")
    Rel(event_listener, queue_adapter, "Ставит фоновую задачу")
    
    Rel(db_adapter, db, "SQL")
    Rel(queue_adapter, queue, "Add Job")
    Rel(queue, api_adapters, "Workers Pick Up Jobs")
    Rel(api_adapters, external_apis, "HTTP / Webhooks")
```
