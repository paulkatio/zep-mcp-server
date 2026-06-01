/**
 * ZEP REST API endpoint discovery — content-validating.
 *
 * Tenant: zepssigit (NOT ssig-it). The ZEP web frontend serves HTML with
 * HTTP status 200 for unknown tenants/paths ("Page not found 404"), so this
 * script MUST validate the Content-Type and JSON body shape — checking the
 * status code alone produces false positives (the original inventory recorded
 * 69 "200 OK" that were all HTML 404 pages).
 *
 * Identifiers are harvested live from each listing's data[0] in dependency
 * order (list -> detail -> sublist -> subdetail). The provided defaults
 * (paul.katio / K-0001 / 42) belonged to the wrong tenant and are dead on
 * zepssigit; they are used only as fallbacks when a listing returns no rows.
 *
 * Output: schemas/zep-inventory.json (overwrites) + inventory.md.
 * Run:    node scripts/discover-zep-endpoints.mjs
 *
 * Markers:
 *   OK_JSON       2xx + application/json + expected shape (data array/object)
 *   OK_PARTIAL    2xx + application/json, but unexpected shape (no `data`)
 *   HTML_FALLBACK 2xx, but Content-Type text/html (tenant/path missing)
 *   NOT_FOUND     404 (JSON body => route exists, record absent)
 *   AUTH          401 / 403
 *   METHOD_NA     405
 *   OTHER         everything else (429, 5xx, ...)
 */
import { readFileSync, writeFileSync } from 'node:fs';

// ── env ────────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const TOKEN = env.ZEP_API_TOKEN;
const TENANT = env.ZEP_TENANT;
if (!TOKEN || !TENANT) {
  console.error('Missing ZEP_API_TOKEN or ZEP_TENANT in .env');
  process.exit(1);
}
const BASE = `https://www.zep-online.de/${TENANT}/next/api/v1`;

// ── identifier vars (defaults = fallback only) ───────────────────────────────
const vars = {
  projectId: 42,
  taskId: 1,
  attendanceId: 1,
  ticketId: 1,
  subtaskId: 1,
  username: 'paul.katio',
  employmentPeriodId: 1,
  internalRateId: 1,
  regularWorkingTimeId: 1,
  mealId: 1,
  departmentId: 1,
  absenceId: 1,
  customerNumber: 'K-0001',
  offerId: 1,
  invoiceId: 1,
  invoiceItemId: 1,
  articleId: 1,
  receiptId: 1,
  amountId: 1,
  locationId: 1,
  locationListId: 1,
  dynamicAttributeId: 1,
  folderId: 1,
  deviceId: 1,
};
const harvested = new Set(); // var names whose value came from live data

