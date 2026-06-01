import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { paginateAll } from '../client/pagination.js';
import { ZepApiError } from '../client/errors.js';
import { logger } from '../lib/logger.js';

interface MasterDataType {
  type: string;
  path: string;
  title: string;
  description: string;
}

const TYPES: MasterDataType[] = [
  { type: 'activities', path: '/activities', title: 'Tätigkeiten', description: 'Globale Tätigkeiten/Aktivitäten.' },
  { type: 'categories', path: '/categories', title: 'Kategorien', description: 'Kategorien.' },
  { type: 'price-groups', path: '/price-groups', title: 'Preisgruppen', description: 'Preisgruppen.' },
  { type: 'absence-reasons', path: '/absence-reasons', title: 'Fehlgründe', description: 'Abwesenheits-/Fehlgründe.' },
];

/**
 * Registers the four master-data lookup tables as MCP resources under
 * `zep://master-data/{type}`. Each read paginates to completion (hard cap 500)
 * and degrades gracefully when the endpoint's module is not active for the
 * tenant (ZepApiError.isModuleGate) instead of crashing.
 */
export function registerMasterDataResources(server: McpServer): void {
  for (const { type, path, title, description } of TYPES) {
    const uri = `zep://master-data/${type}`;
    server.registerResource(
      type,
      uri,
      { title, description, mimeType: 'application/json' },
      async (resourceUri: URL) => {
        const href = resourceUri.href || uri;
        try {
          const items = await paginateAll<unknown>({ path, maxItems: 500 });
          return {
            contents: [
              {
                uri: href,
                mimeType: 'application/json',
                text: JSON.stringify({ type, count: items.length, data: items }),
              },
            ],
          };
        } catch (err) {
          const message =
            err instanceof ZepApiError
              ? err.toToolMessage()
              : err instanceof Error
                ? err.message
                : String(err);
          logger.error({ resource: type, err: message }, 'resource_error');
          return {
            contents: [
              {
                uri: href,
                mimeType: 'application/json',
                text: JSON.stringify({
                  type,
                  error: message,
                  moduleGate: err instanceof ZepApiError ? err.isModuleGate : false,
                }),
              },
            ],
          };
        }
      },
    );
  }
}
