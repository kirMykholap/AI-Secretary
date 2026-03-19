export const MESSAGING_ADAPTER = 'MESSAGING_ADAPTER';

export interface IMessagingAdapter {
    sendMessage(chatId: number, text: string): Promise<void>;
    sendNewTaskNotification(chatId: number, taskKey: string, title: string, estimatedTime: number): Promise<void>;
    sendCapacitySelection(chatId: number): Promise<void>;
    sendEveningCheckupMessage(chatId: number, tasks: any[]): Promise<void>;
    sendFrequentlyPostponedTaskMessage(chatId: number, taskId: string, title: string, count: number, suggestion: string): Promise<void>;
}
