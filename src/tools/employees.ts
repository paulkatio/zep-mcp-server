import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { zepRequest } from '../client/http.js';
import { getMergePut } from '../lib/merge.js';
import { runList, runGet } from '../lib/toolHelpers.js';
import { toolOk, toolError } from '../lib/toolResult.js';
import { auditWrite } from '../lib/audit.js';
import { PaginationInput, AutoPaginateInput } from '../schemas/common.js';
import { EmployeeUsername, EmploymentPeriodId, RegularWorkingTimeId } from '../schemas/identifiers.js';
import {
  CreateEmployeeBody,
  UpdateEmployeeBody,
  CreateEmploymentPeriodBody,
  UpdateEmploymentPeriodBody,
} from '../schemas/refinements.js';
import { READ_ONLY, WRITE_NON_DESTRUCTIVE, DESTRUCTIVE } from '../schemas/annotations.js';

const list = { ...PaginationInput.shape, ...AutoPaginateInput.shape };
const u = (username: string): string => encodeURIComponent(username);

// ── input schemas (exported for unit tests) ──────────────────────────────────
export const ListEmployeesInput = z
  .object({
    ...list,
    personal_number: z
      .array(z.string())
      .optional()
      .describe('Filter nach einer oder mehreren Personalnummern (serialisiert als personal_number[]=).'),
  })
  .strict();
export const GetEmployeeInput = z.object({ username: EmployeeUsername }).strict();
export const EmployeeSubListInput = z.object({ username: EmployeeUsername, ...list }).strict();
export const GetEmploymentPeriodInput = z
  .object({ username: EmployeeUsername, employment_period_id: EmploymentPeriodId })
  .strict();
export const GetRegularWorkingTimeInput = z
  .object({ username: EmployeeUsername, regular_working_time_id: RegularWorkingTimeId })
  .strict();
export const CreateEmployeeInput = CreateEmployeeBody;
export const UpdateEmployeeInput = z
  .object({ username: EmployeeUsername, ...UpdateEmployeeBody.shape })
  .strict();
export const CreateEmploymentPeriodInput = z
  .object({ username: EmployeeUsername, ...CreateEmploymentPeriodBody.shape })
  .strict();
export const UpdateEmploymentPeriodInput = z
  .object({
    username: EmployeeUsername,
    employment_period_id: EmploymentPeriodId,
    ...UpdateEmploymentPeriodBody.shape,
  })
  .strict();

