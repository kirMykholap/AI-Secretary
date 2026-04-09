import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma } from '../db.js';

export function registerTaskTools(server: McpServer): void {
  server.tool(
    'get_tasks',
    'Get tasks from the database with optional filters. Returns tasks sorted by priority desc, due_date asc.',
    {
      status: z
        .enum(['active', 'completed', 'deleted'])
        .optional()
        .describe('Filter by status. Default: all statuses'),
      priority: z
        .number()
        .min(0)
        .max(5)
        .optional()
        .describe('Filter by exact priority (0=low, 1=medium, 3=high, 5=urgent)'),
      source: z
        .string()
        .optional()
        .describe('Filter by source: jira, telegram, ticktick'),
      due_before: z
        .string()
        .optional()
        .describe('ISO date string — tasks with due_date <= this date'),
      overdue_only: z
        .boolean()
        .optional()
        .describe('If true, return only tasks with due_date < now and status=active'),
      limit: z
        .number()
        .min(1)
        .max(100)
        .default(20)
        .describe('Max number of results'),
    },
    async ({ status, priority, source, due_before, overdue_only, limit }) => {
      const now = new Date();
      const tasks = await prisma.tasks.findMany({
        where: {
          ...(status && { status }),
          ...(priority !== undefined && { priority }),
          ...(source && { source }),
          ...(due_before && { due_date: { lte: new Date(due_before) } }),
          ...(overdue_only && {
            status: 'active',
            due_date: { lt: now },
          }),
        },
        take: limit,
        orderBy: [{ priority: 'desc' }, { due_date: 'asc' }],
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }],
      };
    },
  );

  server.tool(
    'get_task',
    'Get a single task by its UUID, Jira ID, or Jira key (e.g. HOME-42)',
    {
      id: z.string().optional().describe('Task UUID'),
      jira_key: z.string().optional().describe('Jira issue key, e.g. HOME-42'),
      jira_id: z.string().optional().describe('Jira internal issue ID'),
    },
    async ({ id, jira_key, jira_id }) => {
      const task = await prisma.tasks.findFirst({
        where: {
          OR: [
            ...(id ? [{ id }] : []),
            ...(jira_key ? [{ jira_key }] : []),
            ...(jira_id ? [{ jira_id }] : []),
          ],
        },
      });

      if (!task) {
        return { content: [{ type: 'text', text: 'Task not found' }] };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
      };
    },
  );

  server.tool(
    'update_task',
    'Update task fields in the database. Only provided fields will be changed.',
    {
      id: z.string().describe('Task UUID (required)'),
      title: z.string().optional(),
      priority: z.number().min(0).max(5).optional().describe('0-5'),
      status: z.enum(['active', 'completed', 'deleted']).optional(),
      due_date: z.string().optional().describe('ISO date string, e.g. 2026-04-15'),
      estimated_minutes: z.number().optional(),
      postponed_count: z.number().optional(),
    },
    async ({ id, title, priority, status, due_date, estimated_minutes, postponed_count }) => {
      const task = await prisma.tasks.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(priority !== undefined && { priority }),
          ...(status !== undefined && { status }),
          ...(due_date !== undefined && { due_date: new Date(due_date) }),
          ...(estimated_minutes !== undefined && { estimated_minutes }),
          ...(postponed_count !== undefined && { postponed_count }),
        },
      });

      return {
        content: [{ type: 'text', text: `Updated task:\n${JSON.stringify(task, null, 2)}` }],
      };
    },
  );

  server.tool(
    'get_db_stats',
    'Get aggregate statistics: task counts by status, by source, total overdue',
    {},
    async () => {
      const now = new Date();
      const [byStatus, bySource, overdue, totalActive, highPriority] = await Promise.all([
        prisma.tasks.groupBy({ by: ['status'], _count: true }),
        prisma.tasks.groupBy({
          by: ['source'],
          where: { status: 'active' },
          _count: true,
        }),
        prisma.tasks.count({
          where: { status: 'active', due_date: { lt: now } },
        }),
        prisma.tasks.count({ where: { status: 'active' } }),
        prisma.tasks.count({
          where: { status: 'active', priority: { gte: 3 } },
        }),
      ]);

      const stats = {
        total_active: totalActive,
        overdue,
        high_priority_active: highPriority,
        by_status: byStatus,
        active_by_source: bySource,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
      };
    },
  );
}
