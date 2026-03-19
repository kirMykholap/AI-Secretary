import {
  Update,
  Start,
  Command,
  Action,
  Ctx,
  InjectBot,
} from 'nestjs-telegraf';
import { Telegraf, Context, Markup } from 'telegraf';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { TASK_REPOSITORY } from '../../core/domain/interfaces/task-repository.interface';
import type { ITaskRepository } from '../../core/domain/interfaces/task-repository.interface';
import { PlanningOrchestrator } from '../../core/application/orchestrators/planning.orchestrator';
import { TelegramAdapter } from '../../infrastructure/adapters/telegram.adapter';
import { FileLogger } from '../../infrastructure/logger/file.logger';

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);

  constructor(
    @InjectBot() private bot: Telegraf<Context>,
    @Inject(TASK_REPOSITORY) private readonly taskService: ITaskRepository,
    @Inject(forwardRef(() => PlanningOrchestrator))
    private readonly schedulerService: PlanningOrchestrator,
    private readonly telegramService: TelegramAdapter,
  ) { }

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const welcomeMessage = `👋 *Добро пожаловать в AI Task Secretary 2.0!*\n\nЯ ваш умный помощник для управления задачами из Jira и TickTick.\n\n*📋 Доступные команды:*\n/start - показать это сообщение\n/list - все активные задачи\n/today - план на сегодня с оценкой времени\n/postponed - задачи, которые откладывались\n\n*🤖 Автоматические функции:*\n🌅 *10:00* - утреннее планирование дня\n🌙 *21:00* - вечерний чекап незакрытых задач\n🔄 Синхронизация Jira ↔️ TickTick в реальном времени\n\nГотов помочь вам быть более продуктивным! 🚀`;
    await ctx.replyWithMarkdown(welcomeMessage);
  }

  @Command('list')
  async onList(@Ctx() ctx: Context) {
    try {
      const tasks = await this.taskService.getAllTasks('active');
      if (tasks.length === 0) {
        await ctx.reply('📋 У вас нет активных задач.');
        return;
      }

      const priorityNames: { [key: number]: string } = {
        5: '🔴 Срочно',
        3: '🟠 Высокий',
        1: '🟡 Средний',
        0: '⚪ Низкий',
      };
      const sourceEmojis: { [key: string]: string } = {
        jira: '🔷',
        ticktick: '✅',
        telegram: '💬',
        notion: '📝',
      };

      let message = `📋 *Ваши задачи (${tasks.length}):*\n\n`;
      tasks.slice(0, 20).forEach((task, index) => {
        const priority = priorityNames[task.priority || 0] || '⚪ Низкий';
        const sourceEmoji = sourceEmojis[task.source] || '📌';
        const dueDate = task.due_date
          ? `🗓 ${new Date(task.due_date).toLocaleDateString('ru-RU')}`
          : '';
        const tags = task.tags?.length
          ? `\n   Теги: ${task.tags.map((t) => `#${t}`).join(' ')}`
          : '';
        message += `${index + 1}. ${sourceEmoji} *${task.title}*\n   ${priority} ${dueDate}${tags}\n\n`;
      });

      if (tasks.length > 20)
        message += `\n_... и еще ${tasks.length - 20} задач_`;
      await ctx.replyWithMarkdown(message);
    } catch (error) {
      this.logger.error('Failed to handle /list command:', error);
      await ctx.reply('❌ Произошла ошибка при получении списка задач.');
    }
  }

  @Command('logs')
  async onLogs(@Ctx() ctx: Context) {
    const logs = FileLogger.getLastLogs(30);
    const text = `📜 *Последние 30 строк логов:*\n\n\`\`\`\n${logs}\n\`\`\``;
    try {
      if (text.length > 4000) {
        await ctx.replyWithMarkdown(`📜 Логи слишком длинные, обрезаю...\n\n\`\`\`\n${text.slice(-3800)}\n\`\`\``);
      } else {
        await ctx.replyWithMarkdown(text);
      }
    } catch (e) {
      this.logger.error('Failed to send logs', e);
      await ctx.reply('❌ Ошибка при отправке логов.');
    }
  }

  private async sendDashboard(ctx: Context, page: number = 0) {
    const tasks = await this.taskService.getAllTasks('active');
    const pageSize = 7;
    const totalPages = Math.ceil(tasks.length / pageSize) || 1;
    const currentPage = Math.min(page, totalPages - 1);
    const startIdx = currentPage * pageSize;
    const pageTasks = tasks.slice(startIdx, startIdx + pageSize);

    let text = `🎛 *Панель управления задачами*\n`;
    text += `Всего активных: ${tasks.length}\n`;

    if (tasks.length === 0) {
      text += `\nУ вас нет актуальных задач! Отдыхайте ☕️`;
      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'Markdown' }).catch(() => {});
      } else {
        await ctx.replyWithMarkdown(text);
      }
      return;
    }

    const buttons = [];
    for (const task of pageTasks) {
      const priority = ['⚪','🟡','🟡','🟠','🟠','🔴'][task.priority || 0] || '⚪';
      const shortTitle = task.title.length > 28 ? task.title.substring(0, 28) + '...' : task.title;
      buttons.push([Markup.button.callback(`${priority} ${shortTitle}`, `task_open_${task.id}`)]);
    }

    const navRow = [];
    if (currentPage > 0) {
      navRow.push(Markup.button.callback('⬅️ Назад', `dash_page_${currentPage - 1}`));
    }
    navRow.push(Markup.button.callback(`Стр. ${currentPage + 1}/${totalPages}`, `ignore`));
    if (currentPage < totalPages - 1) {
      navRow.push(Markup.button.callback('Вперед ➡️', `dash_page_${currentPage + 1}`));
    }
    buttons.push(navRow);
    buttons.push([Markup.button.callback('🔄 Обновить', `dash_page_${currentPage}`)]);

    const keyboard = Markup.inlineKeyboard(buttons);

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard.reply_markup });
      } catch (e) {
        // message is exactly the same, ignore Error: Bad Request: message is not modified
      }
    } else {
      await ctx.replyWithMarkdown(text, keyboard);
    }
  }

  @Command('dashboard')
  async onDashboard(@Ctx() ctx: Context) {
    await this.sendDashboard(ctx, 0);
  }

  @Action(/^dash_page_(\d+)$/)
  async onDashPage(@Ctx() ctx: Context) {
    const page = parseInt((ctx as any).match[1], 10);
    await ctx.answerCbQuery();
    await this.sendDashboard(ctx, page);
  }

  @Action(/^task_open_(.+)$/)
  async onTaskOpen(@Ctx() ctx: Context) {
    const taskId = (ctx as any).match[1];
    const task = await this.taskService.getTaskById(taskId);
    
    if (!task) {
      await ctx.answerCbQuery('Задача не найдена или уже удалена 🗑');
      await this.sendDashboard(ctx, 0);
      return;
    }

    const priority = ['⚪ Никакой','🟡 Низкий','🟡 Низкий','🟠 Средний','🟠 Средний','🔴 Высокий'][task.priority || 0] || '⚪ Никакой';
    const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString('ru-RU') : 'Нет дедлайна';
    
    let text = `📋 *${task.title}*\n\n`;
    text += `🔥 Приоритет: ${priority}\n`;
    text += `🗓 Дедлайн: ${dueDate}\n`;
    if (task.estimated_minutes) text += `⏱ Оценка: ${task.estimated_minutes} мин\n`;
    if (task.tags && task.tags.length > 0) text += `🏷 Теги: ${task.tags.map(t => '#' + t).join(' ')}\n`;
    
    const buttons = [
      [Markup.button.callback('✅ Выполнить', `task_done_${task.id}`)],
      [Markup.button.callback('🕒 Перенести на завтра', `task_postpone1_${task.id}`)],
      [Markup.button.callback('🗑 Удалить / Отменить', `task_del_${task.id}`)],
      [Markup.button.callback('🔙 Назад к списку', `dash_page_0`)]
    ];

    await ctx.answerCbQuery();
    await ctx.editMessageText(text, { 
      parse_mode: 'Markdown', 
      reply_markup: Markup.inlineKeyboard(buttons).reply_markup 
    }).catch(() => {});
  }

  @Action(/^task_done_(.+)$/)
  async onTaskDone(@Ctx() ctx: Context) {
    const taskId = (ctx as any).match[1];
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    await ctx.answerCbQuery('Идет закрытие...');
    await ctx.editMessageReplyMarkup(undefined);

    const task = await this.taskService.getTaskById(taskId);
    if (task) {
      await this.telegramService.completeSingleTask(chatId, task);
      await this.sendDashboard(ctx, 0);
    }
  }

  @Action(/^task_postpone1_(.+)$/)
  async onTaskPostpone1(@Ctx() ctx: Context) {
    const taskId = (ctx as any).match[1];
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    await ctx.answerCbQuery('Переносим на завтра...');
    await ctx.editMessageReplyMarkup(undefined);

    const task = await this.taskService.getTaskById(taskId);
    if (task) {
      await this.telegramService.postponeSingleTask(chatId, task);
      await this.sendDashboard(ctx, 0);
    }
  }

  @Action(/^task_del_(.+)$/)
  async onTaskDel(@Ctx() ctx: Context) {
    const taskId = (ctx as any).match[1];
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    await ctx.answerCbQuery('Удаляем задачу...');
    await ctx.editMessageReplyMarkup(undefined);

    const task = await this.taskService.getTaskById(taskId);
    if (task) {
      await this.telegramService.deleteSingleTask(chatId, task);
      await this.sendDashboard(ctx, 0);
    }
  }

  @Command('today')
  async onToday(@Ctx() ctx: Context) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayTasks = await this.taskService.getActiveTasksByDueDateRange(
        today,
        tomorrow,
      );
      const overdueTasks = await this.taskService.getOverdueTasks(today);
      const allTasks = [...todayTasks, ...overdueTasks];

      if (allTasks.length === 0) {
        await ctx.reply('📋 На сегодня задач нет!');
        return;
      }

      let totalMinutes = 0;
      let message = `📋 *План на сегодня (${allTasks.length} задач):*\n\n`;
      allTasks.forEach((task, index) => {
        const priority =
          ['⚪', '🟡', '🟡', '🟠', '🟠', '🔴'][task.priority] || '⚪';
        const estimatedTime = task.estimated_minutes
          ? ` (~${task.estimated_minutes} мин)`
          : '';
        message += `${index + 1}. ${priority} *${task.title}*${estimatedTime}\n`;
        totalMinutes += task.estimated_minutes || 0;
      });

      if (totalMinutes > 0) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        message += `\n⏱ *Общее время:* ${hours > 0 ? `${hours}ч ` : ''}${minutes}мин`;
      }
      await ctx.replyWithMarkdown(message);
    } catch (error) {
      this.logger.error('Failed to handle /today command:', error);
      await ctx.reply('❌ Ошибка при получении задач на сегодня.');
    }
  }

  @Command('postponed')
  async onPostponed(@Ctx() ctx: Context) {
    try {
      const postponedTasks = await this.taskService.getPostponedTasks('active');
      if (postponedTasks.length === 0) {
        await ctx.reply('✅ Нет отложенных задач!');
        return;
      }

      let message = `📤 *Отложенные задачи (${postponedTasks.length}):*\n\n`;
      postponedTasks.slice(0, 15).forEach((task, index) => {
        const priority =
          ['⚪', '🟡', '🟡', '🟠', '🟠', '🔴'][task.priority] || '⚪';
        message += `${index + 1}. ${priority} *${task.title}*\n   📊 Перенесено: ${task.postponed_count} раз\n\n`;
      });

      if (postponedTasks.length > 15)
        message += `\n_... и ещё ${postponedTasks.length - 15} задач_`;
      await ctx.replyWithMarkdown(message);
    } catch (error) {
      this.logger.error('Failed to handle /postponed command:', error);
      await ctx.reply('❌ Ошибка при получении отложенных задач.');
    }
  }

  // --- ACTIONS (Inline Buttons) ---

  @Action(/^capacity_(\d+)$/)
  async onCapacitySelection(@Ctx() ctx: Context) {
    const match = (ctx as any).match;
    const capacity = parseInt(match[1], 10);
    const chatId = ctx.chat?.id;

    if (!chatId) return;

    await ctx.answerCbQuery(`Выбрано: ${capacity} минут`);
    await ctx.editMessageReplyMarkup(undefined);

    await this.schedulerService.processMorningPlan(chatId, capacity);
  }

  @Action('postpone_all')
  async onPostponeAll(@Ctx() ctx: Context) {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    await ctx.answerCbQuery('Переносим все задачи...');
    await ctx.editMessageReplyMarkup(undefined);
    await this.schedulerService.postponeAllIncompleteTasks(chatId);
  }

  @Action(/^postpone_(.+)$/)
  async onPostponeTask(@Ctx() ctx: Context) {
    const taskId = (ctx as any).match[1];
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    await ctx.answerCbQuery('Переносим задачу...');
    await ctx.editMessageReplyMarkup(undefined);

    const task = await this.taskService.getTaskById(taskId);
    if (task) {
      await this.telegramService.postponeSingleTask(chatId, task);
    }
  }

  @Action(/^delete_(.+)$/)
  async onDeleteTask(@Ctx() ctx: Context) {
    const taskId = (ctx as any).match[1];
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const task = await this.taskService.getTaskById(taskId);
    if (task) {
      await ctx.answerCbQuery('Задача закрыта');
      await ctx.editMessageReplyMarkup(undefined);
      await this.taskService.deleteTask(taskId);

      if (task.jira_id && task.jira_key) {
        await this.telegramService.sendJiraDeletionConfirmation(
          chatId,
          taskId,
          task.jira_key,
        );
      } else {
        await ctx.reply('🗑 Задача закрыта как неактуальная.');
      }
    }
  }

  @Action(/^split_(.+)$/)
  async onSplitTask(@Ctx() ctx: Context) {
    await ctx.answerCbQuery('Функция декомпозиции в разработке');
    await ctx.editMessageReplyMarkup(undefined);
    await ctx.reply(
      '✂️ Функция автоматической декомпозиции задач будет добавлена в следующей версии.\n\nПока вы можете создать подзадачи вручную в Jira.',
    );
  }

  @Action(/^close_jira_(.+)$/)
  async onCloseJira(@Ctx() ctx: Context) {
    await ctx.answerCbQuery('Будет закрыто в Jira');
    await ctx.editMessageReplyMarkup(undefined);
    await ctx.reply(
      '✅ Задача будет закрыта в Jira при следующей синхронизации.',
    );
  }

  @Action(/^skip_jira_(.+)$/)
  async onSkipJira(@Ctx() ctx: Context) {
    await ctx.answerCbQuery('OK');
    await ctx.editMessageReplyMarkup(undefined);
    await ctx.reply('👌 Хорошо, задача останется в Jira.');
  }
}
