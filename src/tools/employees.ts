import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { zepRequest } from '../client/http.js';
import { getMergePut } from '../lib/merge.js';
import { runList, runGet } from '../lib/toolHelpers.js';
import { toolOk, toolError } from '../lib/toolResult.js';
import { auditWrite } from '../lib/audit.js';
import { PaginationInput, AutoPaginateInput } from '../schemas/common.js';
import {
  EmployeeUsername,
  EmploymentPeriodId,
  InternalRateId,
  RegularWorkingTimeId,
  MealId,
} from '../schemas/identifiers.js';
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
    department_id: z.number().int().positive().optional().describe('Filter nach Abteilungs-ID. [VERIFY gegen Live-Doku]'),
  })
  .strict();
export const GetEmployeeInput = z.object({ username: EmployeeUsername }).strict();
export const EmployeeSubListInput = z.object({ username: EmployeeUsername, ...list }).strict();
export const GetEmploymentPeriodInput = z
  .object({ username: EmployeeUsername, employment_period_id: EmploymentPeriodId })
  .strict();
export const GetInternalRateInput = z
  .object({ username: EmployeeUsername, internal_rate_id: InternalRateId })
  .strict();
export const GetRegularWorkingTimeInput = z
  .object({ username: EmployeeUsername, regular_working_time_id: RegularWorkingTimeId })
  .strict();
