import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolResult } from '../../../src/lib/toolResult.js';

vi.mock('../../../src/client/http.js', () => ({ zepRequest: vi.fn() }));
import { zepRequest } from '../../../src/client/http.js';
import {
  registerInsightTools,
  TeamStatusInput,
  AttendanceSummaryInput,
  VacationBalanceInput,
  PendingAbsencesInput,
} from '../../../src/tools/insights.js';
import { captureTools } from '../../helpers/capture.js';

const mockReq = vi.mocked(zepRequest);
const tools = captureTools(registerInsightTools);
const call = (name: string, args: Record<string, unknown>): Promise<ToolResult> =>
  tools.get(name)!.handler(args) as Promise<ToolResult>;

/** Route a single zepRequest mock by path → one-page list ({data, meta.last_page=1}). */
type Req = { path: string };
function routeByPath(routes: Record<string, unknown[]>): void {
  mockReq.mockImplementation((req: unknown) => {
    const { path } = req as Req;
    const data = routes[path] ?? [];
    return Promise.resolve({ data, meta: { last_page: 1 } } as never);
  });
}

beforeEach(() => {
  mockReq.mockReset();
});

describe('registry', () => {
  it('registers 4 insight tools', () => {
    expect(tools.size).toBe(4);
    expect([...tools.keys()].sort()).toEqual([
      'zep_get_employee_attendance_summary',
      'zep_get_employee_vacation_balance',
      'zep_get_team_status_today',
      'zep_list_pending_absences',
    ]);
  });
  it('all are read-only', () => {
    for (const t of tools.values()) expect(t.config.annotations?.readOnlyHint).toBe(true);
  });
});

describe('zep_get_team_status_today', () => {
  const roster = [
    { username: 'a.one' },
    { username: 'b.two' },
    { username: 'c.three' },
  ];
  it('partitions roster into present / absent / no_record (incl. multi-day absence overlap)', async () => {
    routeByPath({
      '/employees': roster,
      '/attendances': [{ id: 1, date: '2026-06-01T00:00:00Z', employee_id: 'a.one', duration: 1 }],
      '/absences': [
        {
          id: 9,
          employee_id: 'b.two',
          start_date: '2026-05-30T00:00:00Z', // started earlier…
          end_date: '2026-06-02T00:00:00Z', // …ends later → covers the day
          absence_reason_id: 'UB',
          approved: true,
          absenceReason: { comment: 'Urlaub bezahlt|en:Paid leave' },
        },
      ],
    });
    const res = await call('zep_get_team_status_today', { date: '2026-06-01' });
    const sc = res.structuredContent as {
      present: string[];
      absent: { employee_id: string; reason: string }[];
      no_record: string[];
      total_employees: number;
    };
    expect(sc.present).toEqual(['a.one']);
    expect(sc.absent).toEqual([{ employee_id: 'b.two', absence_reason_id: 'UB', reason: 'Urlaub bezahlt' }]);
    expect(sc.no_record).toEqual(['c.three']);
    expect(sc.total_employees).toBe(3);
    expect(res.content[0].text).toMatch(/Team-Status 2026-06-01/);
  });

  it('department_id routes the roster to the department endpoint', async () => {
    routeByPath({ '/departments/3/employees': roster, '/attendances': [], '/absences': [] });
    await call('zep_get_team_status_today', { date: '2026-06-01', department_id: 3 });
    const paths = mockReq.mock.calls.map((c) => (c[0] as Req).path);
    expect(paths).toContain('/departments/3/employees');
    expect(paths).not.toContain('/employees');
  });
});

