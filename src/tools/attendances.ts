import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { zepRequest } from '../client/http.js';
import { runList, runGet } from '../lib/toolHelpers.js';
import { toolOk, toolError } from '../lib/toolResult.js';
import { PaginationInput, AutoPaginateInput } from '../schemas/common.js';
import { AttendanceId } from '../schemas/identifiers.js';
import { CreateAttendanceBody } from '../schemas/refinements.js';
import { READ_ONLY, WRITE_NON_DESTRUCTIVE } from '../schemas/annotations.js';

const list = { ...PaginationInput.shape, ...AutoPaginateInput.shape };

// ── input schemas (exported for unit tests) ──────────────────────────────────
export const ListAttendancesInput = z
  .object({
    ...list,
    employee_id: z
      .string()
      .min(1)
      .optional()
      .describe('Filter nach Mitarbeiter-Username (String, nicht numerische ID).'),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Von-Datum, YYYY-MM-DD.'),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Bis-Datum, YYYY-MM-DD.'),
  })
  .strict();
export const GetAttendanceInput = z.object({ id: AttendanceId }).strict();
export const CreateAttendanceInput = CreateAttendanceBody;

export function registerAttendanceTools(server: McpServer): void {
  // ── reads ──────────────────────────────────────────────────────────────────
  server.registerTool(
    'zep_list_attendances',
    {
      title: 'Projektzeiten auflisten',
      description:
        'Listet Projektzeiten (Attendances). Optionale Filter: employee_id (Mitarbeiter-Username, String), ' +
        'start_date/end_date (YYYY-MM-DD). Paginiert mit limit/page; auto_paginate=true lädt alle Seiten (Hard-Cap 500). ' +
        'Returns: Array mit id, date, from, to, employee_id, duration, department_id.',
      inputSchema: ListAttendancesInput.shape,
      annotations: READ_ONLY,
    },
    async (input) => runList({ tool: 'zep_list_attendances', path: '/attendances', input, noun: 'Projektzeiten' }),
  );

  server.registerTool(
    'zep_get_attendance',
    {
      title: 'Projektzeit-Details abrufen',
      description:
        'Holt eine Projektzeit per id (numerisch). Returns: Objekt mit id, date, from, to, employee_id, ' +
        'duration, note, department_id, created/modified.',
      inputSchema: GetAttendanceInput.shape,
      annotations: READ_ONLY,
    },
    async ({ id }) =>
      runGet({ tool: 'zep_get_attendance', path: `/attendances/${id}`, summary: `Projektzeit ${id} geladen.`, ctx: { id } }),
  );

  // ── writes ───────────────────────────────────────────────────────────────────
  server.registerTool(
    'zep_create_attendance',
    {
      title: 'Projektzeit anlegen',
      description:
        'Legt eine Projektzeit an. Pflichtfelder: employee_id (Mitarbeiter-Username, String), date (YYYY-MM-DD), ' +
        'from/to (HH:MM). Optional: note, department_id. Returns: angelegte Projektzeit.',
      inputSchema: CreateAttendanceInput.shape,
      annotations: WRITE_NON_DESTRUCTIVE,
    },
    async (body) => {
      try {
        const res = await zepRequest<Record<string, unknown>>({ method: 'POST', path: '/attendances', body });
        return toolOk(res, 'Projektzeit angelegt.');
      } catch (err) {
        return toolError(err, 'zep_create_attendance', { employee_id: body.employee_id });
      }
    },
  );
}
