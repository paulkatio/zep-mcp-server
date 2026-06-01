import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';
import type { Dispatcher } from 'undici';
import { zepRequest, serializeQuery, currentConcurrency } from '../../../src/client/http.js';
import { ZepApiError } from '../../../src/client/errors.js';

const ORIGIN = 'https://www.zep-online.de';
const BASE = '/testtenant/next/api/v1';
const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

let agent: MockAgent;
let original: Dispatcher;

beforeEach(() => {
  original = getGlobalDispatcher();
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
});

afterEach(async () => {
  await agent.close();
  setGlobalDispatcher(original);
});

describe('serializeQuery', () => {
  it('serializes arrays as key[]', () => {
    expect(serializeQuery({ id: [1, 2], page: 3 })).toBe('?id%5B%5D=1&id%5B%5D=2&page=3');
  });
  it('skips null/undefined', () => {
    expect(serializeQuery({ a: undefined, b: null, c: 1 })).toBe('?c=1');
  });
  it('returns empty string for no params', () => {
    expect(serializeQuery({})).toBe('');
  });
});

describe('zepRequest happy path', () => {
  it('returns parsed JSON on 200', async () => {
    agent.get(ORIGIN).intercept({ path: `${BASE}/employees`, method: 'GET' }).reply(200, { data: [{ id: 1 }] });
    await expect(zepRequest({ method: 'GET', path: '/employees' })).resolves.toEqual({ data: [{ id: 1 }] });
  });
});

describe('error mapping', () => {
  it('maps 404 "route could not be found" to a module gate', async () => {
    agent.get(ORIGIN).intercept({ path: `${BASE}/x`, method: 'GET' }).reply(404, {
      message: 'The route tenant/next/api/v1/x could not be found.',
    });
    await expect(zepRequest({ method: 'GET', path: '/x' })).rejects.toMatchObject({
      status: 404,
      isModuleGate: true,
    });
  });

  it('maps a generic 404 (record absent) without module gate', async () => {
    agent.get(ORIGIN).intercept({ path: `${BASE}/y`, method: 'GET' }).reply(404, { message: 'No query results' });
    await expect(zepRequest({ method: 'GET', path: '/y' })).rejects.toMatchObject({
      status: 404,
      isModuleGate: false,
    });
  });

  it('throws ZepApiError (not a raw error) on 400', async () => {
    agent.get(ORIGIN).intercept({ path: `${BASE}/z`, method: 'GET' }).reply(400, { message: 'bad' });
    await expect(zepRequest({ method: 'GET', path: '/z' })).rejects.toBeInstanceOf(ZepApiError);
  });
});

describe('retry', () => {
  it('retries a 500 then succeeds', async () => {
    const pool = agent.get(ORIGIN);
    pool.intercept({ path: `${BASE}/r`, method: 'GET' }).reply(500, { message: 'boom' });
    pool.intercept({ path: `${BASE}/r`, method: 'GET' }).reply(200, { ok: true });
    await expect(zepRequest({ method: 'GET', path: '/r' })).resolves.toEqual({ ok: true });
  });

  it('exhausts the retry budget on persistent 500', async () => {
    agent.get(ORIGIN).intercept({ path: `${BASE}/e`, method: 'GET' }).reply(500, { message: 'down' }).times(4);
    await expect(zepRequest({ method: 'GET', path: '/e' })).rejects.toBeInstanceOf(ZepApiError);
  });
});

describe('429 rate-limit handling', () => {
  it('drops concurrency to 1, then retries to success', async () => {
    expect(currentConcurrency()).toBeGreaterThan(1);
    const pool = agent.get(ORIGIN);
    pool.intercept({ path: `${BASE}/limit`, method: 'GET' }).reply(429, { message: 'slow down' });
    pool.intercept({ path: `${BASE}/limit`, method: 'GET' }).reply(200, { ok: true });

    const p = zepRequest<{ ok: boolean }>({ method: 'GET', path: '/limit' });
    await delay(40); // 429 received + enterRateLimit() ran, still in cooldown
    expect(currentConcurrency()).toBe(1);

    await expect(p).resolves.toEqual({ ok: true });

    await delay(200); // cooldown (150ms test value) elapses, limiter restored
    expect(currentConcurrency()).toBeGreaterThan(1);
  });
});
