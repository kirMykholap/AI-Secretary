import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { JiraTask } from './types';

@Injectable()
export class JiraService {
  private readonly logger = new Logger(JiraService.name);
  private axiosInstance: AxiosInstance;
  private email: string;
  private domain: string;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    try {
      const apiToken = process.env.JIRA_API_TOKEN;
      this.email = process.env.JIRA_EMAIL || '';
      this.domain = process.env.JIRA_DOMAIN || '';

      if (!apiToken || !this.email || !this.domain) {
        this.logger.warn('Missing Jira credentials in environment variables. Jira integration will be disabled.');
        return;
      }

      this.axiosInstance = axios.create({
        baseURL: `https://${this.domain}/rest/api/3`,
        auth: {
          username: this.email,
          password: apiToken,
        },
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      this.logger.log('Jira client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Jira client:', error);
      throw error;
    }
  }

  async getTaskById(issueId: string): Promise<JiraTask | null> {
    try {
      this.logger.log(`Fetching Jira task: ${issueId}`);
      const response = await this.axiosInstance.get(`/issue/${issueId}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to get Jira task ${issueId}:`,
        error.response?.data || error.message,
      );
      return null;
    }
  }

  async getAssignedTasks(): Promise<JiraTask[]> {
    try {
      this.logger.log(`Fetching tasks assigned to ${this.email}`);

      const jql = `assignee = "${this.email}" AND resolution = Unresolved ORDER BY updated DESC`;

      const response = await this.axiosInstance.post('/search/jql', {
        jql,
        fields: ['summary', 'description', 'priority', 'duedate', 'updated'],
        maxResults: 100,
      });

      const tasks = response.data.issues || [];
      this.logger.log(`Fetched ${tasks.length} tasks from Jira`);

      return tasks;
    } catch (error) {
      this.logger.error(
        'Failed to fetch Jira tasks:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }
}
