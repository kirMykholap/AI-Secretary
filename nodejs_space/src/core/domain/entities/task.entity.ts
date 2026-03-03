export class TaskEntity {
    id: string;
    source: string;
    source_id: string;
    title: string;
    description?: string;
    status: string;
    priority: number;
    due_date?: Date;
    tags: string[];

    jira_id?: string;
    jira_key?: string;
    ticktick_id?: string;

    estimated_minutes?: number;
    actual_minutes?: number;
    postponed_count: number;
    parent_id?: string;

    created_at: Date;
    updated_at: Date;

    constructor(partial: Partial<TaskEntity>) {
        Object.assign(this, partial);
    }
}
