import {
  Controller,
  Post,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { TaskSyncOrchestrator } from '../../core/application/orchestrators/task-sync.orchestrator';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';

@ApiTags('Sync')
@Controller('api')
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(private readonly taskSyncOrchestrator: TaskSyncOrchestrator) { }

  @Post('sync')
  @ApiOperation({ summary: 'Trigger Jira to TickTick synchronization' })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API key for authentication',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Sync completed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async syncTasks(@Headers('x-api-key') apiKey: string) {
    this.logger.log('Sync endpoint called');

    // Verify API key
    const validApiKey = process.env.SYNC_API_KEY;
    if (!apiKey || apiKey !== validApiKey) {
      this.logger.warn('Unauthorized sync attempt');
      throw new UnauthorizedException('Invalid API key');
    }

    try {
      const result = await this.taskSyncOrchestrator.syncAllJiraTasks();

      return {
        success: true,
        message: 'Synchronization completed',
        ...result,
      };
    } catch (error) {
      this.logger.error('Sync failed:', error);
      return {
        success: false,
        message: 'Synchronization failed',
        error: error.message,
      };
    }
  }
}
