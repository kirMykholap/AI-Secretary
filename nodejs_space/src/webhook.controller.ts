import { Controller, Post, Body, HttpCode, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SyncService } from './sync.service';

@ApiTags('Webhooks')
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly syncService: SyncService) {}

  @Post('jira')
  @HttpCode(200)
  @ApiOperation({ summary: 'Jira webhook endpoint for real-time task synchronization' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleJiraWebhook(@Body() payload: any) {
    try {
      this.logger.log('Received Jira webhook');
      this.logger.debug(`Webhook event: ${payload.webhookEvent}`);

      const webhookEvent = payload.webhookEvent;
      const issue = payload.issue;

      if (!issue) {
        this.logger.warn('No issue found in webhook payload');
        return { success: true, message: 'No issue to process' };
      }

      // Process events: jira:issue_created, jira:issue_updated
      if (webhookEvent && (webhookEvent.includes('issue_created') || webhookEvent.includes('issue_updated'))) {
        // Check if issue is assigned to our user using accountId
        const assigneeAccountId = issue.fields?.assignee?.accountId;
        const assigneeEmail = issue.fields?.assignee?.emailAddress;
        const targetAccountId = process.env.JIRA_ACCOUNT_ID;

        this.logger.log(`Issue ${issue.key}: assigneeId=${assigneeAccountId}, email=${assigneeEmail}, targetId=${targetAccountId}`);

        // For issue_created: process even if assignee is undefined (will be assigned soon)
        // For issue_updated: check if it's assigned to target user using accountId
        const shouldProcess = webhookEvent.includes('issue_created') || 
                             (assigneeAccountId === targetAccountId);

        if (shouldProcess) {
          this.logger.log(`Processing Jira issue ${issue.key}${assigneeAccountId ? ' assigned to account ' + assigneeAccountId : ' (assignee pending)'}`);
          
          // Trigger sync for this specific issue
          await this.syncService.syncSingleJiraTask(issue.key);
          
          return { 
            success: true, 
            message: `Задача ${issue.key} синхронизирована успешно`,
            taskKey: issue.key 
          };
        } else {
          this.logger.log(`Issue ${issue.key} not assigned to target user, skipping`);
          return { success: true, message: 'Task not assigned to target user' };
        }
      }

      return { success: true, message: 'Event type not relevant for sync' };
    } catch (error) {
      this.logger.error('Error processing Jira webhook:', error);
      // Return 200 anyway to prevent Jira from retrying
      return { success: false, error: error.message };
    }
  }
}
