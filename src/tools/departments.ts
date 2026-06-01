import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runList, runGet } from '../lib/toolHelpers.js';
import { PaginationInput, AutoPaginateInput } from '../schemas/common.js';
import { DepartmentId } from '../schemas/identifiers.js';
import { READ_ONLY } from '../schemas/annotations.js';

const list = { ...PaginationInput.shape, ...AutoPaginateInput.shape };

// ── input schemas (exported for unit tests) ──────────────────────────────────
export const ListDepartmentsInput = z.object({ ...list }).strict();
export const GetDepartmentInput = z.object({ id: DepartmentId }).strict();
export const DepartmentSubListInput = z.object({ id: DepartmentId, ...list }).strict();

export function registerDepartmentTools(server: McpServer): void {
  // ── reads ──────────────────────────────────────────────────────────────────
  server.registerTool(
    'zep_list_departments',
    {
      title: 'Abteilungen auflisten',
      description:
        'Nutze dies für eine Abteilungs-Übersicht (z.B. "alle Abteilungen mit Mitarbeiterzahl"). Keine Filter; ' +
        'auto_paginate=true lädt alle Seiten (Hard-Cap 500). ' +
        'Returns: Array mit id, parent_id, name, description, children_count.',
      inputSchema: ListDepartmentsInput.shape,
      annotations: READ_ONLY,
    },
    async (input) => runList({ tool: 'zep_list_departments', path: '/departments', input, noun: 'Abteilungen' }),
  );

  server.registerTool(
    'zep_get_department',
    {
      title: 'Abteilungs-Details abrufen',
      description:
        'Holt eine Abteilung per numerischer ID. Returns: Abteilungs-Objekt mit id, parent_id, name, ' +
        'description, manager (Array), children_count, created/modified.',
      inputSchema: GetDepartmentInput.shape,
      annotations: READ_ONLY,
    },
    async ({ id }) =>
      runGet({ tool: 'zep_get_department', path: `/departments/${id}`, summary: `Abteilung ${id} geladen.`, ctx: { id } }),
  );

  server.registerTool(
    'zep_list_department_children',
    {
      title: 'Unterabteilungen auflisten',
      description:
        'Nutze dies, um die direkten Unterabteilungen einer Abteilung zu sehen — adressiert per numerischer id. ' +
        'auto_paginate möglich. Returns: Array mit id, parent_id, name, description.',
      inputSchema: DepartmentSubListInput.shape,
      annotations: READ_ONLY,
    },
    async ({ id, ...rest }) =>
      runList({ tool: 'zep_list_department_children', path: `/departments/${id}/children`, input: rest, noun: 'Unterabteilungen' }),
  );

  server.registerTool(
    'zep_list_department_employees',
    {
      title: 'Mitarbeiter einer Abteilung',
      description:
        'Nutze dies, um die Mitarbeiter einer Abteilung zu sehen — adressiert per numerischer id. auto_paginate möglich. ' +
        'Returns: Array von Mitarbeitern mit username, firstname, lastname, email, department_id.',
      inputSchema: DepartmentSubListInput.shape,
      annotations: READ_ONLY,
    },
    async ({ id, ...rest }) =>
      runList({ tool: 'zep_list_department_employees', path: `/departments/${id}/employees`, input: rest, noun: 'Abteilungsmitarbeiter' }),
  );
}
