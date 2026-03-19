# AI Secretary - Data Flow и Sequence Диаграммы

Этот документ описывает динамику прохождения данных сквозь систему. В качестве примера используется самый частый сценарий: **Создание новой задачи во внешнем источнике (Jira) и её обработка сервером**.

Данные диаграммы учитывают последовательное (Chained) выполнение фоновых задач во избежание "гонки данных" (Race Conditions).

## Data Flow Diagram (DFD)

Диаграмма потока данных показывает шаги, через которые протекает информация, и как обрабатываются ошибки (чтобы пользователь не увидел пустую задачу без оценки времени).

```mermaid
flowchart TD
    %% Внешние системы
    Jira[Jira Webhook]
    TickTick[TickTick API]
    Telegram[Telegram API]
    LLM[RouteLLM API]

    %% Слои внутри сервера
    Transport[Transport layer:\nWebhooks Controller]
    Orchestrator[Use Cases layer:\nTask Sync Orchestrator]
    Domain[Domain layer:\nTask Service]
    DB[(PostgreSQL DB)]
    
    %% ФОНОВЫЕ ВОРКЕРЫ (ОЧЕРЕДЬ)
    Queue_Job1[Worker Job 1:\nEstimateTimeJob]
    Queue_Job2[Worker Job 2:\nSyncToViewersJob]

    %% --- ПОТОК ---
    Jira -- "1. POST JSON (New Issue)" --> Transport
    
    Transport -- "2. Валидация (Если мусор -> 400 Bad Request)" --> Orchestrator
    
    Orchestrator -- "3. Конвертация в Canonical Task формат" --> Domain
    Domain -- "4. Сохранение (Status: pending_estimation)" --> DB
    
    Orchestrator -- "5. Emit: TaskCreatedEvent" --> Queue_Job1
    
    Queue_Job1 -- "6. Читает задачу из БД" --> DB
    Queue_Job1 -- "7. Промпт: Оцени время в минутах" --> LLM
    LLM -- "8. Ответ (Оценка: 45m)" --> Queue_Job1
    Queue_Job1 -- "9. Обновляет estimated_time и Status: active" --> DB
    
    Queue_Job1 -- "10. ТОЛЬКО ПРИ УСПЕХЕ -> ставит следующий Job" --> Queue_Job2
    
    Queue_Job2 -- "11. Читает готовую задачу с оценкой времени" --> DB
    Queue_Job2 -- "12. Создает визуальную карточку" --> TickTick
    Queue_Job2 -- "13. Шлет уведомление со временем и деталями" --> Telegram
    
    %% --- ОБРАБОТКА ОШИБОК ---
    Queue_Job1 -. "Ошибка: Retry через BullMQ" .-> Queue_Job1
    Queue_Job2 -. "Ошибка: Retry если TickTick упал" .-> Queue_Job2
```

## Sequence Diagram

Диаграмма последовательности (Sequence) делает акцент на *временных интервалах* и ответах систем. Она показывает, что мы быстро возвращаем 200 OK для Jira, а вся тяжелая работа выносится в асинхронную очередь.

```mermaid
sequenceDiagram
    autonumber
    actor External as Jira Webhook
    participant WH as Inbound: Webhook Control
    participant Orch as Use Case: Task Orchestrator
    participant DB as Postgres Database
    participant Q as Message Queue (BullMQ)
    participant W1 as Worker: EstimateTime
    participant LLM as RouteLLM API
    participant W2 as Worker: Sync View
    participant TT as TickTick API
    participant TG as Telegram API

    External->>WH: POST /webhook/jira (New Issue Data)
    WH->>Orch: Передает валидный Payload
    
    Orch->>DB: Ищет задачу (А вдруг дубль?)
    DB-->>Orch: Не найдено, создаем статус: pending_estimation
    
    Orch->>DB: Сохраняет в базу "черновик" задачи
    DB-->>Orch: Возвращает сохраненный TASK ID
    
    Orch->>Q: В очередь -> Добавить 'EstimateTimeJob' (taskId)
    Orch-->>WH: Задача принята в работу
    WH-->>External: HTTP 200 OK (Быстрый ответ!)
    
    Note over Q,LLM: ---- Начинается асинхронная обработка (Фон) ----
    
    Q->>W1: Выполняется 'EstimateTimeJob' (taskId)
    W1->>DB: Запрос деталей по taskId
    DB-->>W1: Task Title & Description
    
    W1->>LLM: POST /chat/completions (Запрос на оценку времени)
    alt Ошибка (Таймаут, Rate Limit)
        LLM-->>W1: 500 Error / Timeout
        W1->>Q: Отложить Job и повторить (Retry)
    else Успешно
        LLM-->>W1: 200 OK ({"minutes": 45})
        W1->>DB: UPDATE Task (estimated_minutes=45, status='active')
        DB-->>W1: Сохранено успешно
        W1->>Q: Отметить 'EstimateTimeJob' как выполненный
        W1->>Q: В очередь -> Добавить 'SyncToViewersJob' (taskId)
    end
    
    Note over Q,TG: ---- Чейнинг (Цепная реакция после оценки времени) ----
    
    Q->>W2: Выполняется 'SyncToViewersJob' (taskId)
    W2->>DB: Запрос полной готовой задачи
    DB-->>W2: Полная задача (уже с оценкой 45м)
    
    par Параллельные HTTP запросы
        W2->>TT: POST /task (Создает таску с оценкой для календаря)
        TT-->>W2: 200 OK
    and
        W2->>TG: sendMessage("Новая задача + Оценка 45 мин")
        TG-->>W2: 200 OK
    end
    
    W2->>Q: Отметить 'SyncToViewersJob' как выполненный
```
