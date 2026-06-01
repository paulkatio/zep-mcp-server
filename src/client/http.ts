import { request } from 'undici';
import type { Dispatcher } from 'undici';
import pLimit from 'p-limit';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { mapZepError, ZepApiError } from './errors.js';

const VERSION = '0.1.0';
const USER_AGENT = `zep-mcp-server/${VERSION}`;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const RATE_LIMIT_COOLDOWN_MS = config.ZEP_RATE_LIMIT_COOLDOWN_MS;

export type ZepMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface ZepRequest {
  method: ZepMethod;
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
}

let limiter = pLimit(config.ZEP_CONCURRENCY_LIMIT);
let rateLimitedUntil = 0;
let rateLimitResetTimer: ReturnType<typeof setTimeout> | null = null;

/** Current concurrency cap — drops to 1 while rate-limited. Exposed for tests/observability. */
export function currentConcurrency(): number {
  return limiter.concurrency;
}

function enterRateLimit(): void {
  rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
  limiter = pLimit(1);
  if (rateLimitResetTimer) clearTimeout(rateLimitResetTimer);
  rateLimitResetTimer = setTimeout(() => {
    limiter = pLimit(config.ZEP_CONCURRENCY_LIMIT);
    rateLimitedUntil = 0;
    rateLimitResetTimer = null;
  }, RATE_LIMIT_COOLDOWN_MS);
  rateLimitResetTimer.unref?.();
}

export function serializeQuery(query: Record<string, unknown> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) for (const item of value) params.append(`${key}[]`, String(item));
    else params.append(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const backoff = (attempt: number): number =>
  Math.min(config.ZEP_RETRY_BASE_MS * 2 ** (attempt - 1), 8000);
const msgOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Performs a ZEP API request: Bearer auth, concurrency limit, retry with
 * exponential backoff on 5xx/429, 60s hard backoff + concurrency-drop on 429.
 * Throws {@link ZepApiError} (never a raw transport error).
 */
export function zepRequest<T>(req: ZepRequest): Promise<T> {
  return limiter(() => execute<T>(req));
}

async function execute<T>(req: ZepRequest): Promise<T> {
  const wait = rateLimitedUntil - Date.now();
  if (wait > 0) await sleep(wait);

  const url = `${config.ZEP_BASE_URL}${req.path}${serializeQuery(req.query)}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.ZEP_API_TOKEN}`,
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
    ...(req.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...req.headers,
  };

  const maxAttempts = config.ZEP_MAX_RETRIES + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res: Dispatcher.ResponseData;
    try {
      res = await request(url, {
        method: req.method,
        headers,
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
        headersTimeout: config.ZEP_REQUEST_TIMEOUT_MS,
        bodyTimeout: config.ZEP_REQUEST_TIMEOUT_MS,
      });
    } catch (err) {
      if (attempt >= maxAttempts) {
        logger.error({ tool: 'http', err: msgOf(err), attempt, path: req.path }, 'zep_transport_failed');
        throw new ZepApiError({ status: 0, message: `Transport-Fehler: ${msgOf(err)}` });
      }
      logger.warn({ err: msgOf(err), attempt }, 'zep_transport_error');
      await sleep(backoff(attempt));
      continue;
    }

    const status = res.statusCode;
    if (status >= 200 && status < 300) {
      if (status === 204) {
        res.body.dump();
        return undefined as T;
      }
      return (await res.body.json()) as T;
    }

    if (status === 429) enterRateLimit();

    if (RETRYABLE.has(status) && attempt < maxAttempts) {
      res.body.dump();
      const delay = status === 429 ? RATE_LIMIT_COOLDOWN_MS : backoff(attempt);
      logger.warn({ status, attempt, delay }, 'zep_retry');
      await sleep(delay);
      continue;
    }

    throw await mapZepError(res);
  }
  throw new ZepApiError({ status: 0, message: 'Retry-Budget erschöpft' });
}
