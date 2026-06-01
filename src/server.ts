import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerEmployeeTools } from './tools/employees.js';
import { registerAttendanceTools } from './tools/attendances.js';
import { registerAbsenceTools } from './tools/absences.js';
import { registerDepartmentTools } from './tools/departments.js';
import { registerDeviceTools } from './tools/devices.js';
import { registerMasterDataResources } from './resources/master-data.js';

const SERVER_NAME = 'zep-mcp-server';
const SERVER_VERSION = '0.1.0';

/** Builds the MCP server with all Phase 2 tools + master-data resources. */
export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, resources: {} } },
  );

  // Phase 2 — HR/Time tools (live-verified) + 4 master-data resources.
  registerEmployeeTools(server);
  registerAttendanceTools(server);
  registerAbsenceTools(server);
  registerDepartmentTools(server);
  registerDeviceTools(server);
  registerMasterDataResources(server);

  // Phase 3 — finance / projects / tickets / customers / stammdaten tools.
  registerPhase3Tools(server);

  return server;
}

/** Placeholder — filled in Phase 3 with the remaining tools. */
function registerPhase3Tools(_server: McpServer): void {
  void _server;
}
