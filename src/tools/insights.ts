import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { paginateAll } from '../client/pagination.js';
import { fetchAbsencesOverlapping } from '../lib/absenceWindow.js';
import { toolOk, toolError, type ToolResult } from '../lib/toolResult.js';
import { DATE_REGEX } from '../schemas/common.js';
import { EmployeeUsername, DepartmentId } from '../schemas/identifiers.js';
import { READ_ONLY } from '../schemas/annotations.js';

/**
 * Synthetic "insight" tools. They own NO endpoint — each composes existing
 * read-only GETs (employees / attendances / absences / employment-periods) and
 * aggregates client-side. All read-only; safe to call freely.
 */

const u = (username: string): string => encodeURIComponent(username);
const dayOf = (iso: unknown): string => String(iso ?? '').slice(0, 10); // ISO datetime/date → YYYY-MM-DD
const round2 = (n: number): number => Math.round(n * 100) / 100;
const todayISO = (): string => new Date().toISOString().slice(0, 10);
const currentYear = (): number => new Date().getUTCFullYear();

// ── light shapes of the upstream JSON (only the fields we read) ───────────────
interface Employee { username: string; firstname?: string; lastname?: string; department_id?: number }
interface Attendance { id: number; date: string; from?: string; to?: string; employee_id: string; duration?: number; note?: string | null }
interface AbsenceReason { name?: string; comment?: string | null; type?: { id?: number; name?: string } }
interface LeaveApplication { id?: number; number_of_days?: string | number; status?: { id?: number; name?: string } }
interface Absence {
  id: number;
  employee_id: string;
  start_date: string;
  end_date: string;
  approved?: boolean | null;
  absence_reason_id?: string;
  absenceReason?: AbsenceReason | null;
  leaveApprovalApplication?: LeaveApplication | null;
}
interface EmploymentPeriod {
  id: number;
  start_date: string;
  end_date?: string | null;
  annual_leave_entitlement?: number;
  period_holiday_entitlement?: number;
  is_holiday_per_year?: boolean;
}

const CAP = 500;
/** Human label of an absence reason: first segment of the multi-lang comment, else the code. */
const reasonLabel = (a: Absence): string =>
  a.absenceReason?.comment?.split('|')[0]?.trim() || a.absence_reason_id || 'unbekannt';

/** Inclusive calendar-day span of one absence row (may include weekends — ZEP has no
 * per-row working-day count). Used only when a row has no leave application to defer to. */
function spanDays(a: Absence): number {
  const start = Date.parse(dayOf(a.start_date));
  const end = Date.parse(dayOf(a.end_date));
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1;
  return Math.round((end - start) / 86_400_000) + 1;
}

// ── input schemas (exported for unit tests) ───────────────────────────────────
export const TeamStatusInput = z
  .object({
    date: z.string().regex(DATE_REGEX).optional().describe('Stichtag YYYY-MM-DD (Default: heute, UTC).'),
    department_id: DepartmentId.optional().describe('Nur diese Abteilung (numerische ID). Default: alle Mitarbeiter.'),
  })
  .strict();

export const AttendanceSummaryInput = z
  .object({
    username: EmployeeUsername,
    start_date: z.string().regex(DATE_REGEX).describe('Von-Datum, YYYY-MM-DD.'),
    end_date: z.string().regex(DATE_REGEX).describe('Bis-Datum, YYYY-MM-DD (>= start_date).'),
  })
  .strict();

export const VacationBalanceInput = z
  .object({
    username: EmployeeUsername,
    year: z.number().int().min(2000).max(2100).optional().describe('Kalenderjahr (Default: aktuelles Jahr).'),
    vacation_reason_id: z
      .string()
      .min(1)
      .optional()
      .describe('Fehlgrund-Code für Urlaub (Default "UB" = Urlaub bezahlt).'),
  })
  .strict();

export const PendingAbsencesInput = z
  .object({
    employee_id: z.string().min(1).optional().describe('Nur dieser Mitarbeiter (Username, String).'),
    start_date: z.string().regex(DATE_REGEX).optional().describe('Filter ab Datum, YYYY-MM-DD.'),
    end_date: z.string().regex(DATE_REGEX).optional().describe('Filter bis Datum, YYYY-MM-DD.'),
  })
  .strict();

