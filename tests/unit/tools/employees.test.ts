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
  it('registers 17 employee tools', () => {
    expect(tools.size).toBe(17);
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
  it('CreateEmployeeInput requires username/firstname/lastname', () => {
    expect(CreateEmployeeInput.safeParse({ username: 'x' }).success).toBe(false);
    expect(CreateEmployeeInput.safeParse({ username: 'x', firstname: 'A', lastname: 'B' }).success).toBe(true);
  });
});

describe('zep_list_employees', () => {
  it('forwards limit/page/filter as query', async () => {
    mockReq.mockResolvedValueOnce(fixture('employees_list'));
    await call('zep_list_employees', { limit: 3, page: 1, department_id: 3 });
    expect(mockReq).toHaveBeenCalledWith({
      method: 'GET',
      path: '/employees',
      query: { limit: 3, page: 1, department_id: 3 },
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
