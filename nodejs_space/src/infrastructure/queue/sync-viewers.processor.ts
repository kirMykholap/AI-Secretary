import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatTickTickDate } from '../utils/date.utils';
import { TICKTICK_ADAPTER } from '../../core/domain/interfaces/sync-adapter.interface';
import type { ISyncTargetAdapter } from '../../core/domain/interfaces/sync-adapter.interface';
import { MESSAGING_ADAPTER } from '../../core/domain/interfaces/messaging-adapter.interface';
import type { IMessagingAdapter } from '../../core/domain/interfaces/messaging-adapter.interface';
import { TASK_REPOSITORY } from '../../core/domain/interfaces/task-repository.interface';
import type { ITaskRepository } from '../../core/domain/interfaces/task-repository.interface';

@Processor('sync-viewers-queue')
export class SyncViewersProcessor extends WorkerHost {
    private readonly logger = new Logger(SyncViewersProcessor.name);
    private readonly targetChatId: number;

    constructor(
        @Inject(TICKTICK_ADAPTER) private tickTickAdapter: ISyncTargetAdapter,
        @Inject(MESSAGING_ADAPTER) private messagingAdapter: IMessagingAdapter,
        @Inject(TASK_REPOSITORY) private taskRepository: ITaskRepository,
        private readonly configService: ConfigService,
    ) {
        super();
        this.targetChatId = this.configService.getOrThrow<number>('TELEGRAM_CHAT_ID');
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
                    dueDate: formatTickTickDate(dueDate),
                    tags: ['jira'],
                });
            } else {
                const ticktickTask = await this.tickTickAdapter.createTask({
                    title,
                    content: description,
                    priority,
                    dueDate: formatTickTickDate(dueDate),
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
