// Phase 8 live smoke test for the aggregate tools. Read-only. Runs the REAL tool
// handlers (which hit the real ZEP API via src/client/http.ts + .env). Dev-only;
// prints to stdout, writes nothing. Usage: npx tsx scripts/live-insights.ts [username]
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerInsightTools } from '../src/tools/insights.js';

type Handler = (args: Record<string, unknown>) => Promise<{
  isError?: boolean;
  content?: { text: string }[];
  structuredContent?: Record<string, unknown>;
}>;

const handlers = new Map<string, Handler>();
const fake = {
  registerTool(name: string, _cfg: unknown, handler: Handler) {
    handlers.set(name, handler);
  },
} as unknown as McpServer;
registerInsightTools(fake);

const username = process.argv[2] ?? 'd.hofweber';
const today = new Date().toISOString().slice(0, 10);

async function run(name: string, args: Record<string, unknown>): Promise<void> {
  const res = await handlers.get(name)!(args);
  console.log(`\n### ${name}(${JSON.stringify(args)})`);
  console.log('  isError :', res.isError ?? false);
  console.log('  blocks  :', res.content?.length, '| summary:', res.content?.[0]?.text);
  const sc = res.structuredContent ?? {};
  console.log('  sc.keys :', Object.keys(sc).join(', '));
  console.log('  sc      :', JSON.stringify(sc).slice(0, 1400));
}

console.log(`Live insight tests — tenant from .env, today=${today}, username=${username}`);
await run('zep_get_team_status_today', {});
await run('zep_list_pending_absences', {});
await run('zep_get_employee_attendance_summary', { username, start_date: '2026-01-01', end_date: today });
await run('zep_get_employee_vacation_balance', { username, year: 2025 });
await run('zep_get_employee_vacation_balance', { username, year: 2026 });
console.log('\nDone.');