// ── endpoint catalog (canonical blueprint order; sources precede consumers) ──
// kind: resource | listing | detail | sublisting
// harvest: { var, field } -> read data[0][field] into vars[var] on success
const CATALOG = [
  { tool: 'resource:activities', path: '/activities', kind: 'resource' },
  { tool: 'resource:categories', path: '/categories', kind: 'resource' },
  { tool: 'resource:price-groups', path: '/price-groups', kind: 'resource' },
  { tool: 'resource:absence-reasons', path: '/absence-reasons', kind: 'resource' },

  { tool: 'zep_list_projects', path: '/projects', kind: 'listing', harvest: { var: 'projectId', field: 'id' } },
  { tool: 'zep_get_project', path: '/projects/{projectId}', kind: 'detail' },
  { tool: 'zep_list_project_activities', path: '/projects/{projectId}/activities', kind: 'sublisting' },
  { tool: 'zep_list_project_employees', path: '/projects/{projectId}/employees', kind: 'sublisting' },
  { tool: 'zep_list_project_tasks', path: '/projects/{projectId}/tasks', kind: 'sublisting', harvest: { var: 'taskId', field: 'id' } },
  { tool: 'zep_get_project_task', path: '/projects/{projectId}/tasks/{taskId}', kind: 'detail' },
  { tool: 'zep_list_project_price_tables', path: '/projects/{projectId}/price-tables', kind: 'sublisting' },
  { tool: 'zep_list_project_locations', path: '/projects/{projectId}/locations', kind: 'sublisting' },

  { tool: 'zep_list_attendances', path: '/attendances', kind: 'listing', harvest: { var: 'attendanceId', field: 'id' } },
  { tool: 'zep_get_attendance', path: '/attendances/{attendanceId}', kind: 'detail' },
  { tool: 'zep_list_planning', path: '/planning', kind: 'listing' },

  { tool: 'zep_list_tickets', path: '/tickets', kind: 'listing', harvest: { var: 'ticketId', field: 'id' } },
  { tool: 'zep_get_ticket', path: '/tickets/{ticketId}', kind: 'detail' },
  { tool: 'zep_list_subtasks', path: '/tickets/{ticketId}/subtasks', kind: 'sublisting', harvest: { var: 'subtaskId', field: 'id' } },
  { tool: 'zep_get_subtask', path: '/tickets/{ticketId}/subtasks/{subtaskId}', kind: 'detail' },

  { tool: 'zep_list_employees', path: '/employees', kind: 'listing', harvest: { var: 'username', field: 'username' } },
  { tool: 'zep_get_employee', path: '/employees/{username}', kind: 'detail' },
  { tool: 'zep_list_employee_absences', path: '/employees/{username}/absences', kind: 'sublisting' },
  { tool: 'zep_list_employee_employment_periods', path: '/employees/{username}/employment-periods', kind: 'sublisting', harvest: { var: 'employmentPeriodId', field: 'id' } },
  { tool: 'zep_get_employee_employment_period', path: '/employees/{username}/employment-periods/{employmentPeriodId}', kind: 'detail' },
  { tool: 'zep_list_employee_internal_rates', path: '/employees/{username}/internal-rates', kind: 'sublisting', harvest: { var: 'internalRateId', field: 'id' } },
  { tool: 'zep_get_employee_internal_rate', path: '/employees/{username}/internal-rates/{internalRateId}', kind: 'detail' },
  { tool: 'zep_list_employee_regular_working_times', path: '/employees/{username}/regular-working-times', kind: 'sublisting', harvest: { var: 'regularWorkingTimeId', field: 'id' } },
  { tool: 'zep_get_employee_regular_working_time', path: '/employees/{username}/regular-working-times/{regularWorkingTimeId}', kind: 'detail' },
  { tool: 'zep_list_employee_meals', path: '/employees/{username}/meals', kind: 'sublisting', harvest: { var: 'mealId', field: 'id' } },
  { tool: 'zep_get_employee_meal', path: '/employees/{username}/meals/{mealId}', kind: 'detail' },
  { tool: 'zep_list_employee_projects', path: '/employees/{username}/projects', kind: 'sublisting' },
  { tool: 'zep_list_employee_transponders', path: '/employees/{username}/transponders', kind: 'sublisting' },

  { tool: 'zep_list_departments', path: '/departments', kind: 'listing', harvest: { var: 'departmentId', field: 'id' } },
  { tool: 'zep_get_department', path: '/departments/{departmentId}', kind: 'detail' },
  { tool: 'zep_list_department_children', path: '/departments/{departmentId}/children', kind: 'sublisting' },
  { tool: 'zep_list_department_employees', path: '/departments/{departmentId}/employees', kind: 'sublisting' },

  { tool: 'zep_list_absences', path: '/absences', kind: 'listing', harvest: { var: 'absenceId', field: 'id' } },
  { tool: 'zep_get_absence', path: '/absences/{absenceId}', kind: 'detail' },

  { tool: 'zep_list_customers', path: '/customers', kind: 'listing', harvest: { var: 'customerNumber', field: 'customer_number' } },
  { tool: 'zep_get_customer', path: '/customers/{customerNumber}', kind: 'detail' },
  { tool: 'zep_list_customer_contacts', path: '/customers/{customerNumber}/contacts', kind: 'sublisting' },
  { tool: 'zep_list_customer_price_tables', path: '/customers/{customerNumber}/price-tables', kind: 'sublisting' },

  { tool: 'zep_list_offers', path: '/offers', kind: 'listing', harvest: { var: 'offerId', field: 'id' } },
  { tool: 'zep_get_offer', path: '/offers/{offerId}', kind: 'detail' },
  { tool: 'zep_list_offer_items', path: '/offers/{offerId}/items', kind: 'sublisting' },

  { tool: 'zep_list_invoices', path: '/invoices', kind: 'listing', harvest: { var: 'invoiceId', field: 'id' } },
  { tool: 'zep_get_invoice', path: '/invoices/{invoiceId}', kind: 'detail' },
  { tool: 'zep_list_invoice_attachments', path: '/invoices/{invoiceId}/attachments', kind: 'sublisting' },
  { tool: 'zep_list_invoice_items_for_invoice', path: '/invoices/{invoiceId}/items', kind: 'sublisting' },

  { tool: 'zep_list_invoice_items', path: '/invoice-items', kind: 'listing', harvest: { var: 'invoiceItemId', field: 'id' } },
  { tool: 'zep_get_invoice_item', path: '/invoice-items/{invoiceItemId}', kind: 'detail' },

  { tool: 'zep_list_articles', path: '/articles', kind: 'listing', harvest: { var: 'articleId', field: 'id' } },
  { tool: 'zep_get_article', path: '/articles/{articleId}', kind: 'detail' },

  { tool: 'zep_list_receipts', path: '/receipts', kind: 'listing', harvest: { var: 'receiptId', field: 'id' } },
  { tool: 'zep_get_receipt', path: '/receipts/{receiptId}', kind: 'detail' },
  { tool: 'zep_list_receipt_amounts', path: '/receipts/{receiptId}/amounts', kind: 'sublisting', harvest: { var: 'amountId', field: 'id' } },
  { tool: 'zep_get_receipt_amount', path: '/receipts/{receiptId}/amounts/{amountId}', kind: 'detail' },
  { tool: 'zep_list_receipt_attachments', path: '/receipts/{receiptId}/attachments', kind: 'sublisting' },

  { tool: 'zep_list_locations', path: '/locations', kind: 'listing', harvest: { var: 'locationId', field: 'id' } },
  { tool: 'zep_get_location', path: '/locations/{locationId}', kind: 'detail' },

  { tool: 'zep_list_location_lists', path: '/location-lists', kind: 'listing', harvest: { var: 'locationListId', field: 'id' } },
  { tool: 'zep_get_location_list', path: '/location-lists/{locationListId}', kind: 'detail' },
  { tool: 'zep_list_location_list_locations', path: '/location-lists/{locationListId}/locations', kind: 'sublisting' },

  { tool: 'zep_list_dynamic_attributes', path: '/dynamic-attributes', kind: 'listing', harvest: { var: 'dynamicAttributeId', field: 'id' } },
  { tool: 'zep_get_dynamic_attribute', path: '/dynamic-attributes/{dynamicAttributeId}', kind: 'detail' },

  { tool: 'zep_list_folders', path: '/folders', kind: 'listing', harvest: { var: 'folderId', field: 'id' } },
  { tool: 'zep_list_folder_documents', path: '/folders/{folderId}/documents', kind: 'sublisting' },

  { tool: 'zep_list_devices', path: '/devices', kind: 'listing', harvest: { var: 'deviceId', field: 'id' } },
  { tool: 'zep_get_device', path: '/devices/{deviceId}', kind: 'detail' },
];

