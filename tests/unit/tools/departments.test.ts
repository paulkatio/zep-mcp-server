import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { ZepApiError } from '../../../src/client/errors.js';
import type { ToolResult } from '../../../src/lib/toolResult.js';

vi.mock('../../../src/client/http.js', () => ({ zepRequest: vi.fn() }));
import { zepRequest } from '../../../src/client/http.js';
import {
  registerDepartmentTools,
  GetDepartmentInput,
  DepartmentSubListInput,
} from '../../../src/tools/departments.js';
import { captureTools } from '../../helpers/capture.js';

const mockReq = vi.mocked(zepRequest);
const tools = captureTools(registerDepartmentTools);
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../fixtures/zep-responses/${name}.json`, import.meta.url), 'utf8'));
const call = (name: string, args: Record<string, unknown>): Promise<ToolResult> =>
  tools.get(name)!.handler(args) as Promise<ToolResult>;

beforeEach(() => {
  mockReq.mockReset();
});

describe('registry', () => {
  it('registers 4 department tools', () => {
    expect(tools.size).toBe(4);
  });
});

describe('zep_get_department', () => {
  it('happy path: correct path + structuredContent + summary', async () => {
    const body = fixture('department_detail');
    mockReq.mockResolvedValueOnce(body);
    const res = await call('zep_get_department', { id: 1 });
    expect(mockReq).toHaveBeenCalledWith({ method: 'GET', path: '/departments/1' });
    expect(res.structuredContent).toEqual(body);
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain('1');
  });

  it('404 → isError', async () => {
    mockReq.mockRejectedValueOnce(new ZepApiError({ status: 404, message: 'Not found' }));
    const res = await call('zep_get_department', { id: 999 });
    expect(res.isError).toBe(true);
  });

  it('module-gate 404 → friendly licence message', async () => {
    mockReq.mockRejectedValueOnce(
      new ZepApiError({ status: 404, message: 'The route x could not be found.', isModuleGate: true }),
    );
    const res = await call('zep_get_department', { id: 999 });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Modul\/Lizenz nicht aktiviert/);
  });
});

describe('input validation (strict)', () => {
  it('GetDepartmentInput rejects unknown keys', () => {
    expect(GetDepartmentInput.safeParse({ id: 1, evil: 1 }).success).toBe(false);
  });
  it('GetDepartmentInput requires id', () => {
    expect(GetDepartmentInput.safeParse({}).success).toBe(false);
  });
  it('DepartmentSubListInput rejects unknown keys', () => {
    expect(DepartmentSubListInput.safeParse({ id: 1, foo: 1 }).success).toBe(false);
  });
});

describe('zep_list_departments', () => {
  it('forwards limit/page as query', async () => {
    mockReq.mockResolvedValueOnce(fixture('departments_list'));
    await call('zep_list_departments', { limit: 3, page: 1 });
    expect(mockReq).toHaveBeenCalledWith({
      method: 'GET',
      path: '/departments',
      query: { limit: 3, page: 1 },
    });
  });

  it('auto_paginate aggregates into { data, count }', async () => {
    mockReq.mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }], meta: { last_page: 1 } });
    const res = await call('zep_list_departments', { auto_paginate: true, max_items: 50 });
    expect(res.structuredContent).toMatchObject({ count: 2 });
  });
});

describe('sub-resource path params', () => {
  it('zep_list_department_children puts id in the path, not the query', async () => {
    mockReq.mockResolvedValueOnce(fixture('department_children'));
    await call('zep_list_department_children', { id: 1, limit: 3 });
    expect(mockReq).toHaveBeenCalledWith({
      method: 'GET',
      path: '/departments/1/children',
      query: { limit: 3, page: undefined },
    });
  });

  it('zep_list_department_employees puts id in the path, not the query', async () => {
    mockReq.mockResolvedValueOnce(fixture('department_employees'));
    await call('zep_list_department_employees', { id: 1, limit: 3 });
    expect(mockReq).toHaveBeenCalledWith({
      method: 'GET',
      path: '/departments/1/employees',
      query: { limit: 3, page: undefined },
    });
  });
});
