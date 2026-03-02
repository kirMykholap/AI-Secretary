import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { TickTickTask } from './types';

@Injectable()
export class TickTickService {
  private readonly logger = new Logger(TickTickService.name);
  private axiosInstance: AxiosInstance;
  private jiraProjectId: string | null = null;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    try {
      const accessToken = process.env.TICKTICK_ACCESS_TOKEN;

      if (!accessToken) {
        this.logger.warn('Missing TickTick access token in environment variables. TickTick integration will be disabled.');
        return;
      }

      this.axiosInstance = axios.create({
        baseURL: 'https://api.ticktick.com/open/v1',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      this.logger.log('TickTick client initialized successfully');

      // Initialize Jira project asynchronously
      this.ensureJiraProject().catch((err) => {
        this.logger.error('Failed to ensure Jira project:', err);
      });
    } catch (error) {
      this.logger.error('Failed to initialize TickTick client:', error);
      throw error;
    }
  }

  /**
   * Get or create "Jira" project for synced tasks
   */
  private async ensureJiraProject(): Promise<string> {
    if (this.jiraProjectId !== null) {
      return this.jiraProjectId;
    }

    try {
      // Get all projects
      const response = await this.axiosInstance.get('/project');
      const projects = response.data || [];

      // Find existing Jira project
      const jiraProject = projects.find((p: any) => p.name === 'Jira');

      if (jiraProject) {
        this.jiraProjectId = jiraProject.id;
        this.logger.log(`Found existing Jira project: ${this.jiraProjectId}`);
        return jiraProject.id;
      }

      // Create new Jira project
      const createResponse = await this.axiosInstance.post('/project', {
        name: 'Jira',
        color: '#3B82F6', // Blue color
      });

      this.jiraProjectId = createResponse.data.id;
      this.logger.log(`Created new Jira project: ${this.jiraProjectId}`);
      return createResponse.data.id;
    } catch (error) {
      this.logger.error(
        'Failed to ensure Jira project:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async getAllTasks(): Promise<TickTickTask[]> {
    try {
      this.logger.log('Fetching all tasks from TickTick');

      // First, get all projects
      const projectsResponse = await this.axiosInstance.get('/project');
      const projects = projectsResponse.data || [];

      this.logger.log(`Found ${projects.length} projects`);

      // Then, fetch tasks from each project
      const allTasks: TickTickTask[] = [];

      for (const project of projects) {
        try {
          const projectDataResponse = await this.axiosInstance.get(
            `/project/${project.id}/data`,
          );
          const projectTasks = projectDataResponse.data?.tasks || [];
          allTasks.push(...projectTasks);
          this.logger.log(
            `Fetched ${projectTasks.length} tasks from project: ${project.name}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to fetch tasks from project ${project.id}:`,
            error.response?.data || error.message,
          );
        }
      }

      this.logger.log(`Fetched ${allTasks.length} total tasks from TickTick`);
      return allTasks;
    } catch (error) {
      this.logger.error(
        'Failed to fetch TickTick tasks:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async createTask(task: TickTickTask): Promise<TickTickTask> {
    try {
      this.logger.log(`Creating task in TickTick: ${task.title}`);

      // Ensure Jira project exists and add projectId
      const projectId = await this.ensureJiraProject();
      const taskWithProject = {
        ...task,
        projectId,
      };

      this.logger.debug(`Task payload: ${JSON.stringify(taskWithProject)}`);

      const response = await this.axiosInstance.post('/task', taskWithProject);

      this.logger.log(
        `Created task with ID: ${response.data.id} in project ${projectId}`,
      );
      this.logger.debug(`Response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        'Failed to create TickTick task:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async updateTask(
    taskId: string,
    task: Partial<TickTickTask>,
  ): Promise<TickTickTask> {
    try {
      this.logger.log(`Updating task in TickTick: ${taskId}`);
      this.logger.debug(`Update payload: ${JSON.stringify(task)}`);

      const response = await this.axiosInstance.post(`/task/${taskId}`, task);

      this.logger.log(`Updated task: ${taskId}`);
      this.logger.debug(`Response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        'Failed to update TickTick task:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async getTaskById(taskId: string): Promise<TickTickTask | null> {
    try {
      const response = await this.axiosInstance.get(`/task/${taskId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      this.logger.error(
        'Failed to fetch TickTick task:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }
}