// ── helpers ──────────────────────────────────────────────────────────────────
const fill = (tpl) => tpl.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(String(vars[k])));
const usedIds = (tpl) => [...tpl.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
const isCollection = (kind) => kind === 'listing' || kind === 'sublisting' || kind === 'resource';

function classify(ep, status, contentType, json, rawLen) {
  const ct = (contentType || '').toLowerCase();
  if (status === 401 || status === 403) return { marker: 'AUTH', shape: `status ${status}` };
  if (status === 405) return { marker: 'METHOD_NA', shape: 'method not allowed' };
  if (!ct.includes('application/json')) {
    if (status >= 200 && status < 300 && ct.includes('text/html'))
      return { marker: 'HTML_FALLBACK', shape: `text/html ${rawLen}b (tenant/path missing)` };
    return { marker: 'OTHER', shape: `status ${status} ct=${ct || 'none'}` };
  }
  // JSON from here on
  if (status === 404) {
    const msg = json?.message ?? '';
    // ZEP/Laravel returns "The route ... could not be found." for unregistered
    // routes (endpoint not available for this tenant/module), vs a record-level
    // 404 ("No query results"). Distinguish so the inventory is not misleading.
    const routeMissing = /route .* could not be found/i.test(msg);
    const note = routeMissing
      ? 'route NOT registered (endpoint unavailable for this tenant/module)'
      : 'record absent (route exists)';
    return { marker: 'NOT_FOUND', shape: `json 404 ${msg ? `"${msg}" ` : ''}(${note})` };
  }
  if (status < 200 || status >= 300) return { marker: 'OTHER', shape: `json status ${status}` };

  const data = json?.data;
  if (isCollection(ep.kind)) {
    if (Array.isArray(data)) {
      const extra = [
        json.links ? 'links' : 'links✗',
        json.meta ? 'meta' : 'meta✗',
        json.meta?.total != null ? `total=${json.meta.total}` : null,
      ].filter(Boolean).join(' ');
      return { marker: 'OK_JSON', shape: `data=array(${data.length}) ${extra}` };
    }
    if (data && typeof data === 'object') return { marker: 'OK_JSON', shape: 'data=object' };
    return { marker: 'OK_PARTIAL', shape: `2xx json, no data[] (top=[${Object.keys(json || {}).join(',')}])` };
  }
  // detail
  if (data && typeof data === 'object' && !Array.isArray(data)) return { marker: 'OK_JSON', shape: 'data=object' };
  if (Array.isArray(data)) return { marker: 'OK_PARTIAL', shape: `detail returned data=array(${data.length})` };
  return { marker: 'OK_PARTIAL', shape: `2xx json, no data{} (top=[${Object.keys(json || {}).join(',')}])` };
}

async function probe(ep) {
  const query = ep.kind === 'detail' ? '' : '?limit=1';
  const path = fill(ep.path) + query;
  const url = `${BASE}${path}`;
  const ids = usedIds(ep.path).map((k) => `${k}=${vars[k]}${harvested.has(k) ? '' : '*'}`);
  const t0 = Date.now();
  let status = 0, contentType = '', json = null, rawLen = 0, err = null;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
    });
    status = res.status;
    contentType = res.headers.get('content-type') || '';
    const raw = await res.text();
    rawLen = raw.length;
    if (contentType.toLowerCase().includes('application/json')) {
      try { json = JSON.parse(raw); } catch { /* leave json null */ }
    }
  } catch (e) {
    err = e.code || e.message;
  }
  const latency_ms = Date.now() - t0;

  let marker, shape;
  if (err) { marker = 'OTHER'; shape = `network error: ${err}`; }
  else ({ marker, shape } = classify(ep, status, contentType, json, rawLen));

  // harvest identifier from a successful listing
  if (ep.harvest && marker === 'OK_JSON' && Array.isArray(json?.data) && json.data.length) {
    const v = json.data[0][ep.harvest.field] ?? json.data[0].number ?? json.data[0].id;
    if (v != null && v !== '') { vars[ep.harvest.var] = v; harvested.add(ep.harvest.var); }
  }

  return {
    tool: ep.tool,
    method: 'GET',
    path,
    kind: ep.kind,
    status,
    content_type: contentType,
    marker,
    shape,
    identifiers: ids.length ? ids.join(' ') : '(none)',
    latency_ms,
  };
}

