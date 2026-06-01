import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info({ tenant: config.ZEP_TENANT, baseUrl: config.ZEP_BASE_URL }, 'zep_mcp_started');
  // stdout is reserved for the JSON-RPC stream; status goes to stderr.
  process.stderr.write('ZEP MCP Server running on stdio.\n');

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'zep_mcp_shutdown');
    void server.close().finally(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
