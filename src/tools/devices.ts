import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runList, runGet } from '../lib/toolHelpers.js';
import { PaginationInput, AutoPaginateInput } from '../schemas/common.js';
import { DeviceId } from '../schemas/identifiers.js';
import { READ_ONLY } from '../schemas/annotations.js';

const list = { ...PaginationInput.shape, ...AutoPaginateInput.shape };

// ── input schemas (exported for unit tests) ──────────────────────────────────
export const ListDevicesInput = z.object({ ...list }).strict();
export const GetDeviceInput = z.object({ id: DeviceId }).strict();

export function registerDeviceTools(server: McpServer): void {
  // ── reads ──────────────────────────────────────────────────────────────────
  server.registerTool(
    'zep_list_devices',
    {
      title: 'Terminals auflisten',
      description:
        'Listet ZEP-Terminals (Erfassungs-/Stempel-Geräte). Paginiert mit limit/page; ' +
        'auto_paginate=true lädt alle Seiten (Hard-Cap 500). ' +
        'Returns: Array mit id, type, status, name, track, employees_count, categories_count.',
      inputSchema: ListDevicesInput.shape,
      annotations: READ_ONLY,
    },
    async (input) => runList({ tool: 'zep_list_devices', path: '/devices', input, noun: 'Terminals' }),
  );

  server.registerTool(
    'zep_get_device',
    {
      title: 'Terminal-Details abrufen',
      description:
        'Holt ein Terminal per numerischer ID. Param id ist eine Zahl (z.B. 12), NICHT der Name. ' +
        'Returns: Terminal-Objekt mit id, type, status, name, track, employees, categories.',
      inputSchema: GetDeviceInput.shape,
      annotations: READ_ONLY,
    },
    async ({ id }) =>
      runGet({ tool: 'zep_get_device', path: `/devices/${id}`, summary: `Terminal ${id} geladen.`, ctx: { id } }),
  );
}
