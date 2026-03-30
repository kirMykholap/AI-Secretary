import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { TickTickTask } from '../../types';
import { ISyncTargetAdapter } from '../../core/domain/interfaces/sync-adapter.interface';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class TickTickAdapter implements ISyncTargetAdapter, OnModuleInit {
  private readonly logger = new Logger(TickTickAdapter.name);
  private axiosInstance: AxiosInstance | null = null;
  private jiraProjectId: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.initializeClient();
  }

  private async initializeClient() {
    try {
      const tokenRecord = await this.prisma.integrationToken.findUnique({
        where: { provider: 'ticktick' }
      });

      const accessToken = tokenRecord?.access_token || process.env.TICKTICK_ACCESS_TOKEN;

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

      // Add interceptor for 401 Unauthorized to refresh token automatically
      this.axiosInstance.interceptors.response.use(
        (response) => response,
        async (error) => {
          const originalRequest = error.config;
          if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            this.logger.log('TickTick token expired (401). Attempting refresh...');
            try {
              const newToken = await this.refreshToken();
              // Update authorization header for the original request
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
              // Retry the request with the new token
              return axios(originalRequest);
            } catch (refreshError) {
              this.logger.error('Failed to automatically refresh TickTick token');
              return Promise.reject(refreshError);
            }
          }
          return Promise.reject(error);
        }
      );

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
   * Refresh the TickTick Access Token using the refresh_token
   */
  private async refreshToken(): Promise<string> {
    const tokenRecord = await this.prisma.integrationToken.findUnique({
      where: { provider: 'ticktick' },
    });

    if (!tokenRecord || !tokenRecord.refresh_token) {
      throw new Error('No refresh token available');
    }

    const clientId = process.env.TICKTICK_CLIENT_ID;
    const clientSecret = process.env.TICKTICK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('OAuth configuration missing');
    }

    const response = await axios.post(
      'https://ticktick.com/oauth/token',
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: tokenRecord.refresh_token,
        scope: 'tasks:write tasks:read',
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + (expires_in * 1000));

    await this.prisma.integrationToken.update({
      where: { provider: 'ticktick' },
      data: {
        access_token,
        refresh_token,
        expires_at: expiresAt,
      },
    });

    // Update global axios instance headers
    if (this.axiosInstance) {
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    }

    this.logger.log('TickTick Access Token successfully refreshed!');
    return access_token;
  }

  /**
   * Get or create "Jira" project for synced tasks
   */
  private async ensureJiraProject(): Promise<string> {
    if (!this.axiosInstance) {
      throw new Error('TickTick integration is disabled (missing credentials)');
    }
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
    if (!this.axiosInstance) {
      this.logger.warn('TickTick integration disabled. Cannot fetch tasks.');
      return [];
    }
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
    if (!this.axiosInstance) {
      this.logger.warn(`TickTick integration disabled. Cannot create task ${task.title}.`);
      throw new Error('TickTick integration is disabled (missing credentials)');
    }
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
    if (!this.axiosInstance) {
      this.logger.warn(`TickTick integration disabled. Cannot update task ${taskId}.`);
      throw new Error('TickTick integration is disabled (missing credentials)');
    }
    try {
      this.logger.log(`Updating task in TickTick: ${taskId}`);
      this.logger.debug(`Update payload: ${JSON.stringify(task)}`);

      // TickTick requires the full task object for updates. Fetch it first.
      const existingTaskResponse = await this.axiosInstance.get(`/task/${taskId}`);
      const fullTask = { ...existingTaskResponse.data, ...task };

      const response = await this.axiosInstance.post(`/task/${taskId}`, fullTask);

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
    if (!this.axiosInstance) {
      this.logger.warn(`TickTick integration disabled. Cannot get task ${taskId}.`);
      return null;
    }
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

  public async exchangeCodeForToken(code: string): Promise<void> {
    try {
      const clientId = process.env.TICKTICK_CLIENT_ID;
      const clientSecret = process.env.TICKTICK_CLIENT_SECRET;
      const redirectUri = process.env.TICKTICK_REDIRECT_URI;

      if (!clientId || !clientSecret || !redirectUri) {
        throw new Error('OAuth configuration missing');
      }

      this.logger.log('Requesting access token from TickTick API');
      const response = await axios.post(
        'https://ticktick.com/oauth/token',
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          scope: 'tasks:write tasks:read',
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      if (!access_token) {
        throw new Error('No access token returned from TickTick');
      }

      const expiresAt = new Date(Date.now() + expires_in * 1000);

      await this.prisma.integrationToken.upsert({
        where: { provider: 'ticktick' },
        update: {
          access_token,
          refresh_token,
          expires_at: expiresAt,
        },
        create: {
          provider: 'ticktick',
          access_token,
          refresh_token,
          expires_at: expiresAt,
        },
      });

      this.logger.log('Successfully saved TickTick token to Database. Re-initializing client.');
      await this.initializeClient();
    } catch (error) {
      this.logger.error('Failed to exchange code for TickTick token:', error.response?.data || error.message);
      throw error;
    }
  }
}