export const GetMealInput = z.object({ username: EmployeeUsername, meal_id: MealId }).strict();
export const CreateEmployeeInput = CreateEmployeeBody;
export const UpdateEmployeeInput = z
  .object({ username: EmployeeUsername, ...UpdateEmployeeBody.omit({ username: true }).shape })
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
        'Listet ZEP-Mitarbeiter. Optionaler Filter department_id (numerisch). ' +
        'Paginiert mit limit/page; auto_paginate=true lädt alle Seiten (Hard-Cap 500). ' +
        'Returns: Array mit username, firstname, lastname, email, department_id, price_group.',
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
        'Holt einen Mitarbeiter per Username. Param username ist ein String (z.B. "max.mustermann"), ' +
        'NICHT die numerische interne ID. Returns: Mitarbeiter-Objekt mit username, firstname, lastname, ' +
        'email, department_id, employment, price_group, created/modified.',
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
        'Listet Abwesenheiten eines Mitarbeiters per Username (String, nicht ID). Paginiert; auto_paginate möglich. ' +
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
        'Listet Beschäftigungszeiträume eines Mitarbeiters (Username, String). Paginiert; auto_paginate möglich. ' +
        'Returns: Array mit id, start_date, end_date, annual_leave_entitlement.',
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
        'Holt einen Beschäftigungszeitraum per Username (String) + employment_period_id (numerisch). ' +
        'Returns: Objekt mit start_date, end_date, annual_leave_entitlement, period_holiday_entitlement.',
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
    'zep_list_employee_internal_rates',
    {
      title: 'Interne Stundensätze auflisten',
      description:
        'Listet interne Stundensätze eines Mitarbeiters (Username, String). Paginiert. ' +
        'Hinweis: in manchen Tenants/Lizenzen nicht aktiviert. Returns: Array mit id, rate, valid_from.',
      inputSchema: EmployeeSubListInput.shape,
      annotations: READ_ONLY,
    },
    async ({ username, ...rest }) =>
      runList({ tool: 'zep_list_employee_internal_rates', path: `/employees/${u(username)}/internal-rates`, input: rest, noun: 'interne Stundensätze' }),
  );

  server.registerTool(
    'zep_get_employee_internal_rate',
    {
      title: 'Interner Stundensatz-Detail',
      description:
        'Holt einen internen Stundensatz per Username (String) + internal_rate_id (numerisch). ' +
        'Hinweis: ggf. nicht lizenziert. Returns: Objekt mit rate, valid_from, valid_to.',
      inputSchema: GetInternalRateInput.shape,
      annotations: READ_ONLY,
    },
    async ({ username, internal_rate_id }) =>
      runGet({
        tool: 'zep_get_employee_internal_rate',
        path: `/employees/${u(username)}/internal-rates/${internal_rate_id}`,
        summary: `Interner Stundensatz ${internal_rate_id} von ${username} geladen.`,
        ctx: { username, internal_rate_id },
      }),
  );

  server.registerTool(
    'zep_list_employee_regular_working_times',
    {
      title: 'Regelarbeitszeiten auflisten',
      description:
        'Listet Regelarbeitszeiten eines Mitarbeiters (Username, String). Paginiert; auto_paginate möglich. ' +
        'Returns: Array mit id, weekday/hours-Struktur, valid_from.',
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
        'Holt eine Regelarbeitszeit per Username (String) + regular_working_time_id (numerisch). ' +
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
    'zep_list_employee_meals',
    {
      title: 'Mahlzeiten auflisten',
      description:
        'Listet Mahlzeiten eines Mitarbeiters (Username, String). Paginiert. ' +
        'Hinweis: in manchen Tenants/Lizenzen nicht aktiviert. Returns: Array von Mahlzeiten-Einträgen.',
      inputSchema: EmployeeSubListInput.shape,
      annotations: READ_ONLY,
    },
    async ({ username, ...rest }) =>
      runList({ tool: 'zep_list_employee_meals', path: `/employees/${u(username)}/meals`, input: rest, noun: 'Mahlzeiten' }),
  );

  server.registerTool(
    'zep_get_employee_meal',
    {
      title: 'Mahlzeit-Detail',
      description:
        'Holt eine Mahlzeit per Username (String) + meal_id (numerisch). ' +
        'Hinweis: ggf. nicht lizenziert. Returns: Mahlzeiten-Objekt.',
      inputSchema: GetMealInput.shape,
      annotations: READ_ONLY,
    },
    async ({ username, meal_id }) =>
      runGet({
        tool: 'zep_get_employee_meal',
        path: `/employees/${u(username)}/meals/${meal_id}`,
        summary: `Mahlzeit ${meal_id} von ${username} geladen.`,
        ctx: { username, meal_id },
      }),
  );

  server.registerTool(
    'zep_list_employee_projects',
    {
      title: 'Projekte eines Mitarbeiters',
      description:
        'Listet die Projekte eines Mitarbeiters (Username, String). Paginiert. ' +
        'Hinweis: in manchen Tenants/Lizenzen nicht aktiviert. Returns: Array von Projekten.',
      inputSchema: EmployeeSubListInput.shape,
      annotations: READ_ONLY,
    },
    async ({ username, ...rest }) =>
      runList({ tool: 'zep_list_employee_projects', path: `/employees/${u(username)}/projects`, input: rest, noun: 'Projekte' }),
  );

  server.registerTool(
    'zep_list_employee_transponders',
    {
      title: 'Transponder eines Mitarbeiters',
      description:
        'Listet Transponder (RFID/Chip) eines Mitarbeiters (Username, String). Paginiert. ' +
        'Returns: Array mit Transponder-Kennungen.',
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
        'Legt einen Mitarbeiter an. Pflichtfelder: username (eindeutig), firstname, lastname. ' +
        'Optional: email, department_id, abbreviation, Adresse u.a. Returns: angelegtes Mitarbeiter-Objekt.',
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
        'Aktualisiert einen Mitarbeiter per Username (String). Akzeptiert Partial-Updates: nur gesetzte Felder ' +
        'werden geändert (intern GET-merge-PUT). Returns: aktualisiertes Mitarbeiter-Objekt.',
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
        'Legt einen Beschäftigungszeitraum für einen Mitarbeiter an (Username, String). Pflicht: start_date (YYYY-MM-DD). ' +
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
        'Aktualisiert einen Beschäftigungszeitraum per Username (String) + employment_period_id (numerisch). ' +
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