describe('zep_get_employee_attendance_summary', () => {
  it('sums duration and groups entries by day', async () => {
    routeByPath({
      '/attendances': [
        { id: 1, date: '2026-05-04T00:00:00Z', employee_id: 'a.one', duration: 2.5, from: '09:00:00', to: '11:30:00' },
        { id: 2, date: '2026-05-04T00:00:00Z', employee_id: 'a.one', duration: 1.5, from: '13:00:00', to: '14:30:00' },
        { id: 3, date: '2026-05-05T00:00:00Z', employee_id: 'a.one', duration: 8, from: '08:00:00', to: '16:00:00' },
      ],
    });
    const res = await call('zep_get_employee_attendance_summary', {
      username: 'a.one',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    });
    const sc = res.structuredContent as {
      total_hours: number;
      days_with_records: number;
      entry_count: number;
      daily_breakdown: { date: string; hours: number; entries: unknown[] }[];
    };
    expect(sc.total_hours).toBe(12);
    expect(sc.days_with_records).toBe(2);
    expect(sc.entry_count).toBe(3);
    expect(sc.daily_breakdown[0]).toMatchObject({ date: '2026-05-04', hours: 4 });
    expect(sc.daily_breakdown[0].entries).toHaveLength(2);
  });

  it('forwards employee_id + date range as the attendance query', async () => {
    routeByPath({ '/attendances': [] });
    await call('zep_get_employee_attendance_summary', { username: 'a.one', start_date: '2026-05-01', end_date: '2026-05-31' });
    const firstCall = mockReq.mock.calls[0][0] as { query: Record<string, unknown> };
    expect(firstCall.query).toMatchObject({ employee_id: 'a.one', start_date: '2026-05-01', end_date: '2026-05-31' });
  });
});

describe('zep_get_employee_vacation_balance', () => {
  it('counts each leave application once (shared appId), spans no-application rows, filters by reason', async () => {
    routeByPath({
      '/employees/max.mustermann/employment-periods': [
        { id: 14, start_date: '2023-09-25T00:00:00Z', end_date: null, annual_leave_entitlement: 30, is_holiday_per_year: true },
      ],
      '/absences': [
        // application 50 materialises as TWO rows; number_of_days=5 is the whole-app total → count once
        {
          id: 1, employee_id: 'max.mustermann', absence_reason_id: 'UB', approved: true,
          start_date: '2026-02-02T00:00:00Z', end_date: '2026-02-06T00:00:00Z',
          leaveApprovalApplication: { id: 50, number_of_days: '5', status: { name: 'genehmigt' } },
        },
        {
          id: 2, employee_id: 'max.mustermann', absence_reason_id: 'UB', approved: true,
          start_date: '2026-07-24T00:00:00Z', end_date: '2026-07-25T00:00:00Z',
          leaveApprovalApplication: { id: 50, number_of_days: '5', status: { name: 'genehmigt' } },
        },
        // pending application 60 → 2 days
        {
          id: 3, employee_id: 'max.mustermann', absence_reason_id: 'UB', approved: false,
          start_date: '2026-04-01T00:00:00Z', end_date: '2026-04-02T00:00:00Z',
          leaveApprovalApplication: { id: 60, number_of_days: '2', status: { name: 'offen' } },
        },
        // approved UB, NO application → inclusive calendar-day span (Mon..Wed = 3)
        {
          id: 4, employee_id: 'max.mustermann', absence_reason_id: 'UB', approved: true,
          start_date: '2026-03-02T00:00:00Z', end_date: '2026-03-04T00:00:00Z',
        },
        // sick leave → excluded by reason filter
        {
          id: 5, employee_id: 'max.mustermann', absence_reason_id: 'KR', approved: true,
          start_date: '2026-01-05T00:00:00Z', end_date: '2026-01-05T00:00:00Z',
        },
      ],
    });
    const res = await call('zep_get_employee_vacation_balance', { username: 'max.mustermann', year: 2026 });
    const sc = res.structuredContent as {
      entitlement: number; taken: number; pending: number; remaining: number;
      employment_period_id: number; absences: { id: number; days: number; application_id: number | null }[];
    };
    expect(sc.entitlement).toBe(30);
    expect(sc.taken).toBe(8); // app50 (5, once) + no-app span (3)
    expect(sc.pending).toBe(2); // app60
    expect(sc.remaining).toBe(22);
    expect(sc.employment_period_id).toBe(14);
    expect(sc.absences).toHaveLength(4); // UB rows only
    // the duplicate row of application 50 contributes 0 (already counted), sum stays correct
    expect(sc.absences.find((a) => a.id === 1)).toMatchObject({ days: 5, application_id: 50 });
    expect(sc.absences.find((a) => a.id === 2)).toMatchObject({ days: 0, application_id: 50 });
    expect(sc.absences.find((a) => a.id === 4)).toMatchObject({ days: 3, application_id: null });
    expect(sc.absences.reduce((s, a) => s + a.days, 0)).toBe(10); // = taken + pending
  });

  it('honours a custom vacation_reason_id', async () => {
    routeByPath({
      '/employees/x/employment-periods': [],
      '/absences': [
        { id: 1, employee_id: 'x', absence_reason_id: 'URLAUB', approved: true, start_date: '2026-06-01T00:00:00Z', end_date: '2026-06-01T00:00:00Z' },
      ],
    });
    const res = await call('zep_get_employee_vacation_balance', { username: 'x', year: 2026, vacation_reason_id: 'URLAUB' });
    const sc = res.structuredContent as { taken: number; absences: unknown[]; entitlement: number };
    expect(sc.entitlement).toBe(0); // no employment period
    expect(sc.taken).toBe(1);
    expect(sc.absences).toHaveLength(1);
  });
});

