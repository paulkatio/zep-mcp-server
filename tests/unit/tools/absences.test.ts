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
  it('CreateAbsenceInput requires employee_id/absence_reason_id/start_date/end_date', () => {
    expect(CreateAbsenceInput.safeParse({ employee_id: 'user4' }).success).toBe(false);
    expect(
      CreateAbsenceInput.safeParse({
        employee_id: 'user4',
        absence_reason_id: 'KR',
        start_date: '2023-08-09',
        end_date: '2023-08-09',
      }).success,
    ).toBe(true);
  });
});

describe('zep_list_absences', () => {
  it('forwards limit/page/filters as query', async () => {
    mockReq.mockResolvedValueOnce(fixture('absences_list'));
    await call('zep_list_absences', { limit: 3, page: 1, employee_id: 'user4', start_date: '2023-08-01' });
    expect(mockReq).toHaveBeenCalledWith({
      method: 'GET',
      path: '/absences',
      query: { limit: 3, page: 1, employee_id: 'user4', start_date: '2023-08-01' },
    });
  });

  it('auto_paginate aggregates into { data, count }', async () => {
    mockReq.mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }], meta: { last_page: 1 } });
    const res = await call('zep_list_absences', { auto_paginate: true, max_items: 50 });
    expect(res.structuredContent).toMatchObject({ count: 2 });
  });
});

describe('zep_create_absence', () => {
  it('POSTs the body to /absences and reports success', async () => {
    const body = {
      employee_id: 'user4',
      absence_reason_id: 'KR',
      start_date: '2023-08-09',
      end_date: '2023-08-09',
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
