import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env in development. In production (npx) the host passes env vars
// directly; a missing .env is a silent no-op. `quiet` suppresses dotenv's
// startup banner so it can never pollute the stdio MCP transport.
dotenv.config({ quiet: true });

const REDACTED = '[REDACTED]';

/** Treat empty-string env values (e.g. an empty `ZEP_BASE_URL=`) as unset. */
const emptyToUndefined = (v: unknown): unknown => (v === '' ? undefined : v);

const ConfigSchema = z
  .object({
    ZEP_API_TOKEN: z
      .string()
      .min(
        1,
        'ZEP_API_TOKEN must be set (Bearer token from the ZEP "ZEP-Schnittstellen" module).',
      ),
    ZEP_TENANT: z
      .string()
      .min(
        1,
        'ZEP_TENANT must be set (tenant URL path segment, e.g. "ssig-it").',
      ),
    ZEP_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    ZEP_REQUEST_TIMEOUT_MS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().positive().default(30_000),
    ),
    ZEP_MAX_RETRIES: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(0).default(3),
    ),
    ZEP_CONCURRENCY_LIMIT: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().positive().default(5),
    ),
    LOG_LEVEL: z.preprocess(
      emptyToUndefined,
      z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
    ),
    AUDIT_LOG_PATH: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  })
  .transform((c) => ({
    ...c,
    ZEP_BASE_URL:
      c.ZEP_BASE_URL ?? `https://www.zep-online.de/${c.ZEP_TENANT}/next/api/v1`,
  }));

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map(
        (issue) => `  - ${issue.path.join('.') || '(config)'}: ${issue.message}`,
      )
      .join('\n');
    process.stderr.write(
      `\n[zep-mcp-server] Invalid configuration — server not started:\n${issues}\n\n` +
        `Required: ZEP_API_TOKEN, ZEP_TENANT. See .env.example for all variables.\n\n`,
    );
    process.exit(1);
  }
  return result.data;
}

export const config: Config = loadConfig();

/**
 * Returns a shallow copy of the config that is safe to log: the bearer token
 * is replaced by `[REDACTED]`. Never log `config` directly.
 */
export function redactConfig(c: Config = config): Record<string, unknown> {
  return { ...c, ZEP_API_TOKEN: REDACTED };
}