export function registerEmployeeTools(server: McpServer): void {
  // ── reads ──────────────────────────────────────────────────────────────────
  server.registerTool(
    'zep_list_employees',
    {
      title: 'Mitarbeiter auflisten',
      description:
        'Nutze dies für Mitarbeiter-Übersichten und um den Username einer Person für andere Tools zu finden. ' +
        'Filter: personal_number (eine oder mehrere Personalnummern). Paginiert mit limit/page; ' +
        'auto_paginate=true lädt alle Seiten (Hard-Cap 500). ' +
        'Returns: Array mit username, firstname, lastname, email, personal_number, department_id, price_group.',
      inputSchema: ListEmployeesInput.shape,
      annotations: READ_ONLY,
    },
    async (input) => runList({ tool: 'zep_list_employees', path: '/employees', input, noun: 'Mitarbeiter' }),
  );

  server.registerTool(
    'zep_get_employee',
    {
      title: 'Mitarbeiter-Details abrufen',
      description:
        'Nutze dies, wenn du Details zu einer bestimmten Person brauchst. Param username ist der String-Username ' +
        '(z.B. "max.mustermann"), NICHT die numerische interne ID. ' +
        'Returns: Mitarbeiter-Objekt mit username, firstname, lastname, email, department_id, employment, ' +
        'price_group, created/modified.',
      inputSchema: GetEmployeeInput.shape,
      annotations: READ_ONLY,
    },
    async ({ username }) =>
      runGet({ tool: 'zep_get_employee', path: `/employees/${u(username)}`, summary: `Mitarbeiter ${username} geladen.`, ctx: { username } }),
  );

  server.registerTool(
    'zep_list_employee_absences',
    {
      title: 'Abwesenheiten eines Mitarbeiters',
      description:
        'Nutze dies, um die Abwesenheiten (Urlaub, Krankheit) genau einer Person zu sehen — adressiert per username (String). ' +
        'Für alle Mitarbeiter zusammen nimm stattdessen zep_list_absences. Paginiert; auto_paginate möglich. ' +
        'Hinweis: Dieses Tool hat KEINE Datumsfilter. Für datums-gefilterte Abwesenheiten eines Mitarbeiters nutze ' +
        'zep_list_absences mit employee_id + start_date/end_date. ' +
        'Returns: Array von Abwesenheiten mit start_date, end_date, absence_reason_id, approved.',
      inputSchema: EmployeeSubListInput.shape,
      annotations: READ_ONLY,
    },
    async ({ username, ...rest }) =>
      runList({ tool: 'zep_list_employee_absences', path: `/employees/${u(username)}/absences`, input: rest, noun: 'Abwesenheiten' }),
  );

  server.registerTool(
    'zep_list_employee_employment_periods',
    {
      title: 'Beschäftigungszeiträume auflisten',
      description:
        'Nutze dies, um die Beschäftigungszeiträume (inkl. Urlaubsanspruch) einer Person zu sehen — per username (String). ' +
        'Paginiert; auto_paginate möglich. ' +
        'Returns: Array mit id, start_date, end_date, annual_leave_entitlement, period_holiday_entitlement.',
      inputSchema: EmployeeSubListInput.shape,
      annotations: READ_ONLY,
    },
    async ({ username, ...rest }) =>
      runList({ tool: 'zep_list_employee_employment_periods', path: `/employees/${u(username)}/employment-periods`, input: rest, noun: 'Beschäftigungszeiträume' }),
  );

  server.registerTool(
    'zep_get_employee_employment_period',
    {
      title: 'Beschäftigungszeitraum-Detail',
      description:
        'Nutze dies für die Details eines einzelnen Beschäftigungszeitraums — adressiert per username (String) + ' +
        'employment_period_id (numerisch, aus der Liste). ' +
        'Returns: Objekt mit start_date, end_date, annual_leave_entitlement, period_holiday_entitlement, day_absent_in_hours.',
      inputSchema: GetEmploymentPeriodInput.shape,
      annotations: READ_ONLY,
    },
    async ({ username, employment_period_id }) =>
      runGet({
        tool: 'zep_get_employee_employment_period',
        path: `/employees/${u(username)}/employment-periods/${employment_period_id}`,
        summary: `Beschäftigungszeitraum ${employment_period_id} von ${username} geladen.`,
        ctx: { username, employment_period_id },
      }),
  );

  server.registerTool(
    'zep_list_employee_regular_working_times',
    {
      title: 'Regelarbeitszeiten auflisten',
      description:
        'Nutze dies, um die Soll-/Regelarbeitszeiten einer Person zu sehen — per username (String). ' +
        'Paginiert; auto_paginate möglich. Returns: Array mit id, Wochentags-Stunden und Gültigkeitszeitraum.',
      inputSchema: EmployeeSubListInput.shape,
      annotations: READ_ONLY,
    },
    async ({ username, ...rest }) =>
      runList({ tool: 'zep_list_employee_regular_working_times', path: `/employees/${u(username)}/regular-working-times`, input: rest, noun: 'Regelarbeitszeiten' }),
  );

  server.registerTool(
    'zep_get_employee_regular_working_time',
    {
      title: 'Regelarbeitszeit-Detail',
      description:
        'Nutze dies für die Details einer einzelnen Regelarbeitszeit — per username (String) + ' +
        'regular_working_time_id (numerisch, aus der Liste). ' +
        'Returns: Objekt mit Wochentags-Stunden und Gültigkeitszeitraum.',
      inputSchema: GetRegularWorkingTimeInput.shape,
      annotations: READ_ONLY,
    },
    async ({ username, regular_working_time_id }) =>
      runGet({
        tool: 'zep_get_employee_regular_working_time',
        path: `/employees/${u(username)}/regular-working-times/${regular_working_time_id}`,
        summary: `Regelarbeitszeit ${regular_working_time_id} von ${username} geladen.`,
        ctx: { username, regular_working_time_id },
      }),
  );

  server.registerTool(
    'zep_list_employee_transponders',
    {
      title: 'Transponder eines Mitarbeiters',
      description:
        'Nutze dies, um die Transponder/Chip-Kennungen einer Person zu sehen (z.B. für Terminal-Zuordnung) — per username (String). ' +
        'Paginiert. Returns: Array mit Transponder-Kennungen.',
      inputSchema: EmployeeSubListInput.shape,
      annotations: READ_ONLY,
    },
    async ({ username, ...rest }) =>
      runList({ tool: 'zep_list_employee_transponders', path: `/employees/${u(username)}/transponders`, input: rest, noun: 'Transponder' }),
  );

  // ── writes ───────────────────────────────────────────────────────────────────
  server.registerTool(
    'zep_create_employee',
    {
      title: 'Mitarbeiter anlegen',
      description:
        'Legt einen neuen Mitarbeiter an. Pflicht: username (5–255, eindeutig), firstname, lastname, email, ' +
        'password (8–48 Zeichen), price_group. Optional: department_id, rights, employment, Adresse u.a. ' +
        'Returns: angelegtes Mitarbeiter-Objekt.',
      inputSchema: CreateEmployeeInput.shape,
      annotations: WRITE_NON_DESTRUCTIVE,
    },
    async (body) => {
      try {
        const res = await zepRequest<Record<string, unknown>>({ method: 'POST', path: '/employees', body });
        return toolOk(res, `Mitarbeiter ${String(body.username)} angelegt.`);
      } catch (err) {
        return toolError(err, 'zep_create_employee', { username: body.username });
      }
    },
  );

  server.registerTool(
    'zep_update_employee',
    {
      title: 'Mitarbeiter aktualisieren',
      description:
        'Aktualisiert einen Mitarbeiter per username (String). Partial-Update: nur gesetzte Felder werden geändert ' +
        '(intern GET-merge-PUT). username und Passwort werden hier nicht geändert. Returns: aktualisiertes Mitarbeiter-Objekt.',
      inputSchema: UpdateEmployeeInput.shape,
      annotations: DESTRUCTIVE,
    },
    async ({ username, ...partial }) => {
      auditWrite({ tool: 'zep_update_employee', resource_id: username, verb: 'PUT', fields: Object.keys(partial) });
      try {
        const path = `/employees/${u(username)}`;
        const result = await getMergePut({ getPath: path, putPath: path, partial });
        return toolOk(result, `Mitarbeiter ${username} aktualisiert.`);
      } catch (err) {
        return toolError(err, 'zep_update_employee', { username });
      }
    },
  );

  server.registerTool(
    'zep_create_employment_period',
    {
      title: 'Beschäftigungszeitraum anlegen',
      description:
        'Legt einen Beschäftigungszeitraum für einen Mitarbeiter an (username, String). Pflicht: start_date (YYYY-MM-DD). ' +
        'Optional: end_date, annual_leave_entitlement u.a. Returns: angelegter Zeitraum.',
      inputSchema: CreateEmploymentPeriodInput.shape,
      annotations: WRITE_NON_DESTRUCTIVE,
    },
    async ({ username, ...body }) => {
      try {
        const res = await zepRequest<Record<string, unknown>>({
          method: 'POST',
          path: `/employees/${u(username)}/employment-periods`,
          body,
        });
        return toolOk(res, `Beschäftigungszeitraum für ${username} angelegt.`);
      } catch (err) {
        return toolError(err, 'zep_create_employment_period', { username });
      }
    },
  );

  server.registerTool(
    'zep_update_employment_period',
    {
      title: 'Beschäftigungszeitraum aktualisieren',
      description:
        'Aktualisiert einen Beschäftigungszeitraum per username (String) + employment_period_id (numerisch). ' +
        'Partial-Update via GET-merge-PUT. Returns: aktualisierter Zeitraum.',
      inputSchema: UpdateEmploymentPeriodInput.shape,
      annotations: DESTRUCTIVE,
    },
    async ({ username, employment_period_id, ...partial }) => {
      auditWrite({
        tool: 'zep_update_employment_period',
        resource_id: `${username}/${employment_period_id}`,
        verb: 'PUT',
        fields: Object.keys(partial),
      });
      try {
        const path = `/employees/${u(username)}/employment-periods/${employment_period_id}`;
        const result = await getMergePut({ getPath: path, putPath: path, partial });
        return toolOk(result, `Beschäftigungszeitraum ${employment_period_id} von ${username} aktualisiert.`);
      } catch (err) {
        return toolError(err, 'zep_update_employment_period', { username, employment_period_id });
      }
    },
  );
}
