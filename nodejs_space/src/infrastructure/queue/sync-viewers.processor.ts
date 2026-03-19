import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { TICKTICK_ADAPTER } from '../../core/domain/interfaces/sync-adapter.interface';
import type { ISyncTargetAdapter } from '../../core/domain/interfaces/sync-adapter.interface';
import { MESSAGING_ADAPTER } from '../../core/domain/interfaces/messaging-adapter.interface';
import type { IMessagingAdapter } from '../../core/domain/interfaces/messaging-adapter.interface';
import { TASK_REPOSITORY } from '../../core/domain/interfaces/task-repository.interface';
import type { ITaskRepository } from '../../core/domain/interfaces/task-repository.interface';

@Processor('sync-viewers-queue')
export class SyncViewersProcessor extends WorkerHost {
    private readonly logger = new Logger(SyncViewersProcessor.name);
    private readonly targetChatId = 337519310;

    constructor(
        @Inject(TICKTICK_ADAPTER) private tickTickAdapter: ISyncTargetAdapter,
        @Inject(MESSAGING_ADAPTER) private messagingAdapter: IMessagingAdapter,
        @Inject(TASK_REPOSITORY) private taskRepository: ITaskRepository,
    ) {
        super();
    }

    private formatTickTickDate(date: Date): string {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}T23:59:00+0200`;
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { taskId, ticktickId, title, description, priority, dueDate, estimatedMinutes, sourceKey, isNew } = job.data;
        this.logger.log(`Syncing viewers for task: ${taskId}`);

        try {
            if (ticktickId) {
                await this.tickTickAdapter.updateTask(ticktickId, {
                    title,
                    content: description,
                    priority,
                    dueDate: this.formatTickTickDate(dueDate),
                    tags: ['jira'],
                });
            } else {
                const ticktickTask = await this.tickTickAdapter.createTask({
                    title,
                    content: description,
                    priority,
                    dueDate: this.formatTickTickDate(dueDate),
                    tags: ['jira'],
                });
                await this.taskRepository.updateTask(taskId, {
                    ticktick_id: ticktickTask.id,
                });
            }

            if (isNew && sourceKey && estimatedMinutes !== undefined) {
                await this.messagingAdapter.sendNewTaskNotification(
                    this.targetChatId,
                    sourceKey,
                    title,
                    estimatedMinutes
                );
            }
        } catch (error) {
            this.logger.error(`Error syncing viewers for task ${taskId}:`, error);
            throw error;
        }
    }
}
