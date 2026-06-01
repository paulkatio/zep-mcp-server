import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { zepRequest } from '../client/http.js';
import { runList, runGet } from '../lib/toolHelpers.js';
import { toolOk, toolError } from '../lib/toolResult.js';
import { PaginationInput, AutoPaginateInput, DATE_REGEX } from '../schemas/common.js';
import { AbsenceId } from '../schemas/identifiers.js';
import { CreateAbsenceBody } from '../schemas/refinements.js';
import { READ_ONLY, WRITE_NON_DESTRUCTIVE } from '../schemas/annotations.js';

const list = { ...PaginationInput.shape, ...AutoPaginateInput.shape };

// ── input schemas (exported for unit tests) ──────────────────────────────────
export const ListAbsencesInput = z
  .object({
    ...list,
    employee_id: z.string().min(1).optional().describe('Filter nach Mitarbeiter-Username (String, nicht ID).'),
    start_date: z.string().regex(DATE_REGEX).optional().describe('Filter ab Startdatum, YYYY-MM-DD.'),
    end_date: z.string().regex(DATE_REGEX).optional().describe('Filter bis Enddatum, YYYY-MM-DD.'),
  })
  .strict();
export const GetAbsenceInput = z.object({ id: AbsenceId }).strict();
export const CreateAbsenceInput = CreateAbsenceBody;

export function registerAbsenceTools(server: McpServer): void {
  // ── reads ──────────────────────────────────────────────────────────────────
  server.registerTool(
    'zep_list_absences',
    {
      title: 'Abwesenheiten auflisten',
      description:
        'Nutze dies, um Abwesenheiten aller Mitarbeiter zu sehen (z.B. "wer ist heute nicht da?"). ' +
        'Optionale Filter: employee_id (Username, String), start_date/end_date (YYYY-MM-DD). ' +
        'Paginiert mit limit/page; auto_paginate=true lädt alle Seiten (Hard-Cap 500). ' +
        'Returns: Array mit id, employee_id, absence_reason_id, start_date, end_date, approved.',
      inputSchema: ListAbsencesInput.shape,
      annotations: READ_ONLY,
    },
    async (input) => runList({ tool: 'zep_list_absences', path: '/absences', input, noun: 'Abwesenheiten' }),
  );

  server.registerTool(
    'zep_get_absence',
    {
      title: 'Abwesenheit-Details abrufen',
      description:
        'Holt eine Abwesenheit per numerischer ID. Returns: Abwesenheits-Objekt mit employee_id, absence_reason_id, ' +
        'start_date, end_date, hours, approved, absenceReason, created/modified.',
      inputSchema: GetAbsenceInput.shape,
      annotations: READ_ONLY,
    },
    async ({ id }) =>
      runGet({ tool: 'zep_get_absence', path: `/absences/${id}`, summary: `Abwesenheit ${id} geladen.`, ctx: { id } }),
  );

  // ── writes ───────────────────────────────────────────────────────────────────
  server.registerTool(
    'zep_create_absence',
    {
      title: 'Abwesenheit anlegen',
      description:
        'Trägt eine Abwesenheit ein (z.B. Urlaub oder Krankheit). Pflichtfelder: employee_id (Username, String), ' +
        'absence_reason_id (Fehlgrund-Code, z.B. "KR", siehe zep://master-data/absence-reasons), from und to ' +
        '(Zeitraum als Datum YYYY-MM-DD). Optional: days, half_day_from, half_day_to, comment, approval_status. ' +
        'Einmal erstellt, kann eine Abwesenheit nicht via API geändert oder gelöscht werden — Änderungen müssen in der ZEP-UI erfolgen. ' +
        'Returns: angelegte Abwesenheit.',
      inputSchema: CreateAbsenceInput.shape,
      annotations: WRITE_NON_DESTRUCTIVE,
    },
    async (body) => {
      try {
        const res = await zepRequest<Record<string, unknown>>({ method: 'POST', path: '/absences', body });
        return toolOk(res, 'Abwesenheit angelegt.');
      } catch (err) {
        return toolError(err, 'zep_create_absence', { employee_id: body.employee_id });
      }
    },
  );
}
