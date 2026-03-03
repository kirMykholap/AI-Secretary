import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TaskCreatedEvent, TaskUpdatedEvent } from './task.event';

@Injectable()
export class TaskEventListener {
    private readonly logger = new Logger(TaskEventListener.name);

    constructor(
        @InjectQueue('estimate-queue') private estimateQueue: Queue,
        @InjectQueue('sync-viewers-queue') private syncViewersQueue: Queue,
    ) { }

    @OnEvent('task.created')
    async handleTaskCreatedEvent(event: TaskCreatedEvent) {
        this.logger.log(`Received TaskCreatedEvent for task ${event.taskId}`);
        await this.estimateQueue.add('estimate-time', {
            taskId: event.taskId,
            title: event.title,
            description: event.description,
        });
    }

    @OnEvent('task.updated')
    async handleTaskUpdatedEvent(event: TaskUpdatedEvent) {
        this.logger.log(`Received TaskUpdatedEvent for task ${event.taskId}`);
        await this.syncViewersQueue.add('sync-viewers', {
            taskId: event.taskId,
            ticktickId: event.ticktickId,
            title: event.title,
            description: event.description,
            priority: event.priority,
            dueDate: event.dueDate,
        });
    }
}
