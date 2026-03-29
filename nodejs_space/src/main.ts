import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { FileLogger } from './infrastructure/logger/file.logger';
import { TelegramAdapter } from './infrastructure/adapters/telegram.adapter';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const fileLogger = new FileLogger();
  const app = await NestFactory.create(AppModule, { logger: fileLogger });
  const logger = new Logger('Bootstrap');

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  // Swagger Documentation Setup
  const swaggerPath = 'api-docs';

  // Prevent CDN/browser caching of Swagger docs
  app.use(
    `/${swaggerPath}`,
    (req: Request, res: Response, next: NextFunction) => {
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate',
      );
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      next();
    },
  );

  const config = new DocumentBuilder()
    .setTitle('AI Task Secretary API')
    .setDescription(
      'API for synchronizing tasks between Jira and TickTick with Telegram bot integration',
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(swaggerPath, app, document, {
    customSiteTitle: 'AI Task Secretary API',
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 30px 0; }
      .swagger-ui .info .title { font-size: 32px; color: #2c3e50; }
      .swagger-ui { background-color: #f8f9fa; }
      .swagger-ui .opblock { border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showCommonExtensions: true,
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  // --- CRITICAL ALERTS TO TELEGRAM ---
  const telegramService = app.get(TelegramAdapter);
  const configService = app.get(ConfigService);
  const adminId = configService.get<string>('TELEGRAM_CHAT_ID');

  const sendCrashAlert = async (type: string, error: any) => {
    logger.error(`[${type}] ${error?.message || error}`, error?.stack || '');
    if (adminId) {
      try {
        await telegramService.sendMessage(
          parseInt(adminId, 10),
          `🚨 *CRITICAL SERVER CRASH (${type})*\n\n🔥 *Процесс node.js упал!* Бот уходит в рестарт.\n❗️ *Ошибка:* ${error?.message || error}`,
          'Markdown'
        );
      } catch (e) {
        logger.error('Failed to send crash alert to Telegram', e);
      }
    }
  };

  process.on('uncaughtException', async (error) => {
    await sendCrashAlert('UncaughtException', error);
  });

  process.on('unhandledRejection', async (reason) => {
    await sendCrashAlert('UnhandledRejection', reason);
  });
  // -----------------------------------

  logger.log(`Application is running on port ${port}`);
  logger.log(
    `API Documentation available at: http://localhost:${port}/${swaggerPath}`,
  );
}
bootstrap();
