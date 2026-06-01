import { zepRequest } from './http.js';

/** Absolute upper bound on items returned by {@link paginateAll}. */
export const HARD_CAP = 500;
const PAGE_SIZE = 100;

interface ZepListResponse<T> {
  data: T[];
  meta?: { current_page?: number; last_page?: number; total?: number };
}

export interface PaginateOptions {
  path: string;
  query?: Record<string, unknown>;
  /** Stop after this many items. Default 100, hard-capped at {@link HARD_CAP}. */
  maxItems?: number;
}

/**
 * Walks the offset-based `page` pagination until `maxItems` (default 100,
 * hard cap 500) or the data is exhausted, and returns the flattened items.
 */
export async function paginateAll<T>(opts: PaginateOptions): Promise<T[]> {
  const cap = Math.min(opts.maxItems ?? 100, HARD_CAP);
  const out: T[] = [];
  let page = 1;

  while (out.length < cap) {
    const limit = Math.min(PAGE_SIZE, cap - out.length);
    const res = await zepRequest<ZepListResponse<T>>({
      method: 'GET',
      path: opts.path,
      query: { ...opts.query, page, limit },
    });
    const batch = res.data ?? [];
    out.push(...batch);

    if (batch.length === 0) break;
    const lastPage = res.meta?.last_page;
    if (lastPage !== undefined && page >= lastPage) break;
    page++;
  }

  return out.slice(0, cap);
}
