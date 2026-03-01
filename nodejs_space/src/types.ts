export interface JiraTask {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    priority?: {
      name: string;
    };
    duedate?: string;
    updated: string;
  };
}

export interface TickTickTask {
  id?: string;
  projectId?: string;
  title: string;
  content?: string;
  priority?: number;
  startDate?: string;
  dueDate?: string;
  tags?: string[];
}

export interface TaskMapping {
  id: number;
  jira_id: string;
  jira_key: string;
  ticktick_id: string;
  created_at: Date;
  updated_at: Date;
}
