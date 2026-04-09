import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env') });
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerSystemTools } from './tools/system.js';

const server = new McpServer({
  name: 'ai-secretary',
  version: '1.0.0',
});

registerTaskTools(server);
registerSystemTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
