// Shared helper for the local live-test scripts (probe-write-ops.mjs, test-tool.mjs).
// Loads ZEP creds from .env.local (preferred) or .env — NEVER committed — and
// exposes a thin fetch wrapper against the real ZEP REST API. Not shipped: scripts/
// are dev-only and excluded from the npm `files` allow-list / build output.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

export function loadEnv() {
  const file = ['.env.local', '.env'].map((f) => join(root, f)).find(existsSync);
  if (!file) throw new Error('No .env.local or .env found — cannot run live tests.');
  const env = { ...parseEnvFile(file), ...process.env };
  const token = env.ZEP_API_TOKEN;
  const tenant = env.ZEP_TENANT;
  if (!token || !tenant) throw new Error('ZEP_API_TOKEN and ZEP_TENANT must be set.');
  const baseUrl = env.ZEP_BASE_URL || `https://www.zep-online.de/${tenant}/next/api/v1`;
  return { token, tenant, baseUrl };
}

/** One live request. Returns { status, contentType, body (parsed or raw text) }. */
export async function zepFetch({ baseUrl, token }, { method, path, query, body }) {
  const qs = query
    ? '?' +
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const res = await fetch(`${baseUrl}${path}${qs}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const contentType = res.headers.get('content-type');
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, contentType, body: parsed };
}
