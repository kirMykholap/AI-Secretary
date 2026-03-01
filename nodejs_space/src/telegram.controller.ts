import { Controller, Post, Body, Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Telegram')
@Controller('webhook')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private readonly telegramService: TelegramService) {}

  @Post('telegram')
  @ApiOperation({ summary: 'Telegram webhook endpoint to receive bot messages' })
  @ApiResponse({ status: 200, description: 'Message processed' })
  async handleTelegramWebhook(@Body() update: any) {
    this.logger.log('Received Telegram webhook');
    
    try {
      await this.telegramService.handleWebhook(update);
      return { ok: true };
    } catch (error) {
      this.logger.error('Failed to handle Telegram webhook:', error);
      return { ok: false };
    }
  }
}
