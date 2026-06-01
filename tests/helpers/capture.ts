import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface CapturedTool {
  config: {
    title?: string;
    description?: string;
    inputSchema?: unknown;
    annotations?: Record<string, unknown>;
  };
  handler: (args: Record<string, unknown>, extra?: unknown) => Promise<unknown>;
}

export interface CapturedResource {
  uri: string;
  metadata: Record<string, unknown>;
  handler: (uri: URL, extra?: unknown) => Promise<unknown>;
}

/** Runs a `register*Tools(server)` fn against a fake server and returns the tools by name. */
export function captureTools(
  register: (server: McpServer) => void,
): Map<string, CapturedTool> {
  const tools = new Map<string, CapturedTool>();
  const fake = {
    registerTool(name: string, config: CapturedTool['config'], handler: CapturedTool['handler']) {
      tools.set(name, { config, handler });
      return {};
    },
  } as unknown as McpServer;
  register(fake);
  return tools;
}

/** Runs a `register*Resources(server)` fn against a fake server and returns the resources by name. */
export function captureResources(
  register: (server: McpServer) => void,
): Map<string, CapturedResource> {
  const resources = new Map<string, CapturedResource>();
  const fake = {
    registerResource(
      name: string,
      uri: string,
      metadata: Record<string, unknown>,
      handler: CapturedResource['handler'],
    ) {
      resources.set(name, { uri, metadata, handler });
      return {};
    },
  } as unknown as McpServer;
  register(fake);
  return resources;
}
