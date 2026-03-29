# Список задач: Исправление багов и Global Exception Filter

- [x] Исправить баг вечернего чека (добавить `getOverdueTasks` к `incompleteTasks`)
- [x] Исправить команду `/logs` (исправить `split` в `file.logger.ts`)
- [x] Исправить баг изменения даты в TickTick при переносе
- [x] Добавить защиту от зависаний в `jira-webhook.controller.ts` и `task-sync.orchestrator.ts`
- [x] Удалить "Новый тест" из базы данных (создан скрипт `delete-test.ts` для запуска на проде)
- [x] Создать `AllExceptionsFilter` для отправки критических ошибок в ТГ прямо из `main.ts`
