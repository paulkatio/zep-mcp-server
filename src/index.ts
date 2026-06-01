import { config } from './config.js';

// Phase 1 stub: validate config on load, log to stderr, exit cleanly.
// No MCP server, tools, resources or HTTP client yet (added in later phases).
process.stderr.write('ZEP MCP Server starting... (Phase 1 stub)\n');
process.stderr.write(
  `[zep-mcp-server] Config loaded for tenant "${config.ZEP_TENANT}". ` +
    `Phase 1 stub — no tools registered yet.\n`,
);

process.exit(0);
