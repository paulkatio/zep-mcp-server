import { describe, it, expect, beforeAll } from 'vitest';

// ── Live integration smoke test (GATED) ──────────────────────────────────────
// Runs REAL read-only GETs against the ZEP REST API. It is OPT-IN: only active
// when ZEP_TEST_TOKEN is present in the environment. Without it the whole suite
// is skipped (describe.skip) so CI and `npm test` never hit the network.
//
// Deliberately self-contained: it does NOT import src/config.ts (whose loader
// calls process.exit(1) on missing production env) and does NOT use the undici
// client. It talks to the API via global fetch, exactly like an external caller.
//
// SAFETY: only HTTP GET is issued here. Never add POST/PUT/PATCH/DELETE — those
// would mutate live tenant data.

const TOKEN = process.env.ZEP_TEST_TOKEN;
// Prefer a dedicated test tenant; fall back to the regular tenant env var.
const TENANT = process.env.ZEP_TEST_TENANT ?? process.env.ZEP_TENANT;

// Base URL mirrors src/config.ts: https://www.zep-online.de/<tenant>/next/api/v1
const BASE_URL = `https://www.zep-online.de/${TENANT ?? ''}/next/api/v1`;

// Generous per-request budget — the live API can be slow under load.
const REQUEST_TIMEOUT_MS = 30_000;

// Read-only, live-verified endpoints. ONLY GET. ONLY ?limit=1 to stay cheap.
const READ_ONLY_ENDPOINTS = [
  '/employees?limit=1',
  '/attendances?limit=1',
  '/absences?limit=1',
  '/departments?limit=1',
  '/devices?limit=1',
] as const;

interface LiveResponse {
  status: number;
  contentType: string | null;
  body: unknown;
}

async function liveGet(endpoint: string): Promise<LiveResponse> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${TOKEN ?? ''}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const contentType = res.headers.get('content-type');
  // Parse defensively: a non-JSON error page must not throw before our asserts.
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, contentType, body };
}

const hasData = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && 'data' in value;

if (!TOKEN) {
  console.warn(
    '[live.test] ZEP_TEST_TOKEN not set — skipping live integration tests. ' +
      'Set ZEP_TEST_TOKEN (and optionally ZEP_TEST_TENANT) to run real read-only GETs.',
  );
}

// describe.skip when ungated, real describe when ZEP_TEST_TOKEN is present.
const live = TOKEN ? describe : describe.skip;

live('ZEP live API (read-only GETs)', () => {
  beforeAll(() => {
    // Guard against a token-without-tenant misconfiguration.
    expect(TENANT, 'ZEP_TEST_TENANT or ZEP_TENANT must be set for live tests').toBeTruthy();
  });

  it.each(READ_ONLY_ENDPOINTS)(
    'GET %s → 200 + JSON + data',
    async (endpoint) => {
      const { status, contentType, body } = await liveGet(endpoint);
      expect(status).toBe(200);
      expect(contentType).toMatch(/application\/json/);
      expect(hasData(body)).toBe(true);
    },
    REQUEST_TIMEOUT_MS + 5_000,
  );
});
