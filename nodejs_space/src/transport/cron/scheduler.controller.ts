import { Controller, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PlanningOrchestrator } from '../../core/application/orchestrators/planning.orchestrator';

@Controller('scheduler')
export class SchedulerController {
    private readonly logger = new Logger(SchedulerController.name);

    constructor(private readonly planningOrchestrator: PlanningOrchestrator) { }

    @Cron('0 10 * * *', {
        name: 'morning-planning',
        timeZone: 'Europe/Kiev',
    })
    async handleMorningPlanning() {
        this.logger.log('CRON Triggered: Morning planning starting...');
        const targetChatId = 337519310;
        // We didn't migrate handleMorningPlanning logic fully, but it used to sendCapacitySelection.
        // Wait, let's fix that. The orchestrator doesn't have sendCapacitySelection publicly exposed, 
        // but we can expose a method `sendCapacitySelection(chatId)` in it.
        await this.planningOrchestrator['telegramService'].sendCapacitySelection(targetChatId);
    }

    @Cron('0 21 * * *', {
        name: 'evening-checkup',
        timeZone: 'Europe/Kiev',
    })
    async handleEveningCheckup() {
        this.logger.log('CRON Triggered: Evening checkup starting...');
        await this.planningOrchestrator.processEveningCheckup();
    }
}
