# Task List: Умные приоритеты (Smart Prioritization) & Защита от крашей

- [x] Создать метод `smartPrioritizeOverdueTasks` в `PlanningOrchestrator` для умного расчета дней просрочки старых задач.
- [x] Интегрировать `smartPrioritizeOverdueTasks` в утреннее планирование `processMorningPlan`.
- [x] Обернуть удаленные вызовы (TickTick API, Jira API) в `processMorningPlan` и `postponeAllIncompleteTasks` в безопасный блок `try / catch`.
- [x] Обновить метод `updateTask` в `TickTickAdapter`, чтобы он возвращал `null` вместо `throw error`, если прилетает 404 (задача удалена).
- [x] При падении TickTick API (404) удалять `ticktick_id` в нашей БД, чтобы отвязать задачу от "фантома".
- [x] Протестировать логику (Manual Verification).
