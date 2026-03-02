import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TaskService } from './task.service';
import { TelegramService } from './telegram.service';
import { LlmService } from './llm.service';
import { TickTickService } from './ticktick.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly targetChatId = 337519310; // Your Telegram chat ID

  constructor(
    private readonly taskService: TaskService,
    private readonly telegramService: TelegramService,
    private readonly llmService: LlmService,
    private readonly tickTickService: TickTickService,
  ) {}

  /**
   * Morning planning at 10:00 Europe/Kiev
   * Sends capacity selection buttons to user
   */
  @Cron('0 10 * * *', {
    name: 'morning-planning',
    timeZone: 'Europe/Kiev',
  })
  async handleMorningPlanning() {
    this.logger.log('Starting morning planning...');

    try {
      // Send capacity selection message with inline buttons
      await this.telegramService.sendCapacitySelection(this.targetChatId);
      this.logger.log('Morning planning capacity selection sent');
    } catch (error) {
      this.logger.error(
        `Error in morning planning: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Process morning plan after user selects capacity
   * Called from telegram.service when user clicks capacity button
   */
  async processMorningPlan(chatId: number, capacityMinutes: number) {
    this.logger.log(
      `Processing morning plan with capacity: ${capacityMinutes} minutes`,
    );

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get all tasks for today and overdue tasks
      const todayTasks = await this.taskService.getTasksByDueDateRange(
        today,
        tomorrow,
      );
      const overdueTasks = await this.taskService.getOverdueTasks(today);
      const allTasks = [...todayTasks, ...overdueTasks];

      if (allTasks.length === 0) {
        await this.telegramService.sendMessage(
          chatId,
          '🎉 На сегодня задач нет! Отличный день для отдыха.',
        );
        return;
      }

      // Calculate total estimated time
      let totalMinutes = 0;
      for (const task of allTasks) {
        if (!task.estimated_minutes) {
          // Estimate time using LLM if not set
          const estimated = await this.llmService.estimateTaskTime(
            task.title,
            task.description || '',
          );
          await this.taskService.updateTask(task.id, {
            estimated_minutes: estimated,
          });
          task.estimated_minutes = estimated;
        }
        totalMinutes += task.estimated_minutes || 0;
      }

      // If overloaded, postpone low-priority tasks
      const postponedTasks: Array<{ title: string; reason: string }> = [];
      let remainingTasks = [...allTasks];

      if (totalMinutes > capacityMinutes) {
        this.logger.log(
          `Overloaded: ${totalMinutes} > ${capacityMinutes} minutes. Postponing tasks...`,
        );

        // Sort by priority (ASC) and postponed_count (DESC)
        const sortedTasks = [...allTasks].sort((a, b) => {
          if (a.priority !== b.priority) {
            return a.priority - b.priority; // Lower priority first
          }
          return b.postponed_count - a.postponed_count; // More postponed first
        });

        let currentLoad = totalMinutes;
        remainingTasks = [];

        for (const task of sortedTasks) {
          if (currentLoad <= capacityMinutes) {
            remainingTasks.push(task);
          } else {
            // Postpone this task
            const reason = await this.llmService.generatePostponeReason(
              task.title,
              task.priority,
              task.postponed_count,
              capacityMinutes,
              totalMinutes,
            );

            postponedTasks.push({ title: task.title, reason });

            // Update due date to tomorrow
            const newDueDate = new Date(task.due_date || today);
            newDueDate.setDate(newDueDate.getDate() + 1);

            await this.taskService.updateTask(task.id, {
              due_date: newDueDate,
              postponed_count: task.postponed_count + 1,
            });

            // Update in TickTick if synced
            if (task.ticktick_id) {
              await this.tickTickService.updateTask(task.ticktick_id, {
                dueDate: this.formatTickTickDate(newDueDate),
              });
            }

            currentLoad -= task.estimated_minutes || 0;
          }
        }

        totalMinutes = currentLoad;
      }

      // Generate morning plan message with task details and LLM motivation
      let planMessage = `📋 *План на сегодня (емкость: ${this.getCapacityLabel(capacityMinutes)})*\n\n`;

      remainingTasks.forEach((task, index) => {
        const jiraKey = task.jira_key ? `${task.jira_key} — ` : '';
        const estimatedTime = task.estimated_minutes
          ? `${task.estimated_minutes} минут`
          : 'не оценено';
        planMessage += `${index + 1}. ${jiraKey}${this.getTaskTitleWithoutJiraKey(task.title)}\n`;
        planMessage += `   ⏱ Оценка: ${estimatedTime}\n\n`;
      });

      const totalHours = Math.floor(totalMinutes / 60);
      const totalMins = totalMinutes % 60;
      const totalTimeStr =
        totalHours > 0 ? `${totalHours}ч ${totalMins}мин` : `${totalMins}мин`;
      planMessage += `*Итого: ${totalTimeStr}*\n\n`;

      // Add postponed tasks section if any
      if (postponedTasks.length > 0) {
        planMessage += '⏭ *Перенесено на другой день:*\n';
        postponedTasks.forEach((postponed) => {
          planMessage += `- ${postponed.title}\n  _${postponed.reason}_\n`;
        });
        planMessage += '\n';
      }

      // Generate LLM motivational message
      const todayTasksSummary = remainingTasks.map((t) => ({
        title: this.getTaskTitleWithoutJiraKey(t.title),
        estimatedMinutes: t.estimated_minutes || 0,
        priority: t.priority,
      }));

      const llmMotivation = await this.llmService.generateMorningPlan(
        todayTasksSummary,
        postponedTasks,
        totalMinutes,
        capacityMinutes,
      );

      planMessage += llmMotivation;

      await this.telegramService.sendMessage(chatId, planMessage);
      this.logger.log('Morning plan sent successfully');
    } catch (error) {
      this.logger.error(
        `Error processing morning plan: ${error.message}`,
        error.stack,
      );
      await this.telegramService.sendMessage(
        chatId,
        '❌ Ошибка при формировании плана. Попробуйте позже.',
      );
    }
  }

  /**
   * Evening checkup at 21:00 Europe/Kiev
   * Check incomplete tasks and send reminders
   */
  @Cron('0 21 * * *', {
    name: 'evening-checkup',
    timeZone: 'Europe/Kiev',
  })
  async handleEveningCheckup() {
    this.logger.log('Starting evening checkup...');

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get all active tasks due today
      const incompleteTasks =
        await this.taskService.getActiveTasksByDueDateRange(today, tomorrow);

      if (incompleteTasks.length === 0) {
        await this.telegramService.sendMessage(
          this.targetChatId,
          '🎉 Все задачи на сегодня выполнены! Отличная работа!',
        );
        return;
      }

      this.logger.log(`Found ${incompleteTasks.length} incomplete tasks`);

      // Separate tasks into frequently postponed (>3 times) and regular
      const frequentlyPostponed = incompleteTasks.filter(
        (task) => task.postponed_count > 3,
      );
      const regularIncomplete = incompleteTasks.filter(
        (task) => task.postponed_count <= 3,
      );

      // Send single message for regular incomplete tasks
      if (regularIncomplete.length > 0) {
        const tasksForMessage = regularIncomplete.map((task) => ({
          id: task.id,
          title: this.getTaskTitleWithoutJiraKey(task.title),
          jiraKey: task.jira_key || undefined,
        }));

        await this.telegramService.sendEveningCheckupMessage(
          this.targetChatId,
          tasksForMessage,
        );
      }

      // Send individual messages for frequently postponed tasks (special handling)
      for (const task of frequentlyPostponed) {
        const suggestion =
          await this.llmService.generatePostponedTaskSuggestion(
            this.getTaskTitleWithoutJiraKey(task.title),
            task.postponed_count,
          );

        await this.telegramService.sendFrequentlyPostponedTaskMessage(
          this.targetChatId,
          task.id,
          this.getTaskTitleWithoutJiraKey(task.title),
          task.postponed_count,
          suggestion,
        );

        // Small delay to avoid flooding
        await this.sleep(500);
      }

      this.logger.log('Evening checkup completed');
    } catch (error) {
      this.logger.error(
        `Error in evening checkup: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Postpone all incomplete tasks to tomorrow
   * Called when user clicks "Перенести все на завтра" button
   */
  async postponeAllIncompleteTasks(chatId: number) {
    this.logger.log('Postponing all incomplete tasks to tomorrow...');

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get all active tasks due today
      const incompleteTasks =
        await this.taskService.getActiveTasksByDueDateRange(today, tomorrow);

      if (incompleteTasks.length === 0) {
        await this.telegramService.sendMessage(
          chatId,
          '✅ Нет незавершённых задач для переноса.',
        );
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const task of incompleteTasks) {
        try {
          const newDueDate = new Date(task.due_date || today);
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
          }

          // Update in Jira if synced
          if (task.jira_key) {
            await this.updateJiraDueDate(task.jira_key, newDueDate);
          }

          successCount++;
        } catch (error) {
          this.logger.error(`Failed to postpone task ${task.id}:`, error);
          errorCount++;
        }
      }

      const statusMessage =
        errorCount > 0
          ? `📅 Перенесено задач: ${successCount}\n⚠️ Ошибок: ${errorCount}\n\nСчётчик переносов обновлён.`
          : `📅 Все ${successCount} незавершённые задачи перенесены на завтра.\nСчётчик переносов обновлён.`;

      await this.telegramService.sendMessage(chatId, statusMessage);
      this.logger.log(`Postponed ${successCount} tasks, ${errorCount} errors`);
    } catch (error) {
      this.logger.error(
        `Error postponing all tasks: ${error.message}`,
        error.stack,
      );
      await this.telegramService.sendMessage(
        chatId,
        '❌ Ошибка при переносе задач.',
      );
    }
  }

  /**
   * Format date for TickTick API (23:59:00 in Kyiv timezone)
   */
  private formatTickTickDate(date: Date): string {
    const kyivDate = new Date(date);
    kyivDate.setHours(23, 59, 0, 0);
    return kyivDate.toISOString().slice(0, 19) + '+0200';
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get capacity label for display
   */
  private getCapacityLabel(capacityMinutes: number): string {
    if (capacityMinutes === 360) return '💪 100%';
    if (capacityMinutes === 216) return '😐 60%';
    if (capacityMinutes === 108) return '😴 30%';

    const hours = Math.floor(capacityMinutes / 60);
    const minutes = capacityMinutes % 60;
    return hours > 0 ? `${hours}ч ${minutes}мин` : `${minutes}мин`;
  }

  /**
   * Remove Jira key from task title (e.g., "[HOME-10] Task name" -> "Task name")
   */
  private getTaskTitleWithoutJiraKey(title: string): string {
    // Match pattern like "[KEY-123] Title" and extract just the title
    const match = title.match(/^\[([A-Z]+-\d+)\]\s*(.+)$/);
    return match ? match[2] : title;
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

      const axios = require('axios');
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
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(
        `Updated Jira due date for ${jiraKey} to ${formattedDate}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update Jira due date for ${jiraKey}:`,
        error.response?.data || error.message,
      );
      throw error;
    }
  }
}
