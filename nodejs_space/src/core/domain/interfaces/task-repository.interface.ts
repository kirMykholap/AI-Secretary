import { TaskEntity } from '../entities/task.entity';

export const TASK_REPOSITORY = 'TASK_REPOSITORY';

export interface ITaskRepository {
    createTask(data: Partial<TaskEntity>): Promise<TaskEntity>;
    updateTask(id: string, data: Partial<TaskEntity>): Promise<TaskEntity>;
    deleteTask(id: string): Promise<TaskEntity>;
    getTaskById(id: string): Promise<TaskEntity | null>;
    getTaskByJiraId(jiraId: string): Promise<TaskEntity | null>;
    getAllTasks(status?: string): Promise<TaskEntity[]>;
    getTasksByDueDateRange(start: Date, end: Date): Promise<TaskEntity[]>;
    getActiveTasksByDueDateRange(start: Date, end: Date): Promise<TaskEntity[]>;
    getOverdueTasks(referenceDate: Date): Promise<TaskEntity[]>;
    getPostponedTasks(status?: string): Promise<TaskEntity[]>;
    saveDailyCheckin(userId: string, capacityMin: number, isDayOff: boolean): Promise<void>;
}
