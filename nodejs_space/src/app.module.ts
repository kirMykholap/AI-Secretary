import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TelegrafModule } from 'nestjs-telegraf';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';

// Webhooks
import { WebhookController } from './transport/webhooks/jira-webhook.controller';
import { SyncController } from './transport/webhooks/sync.controller';
import { TelegramUpdate } from './transport/webhooks/telegram.update';
import { TickTickAuthController } from './transport/webhooks/ticktick-auth.controller';

// Cron Scheduler
import { SchedulerController } from './transport/cron/scheduler.controller';

// Orchestrators (Application)
import { TaskSyncOrchestrator } from './core/application/orchestrators/task-sync.orchestrator';
import { PlanningOrchestrator } from './core/application/orchestrators/planning.orchestrator';

// Events
import { TaskEventListener } from './core/application/events/task.listener';

// Queues
import { EstimateTimeProcessor } from './infrastructure/queue/estimate-time.processor';
import { SyncViewersProcessor } from './infrastructure/queue/sync-viewers.processor';

// Database
import { TaskRepository } from './infrastructure/database/task.repository';

// Adapters
import { JiraAdapter } from './infrastructure/adapters/jira.adapter';
import { TickTickAdapter } from './infrastructure/adapters/ticktick.adapter';
import { TelegramAdapter } from './infrastructure/adapters/telegram.adapter';
import { LlmAdapter } from './infrastructure/adapters/llm.adapter';

// Interfaces
import { TASK_REPOSITORY } from './core/domain/interfaces/task-repository.interface';
import { JIRA_ADAPTER, TICKTICK_ADAPTER } from './core/domain/interfaces/sync-adapter.interface';
import { MESSAGING_ADAPTER } from './core/domain/interfaces/messaging-adapter.interface';
import { INTELLIGENCE_ADAPTER } from './core/domain/interfaces/intelligence-adapter.interface';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: configService.get<number>('REDIS_PORT') || 6379,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'estimate-queue',
    }),
    BullModule.registerQueue({
      name: 'sync-viewers-queue',
    }),
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('TELEGRAM_BOT_TOKEN') || 'dummy',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    AppController,
    WebhookController,
    SyncController,
    SchedulerController,
    TickTickAuthController,
  ],
  providers: [
    AppService,
    PrismaService,

    // Adapters mapping
    {
      provide: TASK_REPOSITORY,
      useClass: TaskRepository,
    },
    {
      provide: JIRA_ADAPTER,
      useClass: JiraAdapter,
    },
    {
      provide: TICKTICK_ADAPTER,
      useClass: TickTickAdapter,
    },
    {
      provide: MESSAGING_ADAPTER,
      useClass: TelegramAdapter,
    },
    {
      provide: INTELLIGENCE_ADAPTER,
      useClass: LlmAdapter,
    },

    // Actual adapter classes (since they might need to use other services or injected directly by Nest)
    TaskRepository,
    JiraAdapter,
    TickTickAdapter,
    TelegramAdapter,
    LlmAdapter,

    // Orchestrators
    TaskSyncOrchestrator,
    PlanningOrchestrator,

    // Transports / Listeners
    TelegramUpdate,
    TaskEventListener,

    // Queues
    EstimateTimeProcessor,
    SyncViewersProcessor,
  ],
})
export class AppModule { }
