export class TaskCreatedEvent {
    constructor(
        public readonly taskId: string,
        public readonly title: string,
        public readonly description: string,
        public readonly sourceKey: string,
    ) { }
}

export class TaskUpdatedEvent {
    constructor(
        public readonly taskId: string,
        public readonly title: string,
        public readonly description: string,
        public readonly priority: number,
        public readonly dueDate: Date,
        public readonly ticktickId?: string,
    ) { }
}
