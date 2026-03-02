import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TelegrafModule } from 'nestjs-telegraf';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { JiraService } from './jira.service';
import { TickTickService } from './ticktick.service';
import { TelegramService } from './telegram.service';
import { TelegramUpdate } from './telegram.update';
import { SyncService } from './sync.service';
import { TaskService } from './task.service';
import { LlmService } from './llm.service';
import { SchedulerService } from './scheduler.service';
import { SyncController } from './sync.controller';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('TELEGRAM_BOT_TOKEN') || 'dummy',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController, SyncController, WebhookController],
  providers: [
    AppService,
    PrismaService,
    JiraService,
    TickTickService,
    TelegramService,
    TelegramUpdate,
    SyncService,
    TaskService,
    LlmService,
    SchedulerService,
  ],
})
export class AppModule {}
