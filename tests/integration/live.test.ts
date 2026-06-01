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
// SAFETY: the read suite issues only GET. A SEPARATE, double-gated suite below
// may POST one tiny 5-minute attendance for today (see its comment) — it only
// runs when extra ZEP_TEST_* vars are set, and never deletes (manual cleanup).

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

  // Endpoints behind the aggregate (insight) tools: employment-periods (vacation balance)
  // and the employee_id-filtered absences list (vacation balance + pending absences).
  it(
    'aggregate-tool dependencies return data (employment-periods + filtered absences)',
    async () => {
      const list = await liveGet('/employees?limit=1');
      const username = (list.body as { data?: { username?: string }[] }).data?.[0]?.username;
      expect(username, 'need at least one employee').toBeTruthy();

      const periods = await liveGet(`/employees/${encodeURIComponent(username!)}/employment-periods`);
      expect(periods.status).toBe(200);
      expect(hasData(periods.body)).toBe(true);

      const absences = await liveGet(`/absences?employee_id=${encodeURIComponent(username!)}&limit=1`);
      expect(absences.status).toBe(200);
      expect(hasData(absences.body)).toBe(true);
    },
    REQUEST_TIMEOUT_MS * 2 + 5_000,
  );
});

// ── No-write guard (read-only, gated) ────────────────────────────────────────
// Documents the Phase 8.2.1 finding as a live regression guard: the reference
// tenant exposes NO update/delete endpoint for attendances/absences. Probes a
// non-existent id (999999) so nothing real is ever touched, and asserts the verb
// is rejected (404/405) — never silently accepted (2xx).
live('ZEP live API (no write endpoints — guard)', () => {
  const NOWRITE = [
    { method: 'PATCH', path: '/attendances/999999' },
    { method: 'DELETE', path: '/attendances/999999' },
    { method: 'PATCH', path: '/absences/999999' },
    { method: 'DELETE', path: '/absences/999999' },
  ] as const;

  it.each(NOWRITE)('$method $path is not a 2xx (route is read-only)', async ({ method, path }) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${TOKEN ?? ''}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    expect(res.status, `${method} ${path} must not silently succeed`).not.toBeLessThan(400);
    expect([404, 405]).toContain(res.status);
  });
});

// ── Idempotent write cycle (DOUBLE-GATED) ────────────────────────────────────
// POST /attendances requires project_id/project_task_id/activity_id (the ZEP
// Projektverwaltung module). It therefore runs ONLY when, in addition to
// ZEP_TEST_TOKEN, all of these are set: ZEP_TEST_USERNAME, ZEP_TEST_PROJECT_ID,
// ZEP_TEST_TASK_ID, ZEP_TEST_ACTIVITY_ID. It books a tiny 5-minute entry for
// TODAY (never a future date) and verifies it. Attendances have no DELETE
// endpoint → the created entry must be removed manually in the ZEP UI (id logged).
// Extra hard safety gate: even with all project vars set, the write cycle stays OFF
// unless ZEP_TEST_ALLOW_WRITES=true is explicitly exported. (No write endpoint exists
// on the reference tenant anyway — see schemas/zep-inventory-write-ops.json — so this
// only ever runs against a tenant that has the Projektverwaltung module enabled.)
const ALLOW_WRITES = process.env.ZEP_TEST_ALLOW_WRITES === 'true';
const WRITE_USERNAME = process.env.ZEP_TEST_USERNAME;
const WRITE_PROJECT_ID = process.env.ZEP_TEST_PROJECT_ID;
const WRITE_TASK_ID = process.env.ZEP_TEST_TASK_ID;
const WRITE_ACTIVITY_ID = process.env.ZEP_TEST_ACTIVITY_ID;
const writeReady = Boolean(
  TOKEN && ALLOW_WRITES && WRITE_USERNAME && WRITE_PROJECT_ID && WRITE_TASK_ID && WRITE_ACTIVITY_ID,
);

if (TOKEN && !writeReady) {
  console.warn(
    '[live.test] Skipping the create cycle: it is double-gated. Needs ZEP_TEST_ALLOW_WRITES=true AND ' +
      'the Projektverwaltung vars (ZEP_TEST_USERNAME, ZEP_TEST_PROJECT_ID, ZEP_TEST_TASK_ID, ZEP_TEST_ACTIVITY_ID).',
  );
}

const liveWrite = writeReady ? describe : describe.skip;

liveWrite('ZEP live API (idempotent create cycle)', () => {
  it(
    'POST /attendances (today, 5 min) → 2xx, then GET verifies',
    async () => {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD — never future
      const payload = {
        employee_id: WRITE_USERNAME,
        date: today,
        from: '00:00:00',
        to: '00:05:00', // 5 minutes max
        project_id: Number(WRITE_PROJECT_ID),
        project_task_id: Number(WRITE_TASK_ID),
        activity_id: WRITE_ACTIVITY_ID,
      };
      const res = await fetch(`${BASE_URL}/attendances`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN ?? ''}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);

      const created = (await res.json()) as { data?: { id?: number } };
      const id = created.data?.id;
      console.log(
        `[live.test] Created attendance id=${id ?? '(unknown)'} for ${today}. ` +
          'Attendances have no API DELETE — remove this entry manually in the ZEP UI.',
      );

      if (id != null) {
        const check = await liveGet(`/attendances/${id}`);
        expect(check.status).toBe(200);
        expect(hasData(check.body)).toBe(true);
      }
    },
    REQUEST_TIMEOUT_MS * 2 + 5_000,
  );
});
