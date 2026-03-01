import { Injectable, Logger } from '@nestjs/common';
import { JiraService } from './jira.service';
import { TickTickService } from './ticktick.service';
import { TaskService, CreateTaskDto, UpdateTaskDto } from './task.service';
import { LlmService } from './llm.service';
import { TelegramService } from './telegram.service';
import { JiraTask } from './types';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly targetChatId = 337519310; // Your Telegram chat ID

  constructor(
    private readonly jiraService: JiraService,
    private readonly tickTickService: TickTickService,
    private readonly taskService: TaskService,
    private readonly llmService: LlmService,
    private readonly telegramService: TelegramService,
  ) {}

  /**
   * Map Jira priority to our priority system
   * Jira: Highest, High, Medium, Low, Lowest
   * Our system: 5 (urgent), 3 (high), 1 (medium), 0 (low/none)
   */
  private mapPriority(jiraPriority?: string): number {
    if (!jiraPriority) return 1;
    
    const priorityMap: { [key: string]: number } = {
      'Highest': 5,
      'High': 3,
      'Medium': 1,
      'Low': 0,
      'Lowest': 0,
    };

    return priorityMap[jiraPriority] ?? 1;
  }

  /**
   * Extract text from Jira description (handles both string and ADF format)
   */
  private extractDescription(description: any): string {
    if (!description) return '';
    
    // If it's already a string, return it
    if (typeof description === 'string') return description;
    
    // If it's Atlassian Document Format (ADF), extract text
    if (typeof description === 'object' && description.content) {
      return this.extractTextFromADF(description);
    }
    
    return '';
  }

  /**
   * Extract plain text from Atlassian Document Format (ADF)
   */
  private extractTextFromADF(adf: any): string {
    if (!adf || !adf.content) return '';
    
    let text = '';
    
    const extractFromNode = (node: any): string => {
      if (!node) return '';
      
      // If it's a text node, return the text
      if (node.type === 'text' && node.text) {
        return node.text;
      }
      
      // If it has content, recursively extract
      if (node.content && Array.isArray(node.content)) {
        return node.content.map(extractFromNode).join(' ');
      }
      
      return '';
    };
    
    text = adf.content.map(extractFromNode).join('\n');
    return text.trim();
  }

  /**
   * Get due date - if Jira has due date, use it; otherwise set to today end of day
   */
  private getDueDate(jiraDueDate?: string): Date {
    if (jiraDueDate) {
      // Jira provides date in YYYY-MM-DD format
      const date = new Date(jiraDueDate);
      date.setHours(23, 59, 0, 0);
      return date;
    } else {
      // Set to today end of day
      const date = new Date();
      date.setHours(23, 59, 0, 0);
      return date;
    }
  }

  /**
   * Format date for TickTick API (Kyiv timezone UTC+2)
   */
  private formatTickTickDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+0200`;
  }

  /**
   * Sync single Jira task to database and TickTick
   */
  async syncSingleJiraTask(jiraIssueId: string): Promise<void> {
    try {
      this.logger.log(`Syncing single Jira task: ${jiraIssueId}`);
      
      // Get Jira task details
      const jiraTask = await this.jiraService.getTaskById(jiraIssueId);
      
      if (!jiraTask) {
        this.logger.error(`Jira task not found: ${jiraIssueId}`);
        return;
      }

      // Check if task already exists in database
      const existingTask = await this.taskService.getTaskByJiraId(jiraTask.id);

      const priority = this.mapPriority(jiraTask.fields.priority?.name);
      const dueDate = this.getDueDate(jiraTask.fields.duedate);
      const title = `[${jiraTask.key}] ${jiraTask.fields.summary}`;
      const description = this.extractDescription(jiraTask.fields.description);

      if (existingTask) {
        // Update existing task in database
        this.logger.log(`Updating existing task in DB: ${existingTask.id}`);
        
        const updatedTask = await this.taskService.updateTask(existingTask.id, {
          title,
          description,
          priority,
          due_date: dueDate,
          jira_key: jiraTask.key,
        });

        // Sync to TickTick
        if (updatedTask.ticktick_id) {
          await this.tickTickService.updateTask(updatedTask.ticktick_id, {
            title,
            content: description,
            priority,
            dueDate: this.formatTickTickDate(dueDate),
            tags: ['jira'],
          });
          this.logger.log(`Updated task in TickTick: ${updatedTask.ticktick_id}`);
        } else {
          // Create in TickTick if doesn't exist
          const ticktickTask = await this.tickTickService.createTask({
            title,
            content: description,
            priority,
            dueDate: this.formatTickTickDate(dueDate),
            tags: ['jira'],
          });
          
          // Update task with TickTick ID
          await this.taskService.updateTask(updatedTask.id, {
            ticktick_id: ticktickTask.id,
          });
          
          this.logger.log(`Created task in TickTick: ${ticktickTask.id}`);
        }
      } else {
        // Create new task in database
        this.logger.log(`Creating new task in DB for Jira: ${jiraTask.key}`);
        
        const newTask = await this.taskService.createTask({
          source: 'jira',
          source_id: jiraTask.id,
          title,
          description,
          priority,
          due_date: dueDate,
          tags: ['jira'],
          jira_id: jiraTask.id,
          jira_key: jiraTask.key,
        });

        // Estimate time using LLM if not set
        let estimatedMinutes = 0;
        try {
          estimatedMinutes = await this.llmService.estimateTaskTime(title, description);
          await this.taskService.updateTask(newTask.id, { estimated_minutes: estimatedMinutes });
          this.logger.log(`Estimated ${estimatedMinutes} minutes for task ${jiraTask.key}`);
        } catch (error) {
          this.logger.warn(`Failed to estimate time for task ${jiraTask.key}: ${error.message}`);
        }

        // Create in TickTick
        const ticktickTask = await this.tickTickService.createTask({
          title,
          content: description,
          priority,
          dueDate: this.formatTickTickDate(dueDate),
          tags: ['jira'],
        });

        // Update task with TickTick ID
        await this.taskService.updateTask(newTask.id, {
          ticktick_id: ticktickTask.id,
        });

        this.logger.log(`Created new task: DB=${newTask.id}, TickTick=${ticktickTask.id}`);
        
        // Send Telegram notification about new task
        try {
          await this.telegramService.sendNewTaskNotification(
            this.targetChatId,
            jiraTask.key,
            title,
            estimatedMinutes,
          );
        } catch (error) {
          this.logger.warn(`Failed to send Telegram notification for ${jiraTask.key}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to sync Jira task ${jiraIssueId}:`, error);
      throw error;
    }
  }

  /**
   * Sync all Jira tasks assigned to user
   */
  async syncAllJiraTasks(): Promise<{ created: number; updated: number; errors: number }> {
    const stats = { created: 0, updated: 0, errors: 0 };

    try {
      this.logger.log('Starting full Jira sync...');
      
      // Get all Jira tasks
      const jiraTasks = await this.jiraService.getAssignedTasks();
      this.logger.log(`Found ${jiraTasks.length} Jira tasks`);

      for (const jiraTask of jiraTasks) {
        try {
          // Check if task exists in DB
          const existingTask = await this.taskService.getTaskByJiraId(jiraTask.id);

          const priority = this.mapPriority(jiraTask.fields.priority?.name);
          const dueDate = this.getDueDate(jiraTask.fields.duedate);
          const title = `[${jiraTask.key}] ${jiraTask.fields.summary}`;
          const description = this.extractDescription(jiraTask.fields.description);

          if (existingTask) {
            // Update existing task
            const updatedTask = await this.taskService.updateTask(existingTask.id, {
              title,
              description,
              priority,
              due_date: dueDate,
              jira_key: jiraTask.key,
            });

            // Sync to TickTick
            if (updatedTask.ticktick_id) {
              await this.tickTickService.updateTask(updatedTask.ticktick_id, {
                title,
                content: description,
                priority,
                dueDate: this.formatTickTickDate(dueDate),
                tags: ['jira'],
              });
            } else {
              // Create in TickTick if doesn't exist
              const ticktickTask = await this.tickTickService.createTask({
                title,
                content: description,
                priority,
                dueDate: this.formatTickTickDate(dueDate),
                tags: ['jira'],
              });
              
              await this.taskService.updateTask(updatedTask.id, {
                ticktick_id: ticktickTask.id,
              });
            }

            stats.updated++;
          } else {
            // Create new task
            const newTask = await this.taskService.createTask({
              source: 'jira',
              source_id: jiraTask.id,
              title,
              description,
              priority,
              due_date: dueDate,
              tags: ['jira'],
              jira_id: jiraTask.id,
              jira_key: jiraTask.key,
            });

            // Create in TickTick
            const ticktickTask = await this.tickTickService.createTask({
              title,
              content: description,
              priority,
              dueDate: this.formatTickTickDate(dueDate),
              tags: ['jira'],
            });

            // Update task with TickTick ID
            await this.taskService.updateTask(newTask.id, {
              ticktick_id: ticktickTask.id,
            });

            stats.created++;
          }
        } catch (error) {
          this.logger.error(`Failed to sync Jira task ${jiraTask.key}:`, error);
          stats.errors++;
        }
      }

      this.logger.log(`Sync completed: ${stats.created} created, ${stats.updated} updated, ${stats.errors} errors`);
      return stats;
    } catch (error) {
      this.logger.error('Failed to sync Jira tasks:', error);
      throw error;
    }
  }
}
