import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { ZepApiError } from '../../../src/client/errors.js';
import type { ToolResult } from '../../../src/lib/toolResult.js';

vi.mock('../../../src/client/http.js', () => ({ zepRequest: vi.fn() }));
import { zepRequest } from '../../../src/client/http.js';
import { registerDeviceTools, GetDeviceInput, ListDevicesInput } from '../../../src/tools/devices.js';
import { captureTools } from '../../helpers/capture.js';

const mockReq = vi.mocked(zepRequest);
const tools = captureTools(registerDeviceTools);
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../fixtures/zep-responses/${name}.json`, import.meta.url), 'utf8'));
const call = (name: string, args: Record<string, unknown>): Promise<ToolResult> =>
  tools.get(name)!.handler(args) as Promise<ToolResult>;

beforeEach(() => {
  mockReq.mockReset();
});

describe('registry', () => {
  it('registers 2 device tools', () => {
    expect(tools.size).toBe(2);
  });
});

describe('zep_get_device', () => {
  it('happy path: correct path + structuredContent + summary', async () => {
    const body = fixture('device_detail');
    mockReq.mockResolvedValueOnce(body);
    const res = await call('zep_get_device', { id: 12 });
    expect(mockReq).toHaveBeenCalledWith({ method: 'GET', path: '/devices/12' });
    expect(res.structuredContent).toEqual(body);
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain('Terminal 12 geladen.');
  });

  it('404 → isError', async () => {
    mockReq.mockRejectedValueOnce(new ZepApiError({ status: 404, message: 'Not found' }));
    const res = await call('zep_get_device', { id: 999 });
    expect(res.isError).toBe(true);
  });

  it('module-gate 404 → friendly licence message', async () => {
    mockReq.mockRejectedValueOnce(
      new ZepApiError({ status: 404, message: 'The route x could not be found.', isModuleGate: true }),
    );
    const res = await call('zep_get_device', { id: 999 });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Modul\/Lizenz nicht aktiviert/);
  });
});

describe('input validation (strict)', () => {
  it('GetDeviceInput rejects unknown keys', () => {
    expect(GetDeviceInput.safeParse({ id: 12, evil: 1 }).success).toBe(false);
  });
  it('GetDeviceInput requires id', () => {
    expect(GetDeviceInput.safeParse({}).success).toBe(false);
  });
  it('ListDevicesInput rejects unknown keys', () => {
    expect(ListDevicesInput.safeParse({ foo: 1 }).success).toBe(false);
  });
});

describe('zep_list_devices', () => {
  it('forwards limit/page as query', async () => {
    mockReq.mockResolvedValueOnce(fixture('devices_list'));
    await call('zep_list_devices', { limit: 3, page: 1 });
    expect(mockReq).toHaveBeenCalledWith({
      method: 'GET',
      path: '/devices',
      query: { limit: 3, page: 1 },
    });
  });

  it('auto_paginate aggregates into { data, count }', async () => {
    mockReq.mockResolvedValueOnce({ data: [{ id: 12 }, { id: 13 }], meta: { last_page: 1 } });
    const res = await call('zep_list_devices', { auto_paginate: true, max_items: 50 });
    expect(res.structuredContent).toMatchObject({ count: 2 });
  });
});
