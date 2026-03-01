import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { JiraService } from './jira.service';
import { TickTickService } from './ticktick.service';
import { TelegramService } from './telegram.service';
import { SyncService } from './sync.service';
import { TaskService } from './task.service';
import { LlmService } from './llm.service';
import { SchedulerService } from './scheduler.service';
import { TelegramController } from './telegram.controller';
import { SyncController } from './sync.controller';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController, TelegramController, SyncController, WebhookController],
  providers: [
    AppService,
    PrismaService,
    JiraService,
    TickTickService,
    TelegramService,
    SyncService,
    TaskService,
    LlmService,
    SchedulerService,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly schedulerService: SchedulerService,
  ) {}

  onModuleInit() {
    // Set scheduler service in telegram service to avoid circular dependency
    this.telegramService.setSchedulerService(this.schedulerService);
  }
}
