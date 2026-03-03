import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { INTELLIGENCE_ADAPTER } from '../../core/domain/interfaces/intelligence-adapter.interface';
import type { IIntelligenceAdapter } from '../../core/domain/interfaces/intelligence-adapter.interface';
import { TASK_REPOSITORY } from '../../core/domain/interfaces/task-repository.interface';
import type { ITaskRepository } from '../../core/domain/interfaces/task-repository.interface';

@Processor('estimate-queue')
export class EstimateTimeProcessor extends WorkerHost {
    private readonly logger = new Logger(EstimateTimeProcessor.name);

    constructor(
        @Inject(INTELLIGENCE_ADAPTER) private llmAdapter: IIntelligenceAdapter,
        @Inject(TASK_REPOSITORY) private taskRepository: ITaskRepository,
        @InjectQueue('sync-viewers-queue') private syncViewersQueue: Queue,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { taskId, title, description } = job.data;
        this.logger.log(`Estimating time for task: ${taskId}`);

        try {
            const estimatedMinutes = await this.llmAdapter.estimateTaskTime(title, description);

            const updatedTask = await this.taskRepository.updateTask(taskId, {
                estimated_minutes: estimatedMinutes,
            });

            this.logger.log(`Estimated ${estimatedMinutes} mins for task ${taskId}. Queueing viewer sync.`);

            await this.syncViewersQueue.add('sync-viewers', {
                taskId: updatedTask.id,
                title: title,
                description: description,
                priority: updatedTask.priority,
                dueDate: updatedTask.due_date,
                estimatedMinutes: estimatedMinutes,
                sourceKey: title.match(/^\[([A-Z]+-\d+)\]/)?.[1] || 'UNKNOWN',
                isNew: true,
            });
        } catch (error) {
            this.logger.error(`Error processing estimate-time for task ${taskId}:`, error);
            throw error;
        }
    }
}
