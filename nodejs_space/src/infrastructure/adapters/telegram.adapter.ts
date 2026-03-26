import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';
import { IMessagingAdapter } from '../../core/domain/interfaces/messaging-adapter.interface';
import { TASK_REPOSITORY } from '../../core/domain/interfaces/task-repository.interface';
import { formatTickTickDate } from '../utils/date.utils';
import type { ITaskRepository } from '../../core/domain/interfaces/task-repository.interface';
import { TICKTICK_ADAPTER } from '../../core/domain/interfaces/sync-adapter.interface';
import type { ISyncTargetAdapter } from '../../core/domain/interfaces/sync-adapter.interface';
import { JIRA_ADAPTER } from '../../core/domain/interfaces/sync-adapter.interface';
import type { ISyncSourceAdapter } from '../../core/domain/interfaces/sync-adapter.interface';

@Injectable()
export class TelegramAdapter implements IMessagingAdapter {
  private readonly logger = new Logger(TelegramAdapter.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    @Inject(TASK_REPOSITORY) private readonly taskService: ITaskRepository,
    @Inject(TICKTICK_ADAPTER) private readonly tickTickService: ISyncTargetAdapter,
    @Inject(JIRA_ADAPTER) private readonly jiraAdapter: ISyncSourceAdapter,
  ) { }

  async sendMessage(
    chatId: number,
    text: string,
    parseMode: string = 'Markdown',
  ) {
    try {
      await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: parseMode as any,
      });
    } catch (error: any) {
      this.logger.error(
        'Failed to send Telegram message:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async sendMessageWithButtons(
    chatId: number,
    text: string,
    buttons: any[][],
    parseMode: string = 'Markdown',
  ) {
    try {
      await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: parseMode as any,
        reply_markup: {
          inline_keyboard: buttons,
        },
      });
    } catch (error: any) {
      this.logger.error(
        'Failed to send message with buttons:',
        error.response?.data || error.message,
      );
      throw error;
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
  async sendEveningCheckupMessage(
    chatId: number,
    tasks: Array<{ id: string; title: string; jiraKey?: string }>,
  ) {
    let text =
      '🌙 *Вечерний чекап:* вот задачи, которые сегодня остались незавершёнными:\n\n';

    tasks.forEach((task, index) => {
      const prefix = task.jiraKey ? `${task.jiraKey} — ` : '';
      text += `${index + 1}. ${prefix}${task.title}\n`;
    });

    text += '\nЧто делаем с ними?';

    const buttons = [
      [{ text: '📅 Перенести все на завтра', callback_data: 'postpone_all' }],
    ];
    await this.sendMessageWithButtons(chatId, text, buttons);
  }

  /**
   * Send frequently postponed task message
   */
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
        { text: '✅ Завершил!', callback_data: `task_done_${taskId}` },
        { text: '🗑 Отменить везде', callback_data: `task_del_${taskId}` },
      ],
      [{ text: '📅 Снова на завтра (эх...)', callback_data: `task_postpone1_${taskId}` }],
    ];
    await this.sendMessageWithButtons(chatId, text, buttons);
  }

  /**
   * Postpone single task to tomorrow and sync with TickTick and Jira
   */
  async postponeSingleTask(chatId: number, task: any) {
    try {
      const newDueDate = new Date(task.due_date || new Date());
      newDueDate.setDate(newDueDate.getDate() + 1);
      newDueDate.setHours(23, 59, 0, 0);

      await this.taskService.updateTask(task.id, {
        due_date: newDueDate,
        postponed_count: task.postponed_count + 1,
      });

      if (task.ticktick_id) {
        await this.tickTickService.updateTask(task.ticktick_id, {
          dueDate: formatTickTickDate(newDueDate),
        });
        this.logger.log(`Updated due date in TickTick: ${task.ticktick_id}`);
      }

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
   * Complete single task and sync
   */
  async completeSingleTask(chatId: number, task: any) {
    try {
      await this.taskService.updateTask(task.id, { status: 'completed' });

      if (task.ticktick_id) {
        await this.tickTickService.updateTask(task.ticktick_id, { status: 2 });
        this.logger.log(`Completed in TickTick: ${task.ticktick_id}`);
      }

      if (task.jira_key) {
        await this.jiraAdapter.transitionToDone(task.jira_key);
        this.logger.log(`Completed in Jira: ${task.jira_key}`);
      }

      await this.sendMessage(chatId, `✅ Красавчик! Задача *${task.title}* закрыта везде.`);
    } catch (error) {
      this.logger.error('Failed to complete task:', error);
      await this.sendMessage(chatId, '❌ Ошибка при закрытии задачи.');
    }
  }

  /**
   * Delete/Cancel single task and sync
   */
  async deleteSingleTask(chatId: number, task: any) {
    try {
      await this.taskService.deleteTask(task.id);

      if (task.jira_key) {
        await this.jiraAdapter.transitionToCancelled(task.jira_key);
        this.logger.log(`Cancelled in Jira: ${task.jira_key}`);
      }

      await this.sendMessage(chatId, `🗑 Задача *${task.title}* отменена.`);
    } catch (error) {
      this.logger.error('Failed to delete task:', error);
      await this.sendMessage(chatId, '❌ Ошибка при отмене задачи.');
    }
  }

  private async updateJiraDueDate(jiraKey: string, dueDate: Date) {
    await this.jiraAdapter.updateDueDate(jiraKey, dueDate);
  }

  async sendNewTaskNotification(
    chatId: number,
    jiraKey: string,
    title: string,
    estimatedMinutes: number,
  ) {
    try {
      const cleanTitle = this.getTaskTitleWithoutJiraKey(title);
      const message = `📥 *Новая задача из Jira: ${jiraKey}*\nНазвание: ${cleanTitle}\n⏱ Оценка времени: ${estimatedMinutes} минут (LLM)`;
      await this.sendMessage(chatId, message);
      this.logger.log(`Sent new task notification for ${jiraKey}`);
    } catch (error) {
      this.logger.error('Failed to send new task notification:', error);
    }
  }

  private getTaskTitleWithoutJiraKey(title: string): string {
    const match = title.match(/^\[([A-Z]+-\d+)\]\s*(.+)$/);
    return match ? match[2] : title;
  }
}
