import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { ZepApiError } from '../../../src/client/errors.js';
import type { ToolResult } from '../../../src/lib/toolResult.js';

vi.mock('../../../src/client/http.js', () => ({ zepRequest: vi.fn() }));
import { zepRequest } from '../../../src/client/http.js';
import {
  registerAbsenceTools,
  ListAbsencesInput,
  GetAbsenceInput,
  CreateAbsenceInput,
} from '../../../src/tools/absences.js';
import { captureTools } from '../../helpers/capture.js';

const mockReq = vi.mocked(zepRequest);
const tools = captureTools(registerAbsenceTools);
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../fixtures/zep-responses/${name}.json`, import.meta.url), 'utf8'));
const call = (name: string, args: Record<string, unknown>): Promise<ToolResult> =>
  tools.get(name)!.handler(args) as Promise<ToolResult>;

beforeEach(() => {
  mockReq.mockReset();
});

describe('registry', () => {
  it('registers 3 absence tools', () => {
    expect(tools.size).toBe(3);
  });
});

describe('zep_get_absence', () => {
  it('happy path: correct path + structuredContent + summary', async () => {
    const body = fixture('absence_detail');
    mockReq.mockResolvedValueOnce(body);
    const res = await call('zep_get_absence', { id: 21 });
    expect(mockReq).toHaveBeenCalledWith({ method: 'GET', path: '/absences/21' });
    expect(res.structuredContent).toEqual(body);
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain('21');
  });

  it('404 → isError', async () => {
    mockReq.mockRejectedValueOnce(new ZepApiError({ status: 404, message: 'Not found' }));
    const res = await call('zep_get_absence', { id: 999 });
    expect(res.isError).toBe(true);
  });

  it('module-gate 404 → friendly licence message', async () => {
    mockReq.mockRejectedValueOnce(
      new ZepApiError({ status: 404, message: 'The route x could not be found.', isModuleGate: true }),
    );
    const res = await call('zep_get_absence', { id: 999 });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Modul\/Lizenz nicht aktiviert/);
  });
});

describe('input validation (strict)', () => {
  it('GetAbsenceInput rejects unknown keys', () => {
    expect(GetAbsenceInput.safeParse({ id: 1, evil: 1 }).success).toBe(false);
  });
  it('GetAbsenceInput requires id', () => {
    expect(GetAbsenceInput.safeParse({}).success).toBe(false);
  });
  it('ListAbsencesInput rejects unknown keys', () => {
    expect(ListAbsencesInput.safeParse({ foo: 1 }).success).toBe(false);
  });
  it('CreateAbsenceInput requires employee_id/absence_reason_id/from/to (dates)', () => {
    expect(CreateAbsenceInput.safeParse({ employee_id: 'user4' }).success).toBe(false);
    expect(
      CreateAbsenceInput.safeParse({
        employee_id: 'user4',
        absence_reason_id: 'KR',
        from: '2023-08-09',
        to: '2023-08-09',
      }).success,
    ).toBe(true);
  });
});

describe('zep_list_absences', () => {
  it('no date filter → forwards limit/page/filters as query (passthrough)', async () => {
    mockReq.mockResolvedValueOnce(fixture('absences_list'));
    await call('zep_list_absences', { limit: 3, page: 1, employee_id: 'user4' });
    expect(mockReq).toHaveBeenCalledWith({
      method: 'GET',
      path: '/absences',
      query: { limit: 3, page: 1, employee_id: 'user4' },
    });
  });

  it('auto_paginate aggregates into { data, count }', async () => {
    mockReq.mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }], meta: { last_page: 1 } });
    const res = await call('zep_list_absences', { auto_paginate: true, max_items: 50 });
    expect(res.structuredContent).toMatchObject({ count: 2 });
  });

  // Regression: ZEP filters absences by START date only, so a query on a single
  // day used to miss a multi-day absence that began earlier. The tool now widens
  // the ZEP query and keeps only rows that truly overlap the window.
  it('date filter → widens the ZEP query and keeps only overlapping rows', async () => {
    mockReq.mockResolvedValueOnce({
      data: [
        // 5-day vacation that STARTED before the queried day but covers it
        { id: 726, employee_id: 'v', start_date: '2026-06-22T00:00:00Z', end_date: '2026-06-26T00:00:00Z' },
        // unrelated row that does not overlap 2026-06-23 → must be dropped
        { id: 999, employee_id: 'v', start_date: '2026-01-01T00:00:00Z', end_date: '2026-01-02T00:00:00Z' },
      ],
      meta: { last_page: 1 },
    });
    const res = await call('zep_list_absences', { employee_id: 'v', start_date: '2026-06-23', end_date: '2026-06-23' });

    // both bounds widened by the slack (ZEP requires full containment)
    const q = (mockReq.mock.calls[0][0] as { query: Record<string, unknown> }).query;
    expect(q.employee_id).toBe('v');
    expect(q.start_date).toBe('2025-06-22'); // 2026-06-23 − 366 days
    expect(q.end_date).toBe('2027-06-24'); // 2026-06-23 + 366 days

    const sc = res.structuredContent as { count: number; data: { id: number }[] };
    expect(sc.data.map((d) => d.id)).toEqual([726]);
    expect(sc.count).toBe(1);
  });
});

describe('zep_create_absence', () => {
  it('POSTs the body to /absences and reports success', async () => {
    const body = {
      employee_id: 'user4',
      absence_reason_id: 'KR',
      from: '2023-08-09',
      to: '2023-08-09',
    };
    mockReq.mockResolvedValueOnce(fixture('absence_detail'));
    const res = await call('zep_create_absence', body);
    expect(mockReq).toHaveBeenCalledWith({ method: 'POST', path: '/absences', body });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toBe('Abwesenheit angelegt.');
  });

  it('description warns the absence cannot be changed via API', () => {
    expect(tools.get('zep_create_absence')!.config.description).toMatch(
      /nicht via API geändert oder gelöscht/,
    );
  });
});
