import { zepRequest } from '../client/http.js';

/**
 * GET-merge-PUT helper for endpoints whose PUT expects a full replacement.
 * Loads the current resource, shallow-merges the partial, and PUTs the result,
 * so callers can pass partial updates safely (BLUEPRINT §9.3).
 */
export async function getMergePut(opts: {
  getPath: string;
  putPath: string;
  partial: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const current = await zepRequest<{ data: Record<string, unknown> }>({
    method: 'GET',
    path: opts.getPath,
  });
  const merged = { ...current.data, ...opts.partial };
  return zepRequest<Record<string, unknown>>({
    method: 'PUT',
    path: opts.putPath,
    body: merged,
  });
}
