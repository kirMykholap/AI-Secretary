import { Controller, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PlanningOrchestrator } from '../../core/application/orchestrators/planning.orchestrator';
import { TaskSyncOrchestrator } from '../../core/application/orchestrators/task-sync.orchestrator';

@Controller('scheduler')
export class SchedulerController {
    private readonly logger = new Logger(SchedulerController.name);

    constructor(
        private readonly planningOrchestrator: PlanningOrchestrator,
        private readonly syncOrchestrator: TaskSyncOrchestrator
    ) { }

    @Cron('0 3 * * *', {
        name: 'nightly-jira-sync',
        timeZone: (process.env.TIMEZONE || 'Europe/Kiev').replace(/^['"]|['"]$/g, ''),
    })
    async handleNightlySync() {
        this.logger.log('CRON Triggered: Nightly Jira sync starting...');
        try {
            await this.syncOrchestrator.syncAllJiraTasks();
            this.logger.log('Nightly Jira sync completed successfully.');
        } catch (error) {
            this.logger.error('Nightly Jira sync failed:', error);
        }
    }

    @Cron((process.env.MORNING_CRON || '0 10 * * *').replace(/^['"]|['"]$/g, ''), {
        name: 'morning-planning',
        timeZone: (process.env.TIMEZONE || 'Europe/Kiev').replace(/^['"]|['"]$/g, ''),
    })
    async handleMorningPlanning() {
        this.logger.log('CRON Triggered: Morning planning starting...');
        await this.planningOrchestrator.initiateMorningPlanning();
    }

    @Cron((process.env.EVENING_CRON || '0 21 * * *').replace(/^['"]|['"]$/g, ''), {
        name: 'evening-checkup',
        timeZone: (process.env.TIMEZONE || 'Europe/Kiev').replace(/^['"]|['"]$/g, ''),
    })
    async handleEveningCheckup() {
        this.logger.log('CRON Triggered: Evening checkup starting...');
        await this.planningOrchestrator.processEveningCheckup();
    }
}
