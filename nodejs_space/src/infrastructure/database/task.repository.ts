import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ITaskRepository } from '../../core/domain/interfaces/task-repository.interface';
import { TaskEntity } from '../../core/domain/entities/task.entity';

export interface CreateTaskDto {
  source: string;
  source_id?: string;
  title: string;
  description?: string;
  priority?: number;
  due_date?: Date;
  tags?: string[];
  jira_id?: string;
  jira_key?: string;
  ticktick_id?: string;
  estimated_minutes?: number;
  parent_id?: string;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  priority?: number;
  due_date?: Date;
  tags?: string[];
  status?: string;
  jira_id?: string;
  jira_key?: string;
  ticktick_id?: string;
  completed_at?: Date;
  estimated_minutes?: number;
  actual_minutes?: number;
  postponed_count?: number;
  parent_id?: string;
}

@Injectable()
export class TaskRepository implements ITaskRepository {
  private readonly logger = new Logger(TaskRepository.name);
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get all active tasks
   */
  async getAllTasks(status: string = 'active'): Promise<any[]> {
    try {
      return await this.prisma.tasks.findMany({
        where: { status },
        orderBy: [{ priority: 'desc' }, { due_date: 'asc' }],
      });
    } catch (error) {
      this.logger.error('Failed to get tasks:', error);
      throw error;
    }
  }

  /**
   * Get task by ID
   */
  async getTaskById(id: string): Promise<any | null> {
    try {
      return await this.prisma.tasks.findUnique({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Failed to get task ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get task by Jira ID
   */
  async getTaskByJiraId(jiraId: string): Promise<any | null> {
    try {
      return await this.prisma.tasks.findUnique({
        where: { jira_id: jiraId },
      });
    } catch (error) {
      this.logger.error(`Failed to get task by Jira ID ${jiraId}:`, error);
      throw error;
    }
  }

  /**
   * Get task by TickTick ID
   */
  async getTaskByTickTickId(ticktickId: string): Promise<any | null> {
    try {
      return await this.prisma.tasks.findUnique({
        where: { ticktick_id: ticktickId },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get task by TickTick ID ${ticktickId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Create new task
   */
  async createTask(data: CreateTaskDto): Promise<any> {
    try {
      this.logger.log(`Creating task: ${data.title}`);

      return await this.prisma.tasks.create({
        data: {
          source: data.source,
          source_id: data.source_id,
          title: data.title,
          description: data.description,
          priority: data.priority ?? 1,
          due_date: data.due_date,
          tags: data.tags ?? [],
          jira_id: data.jira_id,
          jira_key: data.jira_key,
          ticktick_id: data.ticktick_id,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create task:', error);
      throw error;
    }
  }

  /**
   * Update task
   */
  async updateTask(id: string, data: UpdateTaskDto): Promise<any> {
    try {
      this.logger.log(`Updating task: ${id}`);

      return await this.prisma.tasks.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update task ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update task by Jira ID
   */
  async updateTaskByJiraId(jiraId: string, data: UpdateTaskDto): Promise<any> {
    try {
      this.logger.log(`Updating task by Jira ID: ${jiraId}`);

      return await this.prisma.tasks.update({
        where: { jira_id: jiraId },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update task by Jira ID ${jiraId}:`, error);
      throw error;
    }
  }

  /**
   * Delete task (soft delete - mark as deleted)
   */
  async deleteTask(id: string): Promise<any> {
    try {
      this.logger.log(`Deleting task: ${id}`);

      return await this.prisma.tasks.update({
        where: { id },
        data: {
          status: 'deleted',
          updated_at: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to delete task ${id}:`, error);
      throw error;
    }
  }

  /**
   * Complete task
   */
  async completeTask(id: string): Promise<any> {
    try {
      this.logger.log(`Completing task: ${id}`);

      return await this.prisma.tasks.update({
        where: { id },
        data: {
          status: 'completed',
          completed_at: new Date(),
          updated_at: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to complete task ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get tasks by source
   */
  async getTasksBySource(
    source: string,
    status: string = 'active',
  ): Promise<any[]> {
    try {
      return await this.prisma.tasks.findMany({
        where: { source, status },
        orderBy: [{ priority: 'desc' }, { due_date: 'asc' }],
      });
    } catch (error) {
      this.logger.error(`Failed to get tasks by source ${source}:`, error);
      throw error;
    }
  }

  /**
   * Search tasks by title
   */
  async searchTasks(query: string, status: string = 'active'): Promise<any[]> {
    try {
      return await this.prisma.tasks.findMany({
        where: {
          status,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: [{ priority: 'desc' }, { due_date: 'asc' }],
      });
    } catch (error) {
      this.logger.error('Failed to search tasks:', error);
      throw error;
    }
  }

  /**
   * Get tasks by due date range
   */
  async getTasksByDueDateRange(
    startDate: Date,
    endDate: Date,
    status: string = 'active',
  ): Promise<any[]> {
    try {
      return await this.prisma.tasks.findMany({
        where: {
          status,
          due_date: {
            gte: startDate,
            lt: endDate,
          },
        },
        orderBy: [{ priority: 'desc' }, { due_date: 'asc' }],
      });
    } catch (error) {
      this.logger.error('Failed to get tasks by due date range:', error);
      throw error;
    }
  }

  /**
   * Get active tasks by due date range
   */
  async getActiveTasksByDueDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    return this.getTasksByDueDateRange(startDate, endDate, 'active');
  }

  /**
   * Get overdue tasks (due date < today, status = active)
   */
  async getOverdueTasks(today: Date): Promise<any[]> {
    try {
      return await this.prisma.tasks.findMany({
        where: {
          status: 'active',
          due_date: {
            lt: today,
          },
        },
        orderBy: [{ priority: 'desc' }, { due_date: 'asc' }],
      });
    } catch (error) {
      this.logger.error('Failed to get overdue tasks:', error);
      throw error;
    }
  }

  /**
   * Get task by Jira key (e.g., HOME-7)
   */
  async getTaskByJiraKey(jiraKey: string): Promise<any | null> {
    try {
      return await this.prisma.tasks.findFirst({
        where: { jira_key: jiraKey },
      });
    } catch (error) {
      this.logger.error(`Failed to get task by Jira key ${jiraKey}:`, error);
      throw error;
    }
  }

  /**
   * Get tasks with postponed_count > 0
   */
  async getPostponedTasks(status: string = 'active'): Promise<any[]> {
    try {
      return await this.prisma.tasks.findMany({
        where: {
          status,
          postponed_count: {
            gt: 0,
          },
        },
        orderBy: [{ postponed_count: 'desc' }, { priority: 'desc' }],
      });
    } catch (error) {
      this.logger.error('Failed to get postponed tasks:', error);
      throw error;
    }
  }
}
