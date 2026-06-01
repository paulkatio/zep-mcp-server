import { createWriteStream } from 'node:fs';
import { pino } from 'pino';
import { config } from '../config.js';

const isTest = process.env.NODE_ENV === 'test';

// File when AUDIT_LOG_PATH is set, otherwise stderr with a `stream: 'audit'` marker.
const destination = config.AUDIT_LOG_PATH
  ? createWriteStream(config.AUDIT_LOG_PATH, { flags: 'a' })
  : process.stderr;

const auditLogger = pino(
  {
    level: isTest ? 'silent' : 'info', // fixed info, independent of LOG_LEVEL
    base: config.AUDIT_LOG_PATH ? undefined : { stream: 'audit' },
  },
  destination,
);

export interface AuditEntry {
  tool: string;
  resource_id: string | number;
  verb: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Field names touched (keys only — never values). */
  fields?: string[];
}

/** Records one destructive (POST/PATCH/PUT/DELETE) operation to the audit stream. */
export function auditWrite(entry: AuditEntry): void {
  auditLogger.info(
    { ...entry, actor: 'mcp', timestamp: new Date().toISOString() },
    'destructive_call',
  );
}
