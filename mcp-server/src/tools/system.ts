import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Queue } from 'bullmq';
import axios from 'axios';

const QUEUE_NAMES = ['estimate-queue', 'sync-viewers-queue'];

export function registerSystemTools(server: McpServer): void {
  server.tool(
    'get_queue_status',
    'Get BullMQ queue statistics from Redis: waiting, active, completed, failed job counts',
    {},
    async () => {
      const connection = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      };

      const stats: Record<string, object> = {};

      for (const name of QUEUE_NAMES) {
        const queue = new Queue(name, { connection });
        try {
          const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
          stats[name] = counts;
        } finally {
          await queue.close();
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
      };
    },
  );

  server.tool(
    'trigger_sync',
    'Trigger full Jira → DB synchronization via the NestJS app API. Useful to force re-sync after manual Jira changes.',
    {
      app_url: z
        .string()
        .optional()
        .describe('Base URL of the NestJS app. Defaults to APP_BASE_URL env var or http://localhost:3000'),
    },
    async ({ app_url }) => {
      const baseUrl = app_url || process.env.APP_BASE_URL || 'http://localhost:3000';
      const apiKey = process.env.SYNC_API_KEY;

      if (!apiKey) {
        return {
          content: [{ type: 'text', text: 'Error: SYNC_API_KEY environment variable is not set' }],
        };
      }

      const response = await axios.post(
        `${baseUrl}/api/sync`,
        {},
        { headers: { 'x-api-key': apiKey } },
      );

      return {
        content: [{ type: 'text', text: `Sync result:\n${JSON.stringify(response.data, null, 2)}` }],
      };
    },
  );
}
