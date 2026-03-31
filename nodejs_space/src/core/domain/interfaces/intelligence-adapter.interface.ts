export const INTELLIGENCE_ADAPTER = 'INTELLIGENCE_ADAPTER';

export interface ParsedVoiceTask {
    title: string;
    due_date: string | null;
    priority: number;
    description: string | null;
}

export interface IIntelligenceAdapter {
    estimateTaskTime(title: string, description: string): Promise<number>;
    generateMorningPlan(tasks: any[], postponedTasks: any[], totalMinutes: number, capacityMinutes: number): Promise<string>;
    generatePostponeReason(title: string, priority: number, postponedCount: number, capacity: number, currentLoad: number): Promise<string>;
    generatePostponedTaskSuggestion(title: string, postponedCount: number): Promise<string>;
    parseVoiceTask(transcript: string): Promise<ParsedVoiceTask | null>;
}
