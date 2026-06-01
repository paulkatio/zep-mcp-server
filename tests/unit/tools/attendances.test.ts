import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { ZepApiError } from '../../../src/client/errors.js';
import type { ToolResult } from '../../../src/lib/toolResult.js';

vi.mock('../../../src/client/http.js', () => ({ zepRequest: vi.fn() }));
import { zepRequest } from '../../../src/client/http.js';
import {
  registerAttendanceTools,
  ListAttendancesInput,
  GetAttendanceInput,
  CreateAttendanceInput,
} from '../../../src/tools/attendances.js';
import { captureTools } from '../../helpers/capture.js';

const mockReq = vi.mocked(zepRequest);
const tools = captureTools(registerAttendanceTools);
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../fixtures/zep-responses/${name}.json`, import.meta.url), 'utf8'));
const call = (name: string, args: Record<string, unknown>): Promise<ToolResult> =>
  tools.get(name)!.handler(args) as Promise<ToolResult>;

beforeEach(() => {
  mockReq.mockReset();
});

describe('registry', () => {
  it('registers 3 attendance tools', () => {
    expect(tools.size).toBe(3);
  });
});

describe('zep_list_attendances', () => {
  it('forwards limit/page/filters as query', async () => {
    mockReq.mockResolvedValueOnce(fixture('attendances_list'));
    await call('zep_list_attendances', {
      limit: 3,
      page: 1,
      employee_id: 'jane.roe',
      start_date: '2023-07-01',
      end_date: '2023-07-31',
    });
    expect(mockReq).toHaveBeenCalledWith({
      method: 'GET',
      path: '/attendances',
      query: { limit: 3, page: 1, employee_id: 'jane.roe', start_date: '2023-07-01', end_date: '2023-07-31' },
    });
  });

  it('auto_paginate aggregates into { data, count }', async () => {
    mockReq.mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }], meta: { last_page: 1 } });
    const res = await call('zep_list_attendances', { auto_paginate: true, max_items: 50 });
    expect(res.structuredContent).toMatchObject({ count: 2 });
  });
});

describe('zep_get_attendance', () => {
  it('happy path: correct path + structuredContent + summary', async () => {
    const body = fixture('attendance_detail');
    mockReq.mockResolvedValueOnce(body);
    const res = await call('zep_get_attendance', { id: 97 });
    expect(mockReq).toHaveBeenCalledWith({ method: 'GET', path: '/attendances/97' });
    expect(res.structuredContent).toEqual(body);
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain('97');
  });

  it('404 → isError', async () => {
    mockReq.mockRejectedValueOnce(new ZepApiError({ status: 404, message: 'Not found' }));
    const res = await call('zep_get_attendance', { id: 999 });
    expect(res.isError).toBe(true);
  });

  it('module-gate 404 → friendly licence message', async () => {
    mockReq.mockRejectedValueOnce(
      new ZepApiError({ status: 404, message: 'The route x could not be found.', isModuleGate: true }),
    );
    const res = await call('zep_get_attendance', { id: 999 });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Modul\/Lizenz nicht aktiviert/);
  });
});

describe('zep_create_attendance', () => {
  it('POSTs the body to /attendances and returns ok', async () => {
    const body = fixture('attendance_detail');
    mockReq.mockResolvedValueOnce(body);
    const input = { employee_id: 'jane.roe', date: '2023-07-31', from: '12:38', to: '17:39' };
    const res = await call('zep_create_attendance', input);
    expect(mockReq).toHaveBeenCalledWith({ method: 'POST', path: '/attendances', body: input });
    expect(res.structuredContent).toEqual(body);
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain('Projektzeit angelegt.');
  });
});

describe('input validation (strict)', () => {
  it('ListAttendancesInput rejects unknown keys', () => {
    expect(ListAttendancesInput.safeParse({ employee_id: 'x', evil: 1 }).success).toBe(false);
  });
  it('GetAttendanceInput rejects unknown keys', () => {
    expect(GetAttendanceInput.safeParse({ id: 97, foo: 1 }).success).toBe(false);
  });
  it('GetAttendanceInput requires id', () => {
    expect(GetAttendanceInput.safeParse({}).success).toBe(false);
  });
  it('CreateAttendanceInput requires employee_id/date/from/to', () => {
    expect(CreateAttendanceInput.safeParse({ employee_id: 'jane.roe' }).success).toBe(false);
    expect(
      CreateAttendanceInput.safeParse({ employee_id: 'jane.roe', date: '2023-07-31', from: '12:38', to: '17:39' })
        .success,
    ).toBe(true);
  });
});
