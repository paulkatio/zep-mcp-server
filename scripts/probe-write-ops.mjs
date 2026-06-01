// Phase 8.2.1 — write/destructive endpoint discovery.
//
// Probes candidate write endpoints with a DUMMY id (999999, never exists) so the
// API tells us whether the *route* is registered without ever touching a real
// record. Classification by status + message:
//
//   MODULE_GATE  404 + "route … could not be found"  → route NOT registered → skip
//   EXISTS_404   404 + other msg (record not found)  → route exists         → implement
//   EXISTS_422   422 validation error                → route exists         → implement
//   METHOD_NA    405 method not allowed              → path exists, verb no  → skip verb
//   EXISTS_2XX   2xx (unexpected for a fake id)       → route exists         → implement (review)
//   AUTH         401/403                              → auth/permission
//   OTHER        anything else
//
// Writes the result to schemas/zep-inventory-write-ops.json.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadEnv, zepFetch } from './_live-env.mjs';

const DUMMY = 999999;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const TARGETS = [
  // attendances — PATCH/PUT/DELETE
  { tool: 'zep_update_attendance', method: 'PATCH', path: `/attendances/${DUMMY}`, body: {} },
  { tool: 'zep_update_attendance(PUT)', method: 'PUT', path: `/attendances/${DUMMY}`, body: {} },
  { tool: 'zep_delete_attendance', method: 'DELETE', path: `/attendances/${DUMMY}` },
  // absences — PATCH/PUT/DELETE
  { tool: 'zep_update_absence', method: 'PATCH', path: `/absences/${DUMMY}`, body: {} },
  { tool: 'zep_update_absence(PUT)', method: 'PUT', path: `/absences/${DUMMY}`, body: {} },
  { tool: 'zep_delete_absence', method: 'DELETE', path: `/absences/${DUMMY}` },
  // absences — approve/reject (path guessed; probe alternates)
  { tool: 'zep_approve_absence', method: 'POST', path: `/absences/${DUMMY}/approve`, body: {} },
  { tool: 'zep_reject_absence', method: 'POST', path: `/absences/${DUMMY}/reject`, body: {} },
  { tool: 'zep_approve_absence(approval)', method: 'POST', path: `/absences/${DUMMY}/approval`, body: {} },
];

function messageOf(body) {
  if (body && typeof body === 'object') {
    if (typeof body.message === 'string') return body.message;
    if (typeof body.error === 'string') return body.error;
    return JSON.stringify(body).slice(0, 200);
  }
  return String(body).slice(0, 200);
}

function classify(status, msg) {
  if (status === 404 && /route .* could not be found/i.test(msg)) return 'MODULE_GATE';
  if (status === 404) return 'EXISTS_404';
  if (status === 422) return 'EXISTS_422';
  if (status === 405) return 'METHOD_NA';
  if (status >= 200 && status < 300) return 'EXISTS_2XX';
  if (status === 401 || status === 403) return 'AUTH';
  return 'OTHER';
}

const env = loadEnv();
console.log(`Probing write/destructive endpoints against ${env.baseUrl} (dummy id=${DUMMY})\n`);

const results = [];
for (const t of TARGETS) {
  try {
    const { status, contentType, body } = await zepFetch(env, t);
    const msg = messageOf(body);
    const marker = classify(status, msg);
    results.push({ ...t, status, marker, message: msg, contentType });
    console.log(`${marker.padEnd(12)} ${t.method.padEnd(6)} ${t.path.padEnd(32)} → ${status}  ${msg.slice(0, 90)}`);
  } catch (err) {
    results.push({ ...t, status: 0, marker: 'TRANSPORT', message: String(err) });
    console.log(`TRANSPORT    ${t.method.padEnd(6)} ${t.path.padEnd(32)} → ${String(err).slice(0, 90)}`);
  }
}

const exists = (m) => ['EXISTS_404', 'EXISTS_422', 'EXISTS_2XX'].includes(m);
const summary = {
  probed_at_note: 'set by caller',
  tenant: env.tenant,
  base_url: env.baseUrl,
  dummy_id: DUMMY,
  results,
  verdict: results.map((r) => ({ method: r.method, path: r.path, marker: r.marker, exists: exists(r.marker) })),
};
writeFileSync(join(root, 'schemas', 'zep-inventory-write-ops.json'), JSON.stringify(summary, null, 2) + '\n');

console.log('\nEndpoints that EXIST (implementable):');
for (const r of results.filter((r) => exists(r.marker))) console.log(`  ${r.method} ${r.path}  [${r.marker}]`);
console.log('\nWrote schemas/zep-inventory-write-ops.json');