// ── run (sequential: later probes depend on harvested ids) ───────────────────
const results = [];
for (const ep of CATALOG) {
  const r = await probe(ep);
  results.push(r);
  console.log(`${r.marker.padEnd(13)} ${String(r.status).padEnd(4)} ${r.tool}`);
}

// ── summary ──────────────────────────────────────────────────────────────────
const MARKERS = ['OK_JSON', 'OK_PARTIAL', 'HTML_FALLBACK', 'NOT_FOUND', 'AUTH', 'METHOD_NA', 'OTHER'];
const summary = Object.fromEntries(MARKERS.map((m) => [m, results.filter((r) => r.marker === m).length]));

const inventory = {
  base_url: BASE,
  tenant: TENANT,
  probed_at: new Date().toISOString(),
  note: 'Content-Type + JSON-shape validated. Identifiers harvested live (* = fallback default, not harvested).',
  resolved_identifiers: Object.fromEntries(
    Object.entries(vars).map(([k, v]) => [k, { value: v, source: harvested.has(k) ? 'harvested' : 'default' }]),
  ),
  total: results.length,
  summary,
  results,
};
writeFileSync(new URL('../schemas/zep-inventory.json', import.meta.url), JSON.stringify(inventory, null, 2));

// ── inventory.md ─────────────────────────────────────────────────────────────
const md = [];
md.push(`# ZEP Endpoint Inventory\n`);
md.push(`- **Tenant:** \`${TENANT}\``);
md.push(`- **Base URL:** \`${BASE}\``);
md.push(`- **Probed:** ${inventory.probed_at}`);
md.push(`- **Total endpoints:** ${results.length}\n`);
md.push(`## Summary\n`);
md.push(`| Marker | Count |`);
md.push(`| --- | --- |`);
for (const m of MARKERS) md.push(`| ${m} | ${summary[m]} |`);
md.push(`\n> Markers: \`OK_JSON\` 2xx+json+expected shape · \`OK_PARTIAL\` 2xx+json+other shape · \`HTML_FALLBACK\` 2xx text/html (tenant/path missing) · \`NOT_FOUND\` 404 JSON (route not registered for this tenant, or record absent — see note column) · \`AUTH\` 401/403 · \`METHOD_NA\` 405 · \`OTHER\` rest.\n`);
md.push(`## Resolved identifiers\n`);
md.push(`| Var | Value | Source |`);
md.push(`| --- | --- | --- |`);
for (const [k, v] of Object.entries(inventory.resolved_identifiers)) md.push(`| ${k} | \`${v.value}\` | ${v.source} |`);
md.push(`\n## Endpoints\n`);
md.push(`| Marker | Status | Tool | Path | Shape / note |`);
md.push(`| --- | --- | --- | --- | --- |`);
for (const r of results) md.push(`| ${r.marker} | ${r.status} | \`${r.tool}\` | \`${r.path}\` | ${r.shape} |`);
md.push('');
writeFileSync(new URL('../inventory.md', import.meta.url), md.join('\n'));

// ── console summary ──────────────────────────────────────────────────────────
console.log('\n=== SUMMARY ===');
for (const m of MARKERS) console.log(`${m.padEnd(13)} ${summary[m]}`);
const notOk = results.filter((r) => r.marker !== 'OK_JSON');
if (notOk.length === 0) {
  console.log('\nAll 69 endpoints OK_JSON. Blueprint confirmed — ready for Phase 2.');
} else {
  console.log(`\n=== NOT OK_JSON (${notOk.length}) ===`);
  for (const r of notOk) console.log(`${r.marker.padEnd(13)} ${String(r.status).padEnd(4)} ${r.tool}  ${r.path}\n              ${r.shape}`);
}
console.log('\nWrote schemas/zep-inventory.json and inventory.md');
