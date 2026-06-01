import { zepRequest } from '../client/http.js';
import { paginateAll } from '../client/pagination.js';
import { toolOk, toolError, type ToolResult } from './toolResult.js';

interface ListControl {
  limit?: number;
  page?: number;
  auto_paginate?: boolean;
  max_items?: number;
  [key: string]: unknown;
}

/**
 * Shared list handler. Path params must already be baked into `path`; `input`
 * holds pagination control keys (stripped) plus any query filters (forwarded).
 */
export async function runList(opts: {
  tool: string;
  path: string;
  input: ListControl;
  noun: string;
}): Promise<ToolResult> {
  const { limit, page, auto_paginate, max_items, ...filters } = opts.input;
  try {
    if (auto_paginate) {
      const items = await paginateAll<unknown>({ path: opts.path, query: filters, maxItems: max_items });
      return toolOk(
        { data: items, count: items.length },
        `${items.length} ${opts.noun} geladen (auto-paginate, Hard-Cap 500).`,
      );
    }
    const res = await zepRequest<Record<string, unknown>>({
      method: 'GET',
      path: opts.path,
      query: { limit, page, ...filters },
    });
    const data = (res as { data?: unknown }).data;
    const count = Array.isArray(data) ? data.length : undefined;
    return toolOk(res, count !== undefined ? `${count} ${opts.noun} geladen.` : `${opts.noun} geladen.`);
  } catch (err) {
    return toolError(err, opts.tool, { path: opts.path });
  }
}

/** Shared single-resource GET handler. */
export async function runGet(opts: {
  tool: string;
  path: string;
  summary: string;
  ctx?: Record<string, unknown>;
}): Promise<ToolResult> {
  try {
    const res = await zepRequest<Record<string, unknown>>({ method: 'GET', path: opts.path });
    return toolOk(res, opts.summary);
  } catch (err) {
    return toolError(err, opts.tool, opts.ctx ?? {});
  }
}
