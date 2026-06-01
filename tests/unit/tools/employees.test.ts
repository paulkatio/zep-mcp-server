import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { ZepApiError } from '../../../src/client/errors.js';
import type { ToolResult } from '../../../src/lib/toolResult.js';

vi.mock('../../../src/client/http.js', () => ({ zepRequest: vi.fn() }));
import { zepRequest } from '../../../src/client/http.js';
import {
  registerEmployeeTools,
  GetEmployeeInput,
  EmployeeSubListInput,
  UpdateEmployeeInput,
  CreateEmployeeInput,
} from '../../../src/tools/employees.js';
import { captureTools } from '../../helpers/capture.js';

const mockReq = vi.mocked(zepRequest);
const tools = captureTools(registerEmployeeTools);
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../fixtures/zep-responses/${name}.json`, import.meta.url), 'utf8'));
const call = (name: string, args: Record<string, unknown>): Promise<ToolResult> =>
  tools.get(name)!.handler(args) as Promise<ToolResult>;

beforeEach(() => {
  mockReq.mockReset();
});

describe('registry', () => {
  it('registers 12 employee tools (module-gated subs trimmed)', () => {
    expect(tools.size).toBe(12);
  });
});

describe('zep_get_employee', () => {
  it('happy path: correct path + structuredContent + summary', async () => {
    const body = fixture('employee_detail');
    mockReq.mockResolvedValueOnce(body);
    const res = await call('zep_get_employee', { username: 'max.mustermann' });
    expect(mockReq).toHaveBeenCalledWith({ method: 'GET', path: '/employees/max.mustermann' });
    expect(res.structuredContent).toEqual(body);
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain('max.mustermann');
  });

  it('encodeURIComponent escapes special characters in username', async () => {
    mockReq.mockResolvedValueOnce({ data: {} });
    await call('zep_get_employee', { username: 'a.b c+d' });
    expect(mockReq).toHaveBeenCalledWith({ method: 'GET', path: '/employees/a.b%20c%2Bd' });
  });

  it('404 → isError', async () => {
    mockReq.mockRejectedValueOnce(new ZepApiError({ status: 404, message: 'Not found' }));
    const res = await call('zep_get_employee', { username: 'ghost' });
    expect(res.isError).toBe(true);
  });

  it('module-gate 404 → friendly licence message', async () => {
    mockReq.mockRejectedValueOnce(
      new ZepApiError({ status: 404, message: 'The route x could not be found.', isModuleGate: true }),
    );
    const res = await call('zep_get_employee', { username: 'ghost' });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Modul\/Lizenz nicht aktiviert/);
  });
});

describe('input validation (strict)', () => {
  it('GetEmployeeInput rejects unknown keys', () => {
    expect(GetEmployeeInput.safeParse({ username: 'x', evil: 1 }).success).toBe(false);
  });
  it('GetEmployeeInput requires username', () => {
    expect(GetEmployeeInput.safeParse({}).success).toBe(false);
  });
  it('EmployeeSubListInput rejects unknown keys', () => {
    expect(EmployeeSubListInput.safeParse({ username: 'x', foo: 1 }).success).toBe(false);
  });
  it('CreateEmployeeInput enforces all required fields (incl. username >= 5, email, password, price_group)', () => {
    expect(CreateEmployeeInput.safeParse({ username: 'max.x', firstname: 'A', lastname: 'B' }).success).toBe(false);
    expect(
      CreateEmployeeInput.safeParse({
        username: 'max.x',
        firstname: 'A',
        lastname: 'B',
        email: 'a@b.de',
        password: 'secret12',
        price_group: '01',
      }).success,
    ).toBe(true);
  });
});

describe('zep_list_employees', () => {
  it('forwards limit/page + personal_number filter as query', async () => {
    mockReq.mockResolvedValueOnce(fixture('employees_list'));
    await call('zep_list_employees', { limit: 3, page: 1, personal_number: ['10000'] });
    expect(mockReq).toHaveBeenCalledWith({
      method: 'GET',
      path: '/employees',
      query: { limit: 3, page: 1, personal_number: ['10000'] },
    });
  });

  it('auto_paginate aggregates into { data, count }', async () => {
    mockReq.mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }], meta: { last_page: 1 } });
    const res = await call('zep_list_employees', { auto_paginate: true, max_items: 50 });
    expect(res.structuredContent).toMatchObject({ count: 2 });
  });
});

describe('sub-resource path params', () => {
  it('zep_list_employee_absences puts username in the path, not the query', async () => {
    mockReq.mockResolvedValueOnce(fixture('employee_absences'));
    await call('zep_list_employee_absences', { username: 'max.mustermann', limit: 3 });
    expect(mockReq).toHaveBeenCalledWith({
      method: 'GET',
      path: '/employees/max.mustermann/absences',
      query: { limit: 3, page: undefined },
    });
  });
});

describe('zep_update_employee (GET-merge-PUT)', () => {
  it('merges the partial over the current resource and PUTs it', async () => {
    mockReq
      .mockResolvedValueOnce({ data: { username: 'max.mustermann', firstname: 'Max', lastname: 'Mustermann', city: 'Old' } })
      .mockResolvedValueOnce({ data: { username: 'max.mustermann', city: 'Berlin' } });
    const res = await call('zep_update_employee', { username: 'max.mustermann', city: 'Berlin' });
    expect(mockReq).toHaveBeenNthCalledWith(1, { method: 'GET', path: '/employees/max.mustermann' });
    expect(mockReq).toHaveBeenNthCalledWith(2, {
      method: 'PUT',
      path: '/employees/max.mustermann',
      body: { username: 'max.mustermann', firstname: 'Max', lastname: 'Mustermann', city: 'Berlin' },
    });
    expect(res.isError).toBeFalsy();
  });

  it('UpdateEmployeeInput accepts partial bodies', () => {
    expect(UpdateEmployeeInput.safeParse({ username: 'x' }).success).toBe(true);
  });
});

describe('dual content blocks (structuredContent + JSON text)', () => {
  it('ok results carry [summary, compact JSON of the full payload]', async () => {
    const body = fixture('employee_detail');
    mockReq.mockResolvedValueOnce(body);
    const res = await call('zep_get_employee', { username: 'max.mustermann' });
    expect(res.content).toHaveLength(2);
    expect(res.content[0].text).toContain('max.mustermann'); // summary
    expect(JSON.parse(res.content[1].text)).toEqual(body); // full JSON
  });

  it('truncates a >50-item list in the text block but keeps structuredContent full', async () => {
    const items = Array.from({ length: 73 }, (_, i) => ({ id: i }));
    mockReq.mockResolvedValueOnce({ data: items, meta: { last_page: 1 } });
    const res = await call('zep_list_employees', { limit: 100 });
    expect(res.content).toHaveLength(2);
    const firstLine = res.content[1].text.split('\n')[0];
    const parsed = JSON.parse(firstLine) as { data: unknown[] };
    expect(parsed.data).toHaveLength(50);
    expect(res.content[1].text).toMatch(/\+23 more/);
    expect((res.structuredContent as { data: unknown[] }).data).toHaveLength(73);
  });
});
