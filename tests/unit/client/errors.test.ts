import { describe, it, expect } from 'vitest';
import type { Dispatcher } from 'undici';
import { ZepApiError, mapZepError } from '../../../src/client/errors.js';

const fakeRes = (
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): Dispatcher.ResponseData =>
  ({
    statusCode,
    headers,
    body: { text: async (): Promise<string> => (typeof body === 'string' ? body : JSON.stringify(body)) },
  }) as unknown as Dispatcher.ResponseData;

describe('ZepApiError.toToolMessage', () => {
  it('returns the licence message for a module gate', () => {
    expect(new ZepApiError({ status: 404, message: 'x', isModuleGate: true }).toToolMessage()).toMatch(
      /Modul\/Lizenz nicht aktiviert/,
    );
  });
  it('includes the HTTP status for a normal error', () => {
    expect(new ZepApiError({ status: 500, message: 'boom' }).toToolMessage()).toContain('HTTP 500');
  });
});

describe('mapZepError', () => {
  it('flags isModuleGate on a 404 "route could not be found"', async () => {
    const err = await mapZepError(fakeRes(404, { message: 'The route a/b could not be found.' }));
    expect(err.status).toBe(404);
    expect(err.isModuleGate).toBe(true);
  });
  it('does NOT flag a plain 404', async () => {
    const err = await mapZepError(fakeRes(404, { message: 'No query results' }));
    expect(err.isModuleGate).toBe(false);
  });
  it('extracts requestId and code', async () => {
    const err = await mapZepError(fakeRes(500, { message: 'x', code: 'E1' }, { 'x-request-id': 'req-9' }));
    expect(err.requestId).toBe('req-9');
    expect(err.code).toBe('E1');
  });
  it('keeps a non-JSON body as the message', async () => {
    const err = await mapZepError(fakeRes(502, '<html>bad gateway</html>'));
    expect(err.status).toBe(502);
    expect(err.isModuleGate).toBe(false);
    expect(err.message).toContain('html');
  });
});
