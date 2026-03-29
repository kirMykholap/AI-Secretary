# Список задач: Новые фичи (Трекинг, Меню, Синхронизация)

- [x] Внести изменения в `schema.prisma` (добавить таблицу `DailyCheckin` с `user_id`)
- [x] Обновить `deploy.yml` (`yarn prisma db push --accept-data-loss`)
- [x] Изменить кнопку "30%" на "🌴 Сегодня выходной" (в `telegram.adapter.ts`)
- [x] Обрабатывать ответ емкости и записывать в БД (в `planning.orchestrator.ts`)
- [x] Смещать все задачи на завтра при нажатии "Выходной" (в `planning.orchestrator.ts`)
- [x] Установить инлайн-меню команд Телеграма при старте бота
- [x] Добавить ночной крон (`0 3 * * *`) для `syncAllJiraTasks` в `scheduler.controller.ts`
- [x] Добавить скрытые дебаг-команды `/test_morning`, `/test_evening`, `/sync_all` в `telegram.update.ts`