export function registerInsightTools(server: McpServer): void {
  // ── 1. team status for a day ────────────────────────────────────────────────
  server.registerTool(
    'zep_get_team_status_today',
    {
      title: 'Team-Status (heute)',
      description:
        'Nutze dies für "wer ist heute da / abwesend?". Aggregiert (read-only) Mitarbeiter-Roster + ' +
        'gebuchte Projektzeiten + Abwesenheiten für einen Stichtag (Default heute). Optional department_id ' +
        '(numerisch) grenzt auf eine Abteilung ein. Teilt das Roster in present (hat Zeit gebucht), ' +
        'absent (hat Abwesenheit an dem Tag) und no_record (weder noch — z.B. Wochenende/Feiertag/vergessen). ' +
        'Returns: { date, department_id, total_employees, present_count, absent_count, no_record_count, ' +
        'present[], absent[{employee_id, absence_reason_id, reason}], no_record[] }.',
      inputSchema: TeamStatusInput.shape,
      annotations: READ_ONLY,
    },
    async (input): Promise<ToolResult> => {
      const date = (input.date as string | undefined) ?? todayISO();
      const departmentId = input.department_id as number | undefined;
      try {
        const rosterPath = departmentId ? `/departments/${departmentId}/employees` : '/employees';
        // Absences: fetch by overlap (ZEP filters by start date only, so a narrow
        // [date, date] query would miss multi-day absences that began earlier).
        const [roster, attendances, absenceWin] = await Promise.all([
          paginateAll<Employee>({ path: rosterPath, maxItems: CAP }),
          paginateAll<Attendance>({ path: '/attendances', query: { start_date: date, end_date: date }, maxItems: CAP }),
          fetchAbsencesOverlapping<Absence>({ from: date, to: date, maxItems: CAP }),
        ]);
        const absences = absenceWin.items;

        const inRoster = new Set(roster.map((e) => e.username));
        const presentSet = new Set(
          attendances.filter((a) => dayOf(a.date) === date && inRoster.has(a.employee_id)).map((a) => a.employee_id),
        );
        const absentMap = new Map<string, { employee_id: string; absence_reason_id: string | undefined; reason: string }>();
        for (const a of absences) {
          if (!inRoster.has(a.employee_id)) continue;
          if (dayOf(a.start_date) <= date && date <= dayOf(a.end_date) && !absentMap.has(a.employee_id)) {
            absentMap.set(a.employee_id, { employee_id: a.employee_id, absence_reason_id: a.absence_reason_id, reason: reasonLabel(a) });
          }
        }
        const present = [...presentSet];
        const absent = [...absentMap.values()];
        const noRecord = roster
          .map((e) => e.username)
          .filter((name) => !presentSet.has(name) && !absentMap.has(name));

        const payload = {
          date,
          department_id: departmentId ?? null,
          total_employees: roster.length,
          present_count: present.length,
          absent_count: absent.length,
          no_record_count: noRecord.length,
          truncated: roster.length >= CAP || attendances.length >= CAP || absenceWin.truncated,
          present,
          absent,
          no_record: noRecord,
        };
        return toolOk(
          payload,
          `Team-Status ${date}: ${present.length} anwesend, ${absent.length} abwesend, ` +
            `${noRecord.length} ohne Eintrag (von ${roster.length}).`,
        );
      } catch (err) {
        return toolError(err, 'zep_get_team_status_today', { date, department_id: departmentId });
      }
    },
  );

  // ── 2. attendance summary for an employee over a range ──────────────────────
  server.registerTool(
    'zep_get_employee_attendance_summary',
    {
      title: 'Projektzeiten-Summe eines Mitarbeiters',
      description:
        'Nutze dies für "wie viele Stunden hat X im Zeitraum erfasst?". Lädt (read-only) die Projektzeiten eines ' +
        'Mitarbeiters (username, String) zwischen start_date und end_date und summiert client-seitig pro Tag. ' +
        'Returns: { username, start_date, end_date, total_hours, days_with_records, entry_count, ' +
        'daily_breakdown[{ date, hours, entries[{id, from, to, duration, note}] }] }.',
      inputSchema: AttendanceSummaryInput.shape,
      annotations: READ_ONLY,
    },
    async ({ username, start_date, end_date }): Promise<ToolResult> => {
      try {
        const atts = await paginateAll<Attendance>({
          path: '/attendances',
          query: { employee_id: username, start_date, end_date },
          maxItems: CAP,
        });
        const byDay = new Map<string, { date: string; hours: number; entries: unknown[] }>();
        let total = 0;
        for (const a of atts) {
          const d = dayOf(a.date);
          const dur = typeof a.duration === 'number' ? a.duration : 0;
          total += dur;
          const bucket = byDay.get(d) ?? { date: d, hours: 0, entries: [] };
          bucket.hours = round2(bucket.hours + dur);
          bucket.entries.push({ id: a.id, from: a.from, to: a.to, duration: a.duration, note: a.note });
          byDay.set(d, bucket);
        }
        const daily_breakdown = [...byDay.values()].sort((x, y) => x.date.localeCompare(y.date));
        const payload = {
          username,
          start_date,
          end_date,
          total_hours: round2(total),
          days_with_records: daily_breakdown.length,
          entry_count: atts.length,
          truncated: atts.length >= CAP,
          daily_breakdown,
        };
        return toolOk(
          payload,
          `${username}: ${round2(total)} h an ${daily_breakdown.length} Tag(en) (${start_date}…${end_date}).`,
        );
      } catch (err) {
        return toolError(err, 'zep_get_employee_attendance_summary', { username, start_date, end_date });
      }
    },
  );

  // ── 3. vacation balance for an employee in a year ───────────────────────────
  server.registerTool(
    'zep_get_employee_vacation_balance',
    {
      title: 'Urlaubskonto eines Mitarbeiters',
      description:
        'Nutze dies für "wie viel Urlaub hat X noch?". Kombiniert (read-only) den Urlaubsanspruch aus dem ' +
        'Beschäftigungszeitraum mit den genommenen/beantragten Urlaubs-Abwesenheiten eines Jahres. ' +
        'Params: username (String), year (Default aktuell), vacation_reason_id (Default "UB"). ' +
        'Tage je Abwesenheit = number_of_days des Antrags, sonst inkl. Kalendertage-Spanne (kann Wochenenden ' +
        'enthalten). Returns: { username, year, vacation_reason_id, entitlement, taken, pending, remaining, ' +
        'employment_period_id, absences[{id, start_date, end_date, days, approved, status}] }.',
      inputSchema: VacationBalanceInput.shape,
      annotations: READ_ONLY,
    },
    async (input): Promise<ToolResult> => {
      const username = input.username as string;
      const year = (input.year as number | undefined) ?? currentYear();
      const reason = (input.vacation_reason_id as string | undefined) ?? 'UB';
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      try {
        const [periods, absenceWin] = await Promise.all([
          paginateAll<EmploymentPeriod>({ path: `/employees/${u(username)}/employment-periods`, maxItems: CAP }),
          // Overlap fetch: ZEP filters by containment, so a plain [yearStart, yearEnd]
          // query would drop a leave that straddles the year boundary entirely.
          fetchAbsencesOverlapping<Absence>({ employee_id: username, from: yearStart, to: yearEnd, maxItems: CAP }),
        ]);
        const absences = absenceWin.items;
        // Period overlapping the year: starts on/before year-end AND (open-ended OR ends on/after year-start).
        const covering = periods.find(
          (p) => dayOf(p.start_date) <= yearEnd && (p.end_date == null || dayOf(p.end_date) >= yearStart),
        );
        const entitlement = covering
          ? (covering.is_holiday_per_year ? covering.annual_leave_entitlement : covering.period_holiday_entitlement) ?? 0
          : 0;

        // A multi-day leave can materialise as several absence rows that all share ONE
        // leaveApprovalApplication, whose number_of_days is the TOTAL for the application
        // (NOT per row). Count each application's number_of_days exactly once; rows without
        // an application fall back to their own calendar-day span. (Verified live: appId 206
        // → rows 489/490/491 all carry number_of_days=3.5 for a single 3.5-day leave.)
        const vac = absences.filter((a) => a.absence_reason_id === reason);
        let taken = 0;
        let pending = 0;
        const seenApp = new Set<number>();
        const detail = vac.map((a) => {
          const app = a.leaveApprovalApplication;
          const appId = typeof app?.id === 'number' ? app.id : null;
          const appDays =
            app?.number_of_days !== undefined && app.number_of_days !== null && app.number_of_days !== ''
              ? Number.parseFloat(String(app.number_of_days))
              : NaN;
          let days: number;
          if (appId !== null && !Number.isNaN(appDays)) {
            days = seenApp.has(appId) ? 0 : appDays; // each application counted once
            seenApp.add(appId);
          } else {
            days = spanDays(a);
          }
          if (a.approved === true) taken += days;
          else pending += days;
          return {
            id: a.id,
            start_date: dayOf(a.start_date),
            end_date: dayOf(a.end_date),
            days,
            approved: a.approved ?? false,
            application_id: appId,
            status: app?.status?.name ?? null,
          };
        });
        const payload = {
          username,
          year,
          vacation_reason_id: reason,
          entitlement,
          taken: round2(taken),
          pending: round2(pending),
          remaining: round2(entitlement - taken),
          employment_period_id: covering?.id ?? null,
          counting_note:
            'taken/pending zählen number_of_days je Antrag genau einmal (mehrtägiger Urlaub kann als ' +
            'mehrere Zeilen mit gemeinsamem Antrag erscheinen); days=0 = bereits über eine andere Zeile ' +
            'desselben Antrags gezählt. Zeilen ohne Antrag: inkl. Kalendertage-Spanne. remaining ohne ' +
            'Übertrag aus Vorjahr — negativ ist möglich. Jahresübergreifender Urlaub wird mit seinen ' +
            'vollen Antragstagen jedem berührten Jahr zugerechnet.',
          truncated: absenceWin.truncated,
          absences: detail,
        };
        return toolOk(
          payload,
          `${username} Urlaub ${year}: ${round2(taken)} von ${entitlement} Tagen genommen, ` +
            `${round2(entitlement - taken)} Rest${pending ? `, ${round2(pending)} beantragt` : ''}.`,
        );
      } catch (err) {
        return toolError(err, 'zep_get_employee_vacation_balance', { username, year });
      }
    },
  );

  // ── 4. pending (not-yet-approved) absences ──────────────────────────────────
  server.registerTool(
    'zep_list_pending_absences',
    {
      title: 'Offene Abwesenheitsanträge',
      description:
        'Nutze dies für "welche Urlaubs-/Abwesenheitsanträge sind offen?". Lädt (read-only) Abwesenheiten und ' +
        'filtert client-seitig auf nicht genehmigte (approved !== true). Optionale Filter: employee_id (Username), ' +
        'start_date/end_date (YYYY-MM-DD) — findet alle Abwesenheiten, die sich mit dem Zeitraum ÜBERSCHNEIDEN ' +
        '(auch mehrtägige, die vor dem Zeitraum beginnen). Returns: { count, data[{id, employee_id, ' +
        'absence_reason_id, reason, start_date, end_date, approved, status}] }.',
      inputSchema: PendingAbsencesInput.shape,
      annotations: READ_ONLY,
    },
    async (input): Promise<ToolResult> => {
      const { employee_id, start_date, end_date } = input as {
        employee_id?: string;
        start_date?: string;
        end_date?: string;
      };
      try {
        const { items, scanned, truncated } = await fetchAbsencesOverlapping<Absence>({
          employee_id,
          from: start_date,
          to: end_date,
          maxItems: CAP,
        });
        const data = items
          .filter((a) => a.approved !== true)
          .map((a) => ({
            id: a.id,
            employee_id: a.employee_id,
            absence_reason_id: a.absence_reason_id,
            reason: reasonLabel(a),
            start_date: dayOf(a.start_date),
            end_date: dayOf(a.end_date),
            approved: a.approved ?? false,
            status: a.leaveApprovalApplication?.status?.name ?? null,
          }));
        return toolOk(
          { count: data.length, scanned, truncated, data },
          `${data.length} offene/nicht genehmigte Abwesenheit(en).` +
            (truncated ? ' Achtung: 500er Scan-Limit erreicht — mit Datumsfilter (start_date/end_date) eingrenzen.' : ''),
        );
      } catch (err) {
        return toolError(err, 'zep_list_pending_absences', { employee_id });
      }
    },
  );
}
