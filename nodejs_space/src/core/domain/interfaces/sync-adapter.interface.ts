export const TICKTICK_ADAPTER = 'TICKTICK_ADAPTER';
export const JIRA_ADAPTER = 'JIRA_ADAPTER';

export interface ISyncTargetAdapter {
    createTask(data: any): Promise<any>;
    updateTask(id: string, data: any): Promise<any>;
}

export interface ISyncSourceAdapter {
    getTaskById(id: string): Promise<any>;
    getAssignedTasks(): Promise<any[]>;
    updateDueDate(id: string, dueDate: Date): Promise<void>;
    transitionToDone(id: string): Promise<boolean>;
    transitionToCancelled(id: string): Promise<boolean>;
}