describe('zep_list_pending_absences', () => {
  it('keeps only absences where approved !== true', async () => {
    routeByPath({
      '/absences': [
        { id: 1, employee_id: 'a', absence_reason_id: 'UB', approved: true, start_date: '2026-06-01T00:00:00Z', end_date: '2026-06-01T00:00:00Z' },
        { id: 2, employee_id: 'b', absence_reason_id: 'UB', approved: false, start_date: '2026-06-02T00:00:00Z', end_date: '2026-06-02T00:00:00Z', absenceReason: { comment: 'Urlaub bezahlt|en' } },
        { id: 3, employee_id: 'c', absence_reason_id: 'KR', approved: null, start_date: '2026-06-03T00:00:00Z', end_date: '2026-06-03T00:00:00Z' },
      ],
    });
    const res = await call('zep_list_pending_absences', {});
    const sc = res.structuredContent as { count: number; data: { id: number; reason: string }[] };
    expect(sc.count).toBe(2);
    expect(sc.data.map((d) => d.id)).toEqual([2, 3]);
    expect(sc.data[0].reason).toBe('Urlaub bezahlt');
  });

  it('forwards employee_id filter to the query', async () => {
    routeByPath({ '/absences': [] });
    await call('zep_list_pending_absences', { employee_id: 'jane.roe' });
    const firstCall = mockReq.mock.calls[0][0] as { query: Record<string, unknown> };
    expect(firstCall.query).toMatchObject({ employee_id: 'jane.roe' });
  });
});

describe('input validation (strict)', () => {
  it('TeamStatusInput rejects unknown keys + bad date', () => {
    expect(TeamStatusInput.safeParse({ evil: 1 }).success).toBe(false);
    expect(TeamStatusInput.safeParse({ date: '01.06.2026' }).success).toBe(false);
    expect(TeamStatusInput.safeParse({ date: '2026-06-01', department_id: 3 }).success).toBe(true);
  });
  it('AttendanceSummaryInput requires username + both dates', () => {
    expect(AttendanceSummaryInput.safeParse({ username: 'a' }).success).toBe(false);
    expect(AttendanceSummaryInput.safeParse({ username: 'a', start_date: '2026-05-01', end_date: '2026-05-31' }).success).toBe(true);
  });
  it('VacationBalanceInput accepts just username; rejects unknown keys', () => {
    expect(VacationBalanceInput.safeParse({ username: 'a' }).success).toBe(true);
    expect(VacationBalanceInput.safeParse({ username: 'a', foo: 1 }).success).toBe(false);
  });
  it('PendingAbsencesInput accepts empty; rejects unknown keys', () => {
    expect(PendingAbsencesInput.safeParse({}).success).toBe(true);
    expect(PendingAbsencesInput.safeParse({ bar: 1 }).success).toBe(false);
  });
});
