import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramAdapter } from '../adapters/telegram.adapter';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    private readonly telegramService: TelegramAdapter,
    private readonly configService: ConfigService,
  ) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    
    // In some cases (like GraphQL or background jobs), there might be no HTTP response object
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
          ? exception.message
          : 'Unknown error';

    // Log the error using the global FileLogger
    if (status === HttpStatus.NOT_FOUND) {
      this.logger.warn(`404 Not Found: ${request?.url}`);
    } else {
      this.logger.error(
        `Unhandled Exception: ${JSON.stringify(message)}`,
        exception instanceof Error ? exception.stack : '',
        request?.url || 'Unknown Context'
      );
    }

    // If it's an internal server error, notify the admin via Telegram
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      try {
        const adminId = this.configService.get<string>('TELEGRAM_CHAT_ID');
        if (adminId) {
          const errorMsg = exception instanceof Error ? exception.message : JSON.stringify(message);
          const endpoint = request?.url ? `\`${request.url}\`` : 'Фоновый процесс / Внешний вызов';
          
          await this.telegramService.sendMessage(
            parseInt(adminId, 10),
            `🚨 *Критическая системная ошибка*\n\n🔥 *Источник:* ${endpoint}\n❗️ *Ошибка:* ${errorMsg}`,
            'Markdown'
          );
        }
      } catch (tgError) {
        this.logger.error('Failed to notify Telegram about the error:', tgError);
      }
    }

    // Only attempt to send an HTTP response if the Context is HTTP and response exists
    if (response && typeof response.status === 'function') {
        response.status(status).json({
          statusCode: status,
          timestamp: new Date().toISOString(),
          path: request?.url,
          error: message instanceof Object && 'message' in message 
                 ? message['message'] 
                 : message,
        });
    }
  }
}
