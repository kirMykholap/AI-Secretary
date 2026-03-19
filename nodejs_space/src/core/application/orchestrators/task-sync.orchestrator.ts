import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TASK_REPOSITORY } from '../../domain/interfaces/task-repository.interface';
import type { ITaskRepository } from '../../domain/interfaces/task-repository.interface';
import { JIRA_ADAPTER } from '../../domain/interfaces/sync-adapter.interface';
import type { ISyncSourceAdapter } from '../../domain/interfaces/sync-adapter.interface';
import { TaskCreatedEvent, TaskUpdatedEvent } from '../events/task.event';

@Injectable()
export class TaskSyncOrchestrator {
    private readonly logger = new Logger(TaskSyncOrchestrator.name);

    constructor(
        @Inject(JIRA_ADAPTER) private readonly jiraAdapter: ISyncSourceAdapter,
        @Inject(TASK_REPOSITORY) private readonly taskRepository: ITaskRepository,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    private mapPriority(jiraPriority?: string): number {
        if (!jiraPriority) return 1;

        const priorityMap: { [key: string]: number } = {
            Highest: 5,
            High: 3,
            Medium: 1,
            Low: 0,
            Lowest: 0,
        };
        return priorityMap[jiraPriority] ?? 1;
    }

    private extractDescription(description: any): string {
        if (!description) return '';
        if (typeof description === 'string') return description;
        if (typeof description === 'object' && description.content) {
            return this.extractTextFromADF(description);
        }
        return '';
    }

    private extractTextFromADF(adf: any): string {
        if (!adf || !adf.content) return '';
        const extractFromNode = (node: any): string => {
            if (!node) return '';
            if (node.type === 'text' && node.text) return node.text;
            if (node.content && Array.isArray(node.content)) {
                return node.content.map(extractFromNode).join(' ');
            }
            return '';
        };
        return adf.content.map(extractFromNode).join('\n').trim();
    }

    private getDueDate(jiraDueDate?: string): Date {
        if (jiraDueDate) {
            const date = new Date(jiraDueDate);
            date.setHours(23, 59, 0, 0);
            return date;
        } else {
            const date = new Date();
            date.setHours(23, 59, 0, 0);
            return date;
        }
    }

    async syncSingleJiraTask(jiraIssueId: string): Promise<void> {
        try {
            this.logger.log(`Syncing single Jira task: ${jiraIssueId}`);

            const jiraTask = await this.jiraAdapter.getTaskById(jiraIssueId);
            if (!jiraTask) {
                this.logger.error(`Jira task not found: ${jiraIssueId}`);
                return;
            }

            const existingTask = await this.taskRepository.getTaskByJiraId(jiraTask.id);

            const priority = this.mapPriority(jiraTask.fields?.priority?.name);
            const dueDate = this.getDueDate(jiraTask.fields?.duedate);
            const title = `[${jiraTask.key}] ${jiraTask.fields?.summary}`;
            const description = this.extractDescription(jiraTask.fields?.description);

            if (existingTask) {
                this.logger.log(`Updating existing task in DB: ${existingTask.id}`);
                const updatedTask = await this.taskRepository.updateTask(existingTask.id, {
                    title,
                    description,
                    priority,
                    due_date: dueDate,
                    jira_key: jiraTask.key,
                });

                // Fire event instead of direct downstream calls
                this.eventEmitter.emit(
                    'task.updated',
                    new TaskUpdatedEvent(
                        updatedTask.id,
                        title,
                        description,
                        priority,
                        dueDate,
                        updatedTask.ticktick_id || undefined,
                    ),
                );
            } else {
                this.logger.log(`Creating new task in DB for Jira: ${jiraTask.key}`);
                const newTask = await this.taskRepository.createTask({
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

                // Fire event
                this.eventEmitter.emit(
                    'task.created',
                    new TaskCreatedEvent(
                        newTask.id,
                        title,
                        description,
                        jiraTask.key,
                    ),
                );
            }
        } catch (error) {
            this.logger.error(`Failed to sync Jira task ${jiraIssueId}:`, error);
            throw error;
        }
    }

    async syncAllJiraTasks(): Promise<{
        created: number;
        updated: number;
        errors: number;
    }> {
        const stats = { created: 0, updated: 0, errors: 0 };

        try {
            this.logger.log('Starting full Jira sync...');

            const jiraTasks = await this.jiraAdapter.getAssignedTasks();
            this.logger.log(`Found ${jiraTasks.length} Jira tasks`);

            for (const jiraTask of jiraTasks) {
                try {
                    const existingTask = await this.taskRepository.getTaskByJiraId(jiraTask.id);

                    const priority = this.mapPriority(jiraTask.fields?.priority?.name);
                    const dueDate = this.getDueDate(jiraTask.fields?.duedate);
                    const title = `[${jiraTask.key}] ${jiraTask.fields?.summary}`;
                    const description = this.extractDescription(jiraTask.fields?.description);

                    if (existingTask) {
                        const updatedTask = await this.taskRepository.updateTask(existingTask.id, {
                            title,
                            description,
                            priority,
                            due_date: dueDate,
                            jira_key: jiraTask.key,
                        });

                        this.eventEmitter.emit(
                            'task.updated',
                            new TaskUpdatedEvent(
                                updatedTask.id,
                                title,
                                description,
                                priority,
                                dueDate,
                                updatedTask.ticktick_id || undefined,
                            ),
                        );

                        stats.updated++;
                    } else {
                        const newTask = await this.taskRepository.createTask({
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

                        this.eventEmitter.emit(
                            'task.created',
                            new TaskCreatedEvent(
                                newTask.id,
                                title,
                                description,
                                jiraTask.key,
                            ),
                        );

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
