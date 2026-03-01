import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { TaskService } from './task.service';
import { TickTickService } from './ticktick.service';
import { JiraService } from './jira.service';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private axiosInstance: AxiosInstance;
  private botToken: string;
  private schedulerService: any; // Will be injected later to avoid circular dependency

  constructor(
    private readonly taskService: TaskService,
    private readonly tickTickService: TickTickService,
    private readonly jiraService: JiraService,
  ) {
    this.initializeClient();
  }

  setSchedulerService(schedulerService: any) {
    this.schedulerService = schedulerService;
  }

  private initializeClient() {
    try {
      this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';

      if (!this.botToken) {
        throw new Error('Missing Telegram bot token in environment variables');
      }

      this.axiosInstance = axios.create({
        baseURL: `https://api.telegram.org/bot${this.botToken}`,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      this.logger.log('Telegram client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Telegram client:', error);
      throw error;
    }
  }

  async sendMessage(chatId: number, text: string, parseMode: string = 'Markdown') {
    try {
      await this.axiosInstance.post('/sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      });
    } catch (error) {
      this.logger.error('Failed to send Telegram message:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendMessageWithButtons(chatId: number, text: string, buttons: any[][], parseMode: string = 'Markdown') {
    try {
      await this.axiosInstance.post('/sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        reply_markup: {
          inline_keyboard: buttons,
        },
      });
    } catch (error) {
      this.logger.error('Failed to send message with buttons:', error.response?.data || error.message);
      throw error;
    }
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    try {
      await this.axiosInstance.post('/answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        text,
      });
    } catch (error) {
      this.logger.error('Failed to answer callback query:', error.response?.data || error.message);
    }
  }

  /**
   * Remove inline keyboard buttons from a message
   */
  async removeInlineKeyboard(chatId: number, messageId: number) {
    try {
      await this.axiosInstance.post('/editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: null,
      });
    } catch (error) {
      this.logger.error('Failed to remove inline keyboard:', error.response?.data || error.message);
    }
  }

  async handleStartCommand(chatId: number) {
    const welcomeMessage = `👋 *Добро пожаловать в AI Task Secretary 2.0!*

Я ваш умный помощник для управления задачами из Jira и TickTick.

*📋 Доступные команды:*
/start - показать это сообщение
/list - все активные задачи
/today - план на сегодня с оценкой времени
/postponed - задачи, которые откладывались

*🤖 Автоматические функции:*
🌅 *10:00* - утреннее планирование дня
🌙 *21:00* - вечерний чекап незакрытых задач
🔄 Синхронизация Jira ↔️ TickTick в реальном времени

Готов помочь вам быть более продуктивным! 🚀`;

    await this.sendMessage(chatId, welcomeMessage);
  }

  async handleListCommand(chatId: number) {
    try {
      // Get all active tasks from database
      const tasks = await this.taskService.getAllTasks('active');

      if (tasks.length === 0) {
        await this.sendMessage(chatId, '📋 У вас нет активных задач.');
        return;
      }

      const priorityNames: { [key: number]: string } = {
        5: '🔴 Срочно',
        3: '🟠 Высокий',
        1: '🟡 Средний',
        0: '⚪ Низкий',
      };

      const sourceEmojis: { [key: string]: string } = {
        'jira': '🔷',
        'ticktick': '✅',
        'telegram': '💬',
        'notion': '📝',
      };

      let message = `📋 *Ваши задачи (${tasks.length}):*\n\n`;

      tasks.slice(0, 20).forEach((task, index) => {
        const priority = priorityNames[task.priority || 0] || '⚪ Низкий';
        const sourceEmoji = sourceEmojis[task.source] || '📌';
        const dueDate = task.due_date ? `🗓 ${new Date(task.due_date).toLocaleDateString('ru-RU')}` : '';
        const tags = task.tags && task.tags.length > 0 ? `\n   Теги: ${task.tags.map(t => `#${t}`).join(' ')}` : '';

        message += `${index + 1}. ${sourceEmoji} *${task.title}*\n`;
        message += `   ${priority} ${dueDate}${tags}\n\n`;
      });

      if (tasks.length > 20) {
        message += `\n_... и еще ${tasks.length - 20} задач_`;
      }

      await this.sendMessage(chatId, message);
    } catch (error) {
      this.logger.error('Failed to handle /list command:', error);
      await this.sendMessage(chatId, '❌ Произошла ошибка при получении списка задач.');
    }
  }

  /**
   * Send capacity selection message for morning planning
   */
  async sendCapacitySelection(chatId: number) {
    const text = '🌅 *Доброе утро!* Как настрой на сегодня?';
    const buttons = [
      [
        { text: '💪 100% — 6 часов', callback_data: 'capacity_360' },
        { text: '😐 60% — ~3.5 часа', callback_data: 'capacity_216' },
        { text: '😴 30% — ~2 часа', callback_data: 'capacity_108' },
      ],
    ];
    await this.sendMessageWithButtons(chatId, text, buttons);
  }

  /**
   * Send evening checkup message with all incomplete tasks
   */
  async sendEveningCheckupMessage(chatId: number, tasks: Array<{ id: string; title: string; jiraKey?: string }>) {
    let text = '🌙 *Вечерний чекап:* вот задачи, которые сегодня остались незавершёнными:\n\n';
    
    tasks.forEach((task, index) => {
      const prefix = task.jiraKey ? `${task.jiraKey} — ` : '';
      text += `${index + 1}. ${prefix}${task.title}\n`;
    });
    
    text += '\nЧто делаем с ними?';
    
    const buttons = [
      [
        { text: '📅 Перенести все на завтра', callback_data: 'postpone_all' },
      ],
    ];
    
    await this.sendMessageWithButtons(chatId, text, buttons);
  }

  /**
   * Send frequently postponed task message
   */
  async sendFrequentlyPostponedTaskMessage(
    chatId: number,
    taskId: string,
    taskTitle: string,
    postponedCount: number,
    suggestion: string,
  ) {
    const text = `⚠️ *Задача переносится уже ${postponedCount} раз!*\n\n*Задача:* ${taskTitle}\n\n${suggestion}\n\nЧто делаем?`;
    const buttons = [
      [
        { text: '🗑 Закрыть как неактуальную', callback_data: `delete_${taskId}` },
        { text: '✂️ Разбить на подзадачи', callback_data: `split_${taskId}` },
      ],
      [{ text: '📅 Ещё раз перенести', callback_data: `postpone_${taskId}` }],
    ];
    await this.sendMessageWithButtons(chatId, text, buttons);
  }

  /**
   * Send Jira deletion confirmation message
   */
  async sendJiraDeletionConfirmation(chatId: number, taskId: string, jiraKey: string) {
    const text = `Задача *${jiraKey}* закрыта локально.\n\nЗакрыть её также в Jira?`;
    const buttons = [
      [
        { text: '✅ Да, закрыть в Jira', callback_data: `close_jira_${taskId}` },
        { text: '❌ Нет', callback_data: `skip_jira_${taskId}` },
      ],
    ];
    await this.sendMessageWithButtons(chatId, text, buttons);
  }

  /**
   * Handle /today command - show tasks for today
   */
  async handleTodayCommand(chatId: number) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayTasks = await this.taskService.getActiveTasksByDueDateRange(today, tomorrow);
      const overdueTasks = await this.taskService.getOverdueTasks(today);
      const allTasks = [...todayTasks, ...overdueTasks];

      if (allTasks.length === 0) {
        await this.sendMessage(chatId, '📋 На сегодня задач нет!');
        return;
      }

      let totalMinutes = 0;
      let message = `📋 *План на сегодня (${allTasks.length} задач):*\n\n`;

      allTasks.forEach((task, index) => {
        const priority = ['⚪', '🟡', '🟡', '🟠', '🟠', '🔴'][task.priority] || '⚪';
        const estimatedTime = task.estimated_minutes ? ` (~${task.estimated_minutes} мин)` : '';
        message += `${index + 1}. ${priority} *${task.title}*${estimatedTime}\n`;
        totalMinutes += task.estimated_minutes || 0;
      });

      if (totalMinutes > 0) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        message += `\n⏱ *Общее время:* ${hours > 0 ? `${hours}ч ` : ''}${minutes}мин`;
      }

      await this.sendMessage(chatId, message);
    } catch (error) {
      this.logger.error('Failed to handle /today command:', error);
      await this.sendMessage(chatId, '❌ Ошибка при получении задач на сегодня.');
    }
  }

  /**
   * Handle /postponed command - show postponed tasks
   */
  async handlePostponedCommand(chatId: number) {
    try {
      const postponedTasks = await this.taskService.getPostponedTasks('active');

      if (postponedTasks.length === 0) {
        await this.sendMessage(chatId, '✅ Нет отложенных задач!');
        return;
      }

      let message = `📤 *Отложенные задачи (${postponedTasks.length}):*\n\n`;

      postponedTasks.slice(0, 15).forEach((task, index) => {
        const priority = ['⚪', '🟡', '🟡', '🟠', '🟠', '🔴'][task.priority] || '⚪';
        const count = task.postponed_count;
        message += `${index + 1}. ${priority} *${task.title}*\n   📊 Перенесено: ${count} раз\n\n`;
      });

      if (postponedTasks.length > 15) {
        message += `\n_... и ещё ${postponedTasks.length - 15} задач_`;
      }

      await this.sendMessage(chatId, message);
    } catch (error) {
      this.logger.error('Failed to handle /postponed command:', error);
      await this.sendMessage(chatId, '❌ Ошибка при получении отложенных задач.');
    }
  }

  /**
   * Handle callback query from inline buttons
   */
  async handleCallbackQuery(callbackQuery: any) {
    try {
      const callbackData = callbackQuery.data;
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;
      const callbackQueryId = callbackQuery.id;

      this.logger.log(`Received callback: ${callbackData} from chat ${chatId}`);

      // Remove buttons immediately after any click
      await this.removeInlineKeyboard(chatId, messageId);

      // Handle capacity selection
      if (callbackData.startsWith('capacity_')) {
        const capacity = parseInt(callbackData.split('_')[1], 10);
        await this.answerCallbackQuery(callbackQueryId, `Выбрано: ${capacity} минут`);
        
        if (this.schedulerService) {
          await this.schedulerService.processMorningPlan(chatId, capacity);
        } else {
          await this.sendMessage(chatId, '❌ Ошибка: scheduler не инициализирован');
        }
        return;
      }

      // Handle postpone all tasks (evening checkup)
      if (callbackData === 'postpone_all') {
        await this.answerCallbackQuery(callbackQueryId, 'Переносим все задачи...');
        
        if (this.schedulerService) {
          await this.schedulerService.postponeAllIncompleteTasks(chatId);
        } else {
          await this.sendMessage(chatId, '❌ Ошибка: scheduler не инициализирован');
        }
        return;
      }

      // Handle task postponement (single task)
      if (callbackData.startsWith('postpone_')) {
        const taskId = callbackData.split('_')[1];
        await this.answerCallbackQuery(callbackQueryId, 'Переносим задачу...');
        
        const task = await this.taskService.getTaskById(taskId);
        
        if (task) {
          await this.postponeSingleTask(chatId, task);
        }
        return;
      }

      // Handle task deletion
      if (callbackData.startsWith('delete_')) {
        const taskId = callbackData.split('_')[1];
        const task = await this.taskService.getTaskById(taskId);
        
        if (task) {
          await this.taskService.deleteTask(taskId);
          await this.answerCallbackQuery(callbackQueryId, 'Задача закрыта');
          
          if (task.jira_id && task.jira_key) {
            await this.sendJiraDeletionConfirmation(chatId, taskId, task.jira_key);
          } else {
            await this.sendMessage(chatId, '🗑 Задача закрыта как неактуальная.');
          }
        }
        return;
      }

      // Handle split task request
      if (callbackData.startsWith('split_')) {
        const taskId = callbackData.split('_')[1];
        await this.answerCallbackQuery(callbackQueryId, 'Функция декомпозиции в разработке');
        await this.sendMessage(
          chatId,
          '✂️ Функция автоматической декомпозиции задач будет добавлена в следующей версии.\n\nПока вы можете создать подзадачи вручную в Jira.',
        );
        return;
      }

      // Handle Jira close confirmation
      if (callbackData.startsWith('close_jira_')) {
        await this.answerCallbackQuery(callbackQueryId, 'Будет закрыто в Jira');
        await this.sendMessage(chatId, '✅ Задача будет закрыта в Jira при следующей синхронизации.');
        // TODO: Implement Jira close API call
        return;
      }

      // Handle Jira close skip
      if (callbackData.startsWith('skip_jira_')) {
        await this.answerCallbackQuery(callbackQueryId, 'OK');
        await this.sendMessage(chatId, '👌 Хорошо, задача останется в Jira.');
        return;
      }

      await this.answerCallbackQuery(callbackQueryId);
    } catch (error) {
      this.logger.error('Failed to handle callback query:', error);
    }
  }

  async handleWebhook(update: any) {
    try {
      // Handle callback queries (button clicks)
      if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
        return;
      }

      // Handle regular messages
      const message = update.message;
      if (!message || !message.text) {
        return;
      }

      const chatId = message.chat.id;
      const text = message.text.trim();

      this.logger.log(`Received command: ${text} from chat ${chatId}`);

      if (text === '/start') {
        await this.handleStartCommand(chatId);
      } else if (text === '/list') {
        await this.handleListCommand(chatId);
      } else if (text === '/today') {
        await this.handleTodayCommand(chatId);
      } else if (text === '/postponed') {
        await this.handlePostponedCommand(chatId);
      } else {
        await this.sendMessage(chatId, 'Неизвестная команда. Используйте /start для списка доступных команд.');
      }
    } catch (error) {
      this.logger.error('Failed to handle webhook:', error);
    }
  }

  /**
   * Postpone single task to tomorrow and sync with TickTick and Jira
   */
  async postponeSingleTask(chatId: number, task: any) {
    try {
      const newDueDate = new Date(task.due_date || new Date());
      newDueDate.setDate(newDueDate.getDate() + 1);
      newDueDate.setHours(23, 59, 0, 0);

      // Update in database
      await this.taskService.updateTask(task.id, {
        due_date: newDueDate,
        postponed_count: task.postponed_count + 1,
      });

      // Update in TickTick if synced
      if (task.ticktick_id) {
        await this.tickTickService.updateTask(task.ticktick_id, {
          dueDate: this.formatTickTickDate(newDueDate),
        });
        this.logger.log(`Updated due date in TickTick: ${task.ticktick_id}`);
      }

      // Update in Jira if synced
      if (task.jira_key) {
        await this.updateJiraDueDate(task.jira_key, newDueDate);
        this.logger.log(`Updated due date in Jira: ${task.jira_key}`);
      }

      await this.sendMessage(
        chatId,
        `📅 Задача перенесена на завтра (${newDueDate.toLocaleDateString('ru-RU')})\nСчётчик переносов: ${task.postponed_count + 1}`,
      );
    } catch (error) {
      this.logger.error('Failed to postpone task:', error);
      await this.sendMessage(chatId, '❌ Ошибка при переносе задачи.');
    }
  }

  /**
   * Format date for TickTick API (23:59:00 in Kyiv timezone)
   */
  private formatTickTickDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T23:59:00+0200`;
  }

  /**
   * Update due date in Jira
   */
  private async updateJiraDueDate(jiraKey: string, dueDate: Date) {
    try {
      const year = dueDate.getFullYear();
      const month = String(dueDate.getMonth() + 1).padStart(2, '0');
      const day = String(dueDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;

      const domain = process.env.JIRA_DOMAIN || '';
      const email = process.env.JIRA_EMAIL || '';
      const apiToken = process.env.JIRA_API_TOKEN || '';

      await axios.put(
        `https://${domain}/rest/api/3/issue/${jiraKey}`,
        {
          fields: {
            duedate: formattedDate,
          },
        },
        {
          auth: {
            username: email,
            password: apiToken,
          },
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error) {
      this.logger.error(`Failed to update Jira due date for ${jiraKey}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send notification about new Jira task
   */
  async sendNewTaskNotification(chatId: number, jiraKey: string, title: string, estimatedMinutes: number) {
    try {
      const cleanTitle = this.getTaskTitleWithoutJiraKey(title);
      const message = `📥 *Новая задача из Jira: ${jiraKey}*\nНазвание: ${cleanTitle}\n⏱ Оценка времени: ${estimatedMinutes} минут (LLM)`;
      await this.sendMessage(chatId, message);
      this.logger.log(`Sent new task notification for ${jiraKey}`);
    } catch (error) {
      this.logger.error('Failed to send new task notification:', error);
    }
  }

  /**
   * Remove Jira key from task title (e.g., "[HOME-10] Task name" -> "Task name")
   */
  private getTaskTitleWithoutJiraKey(title: string): string {
    const match = title.match(/^\[([A-Z]+-\d+)\]\s*(.+)$/);
    return match ? match[2] : title;
  }

  async setWebhook(webhookUrl: string) {
    try {
      const response = await this.axiosInstance.post('/setWebhook', {
        url: webhookUrl,
      });

      this.logger.log(`Webhook set successfully: ${webhookUrl}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to set webhook:', error.response?.data || error.message);
      throw error;
    }
  }
}
