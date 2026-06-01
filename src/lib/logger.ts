import { pino } from 'pino';
import { config } from '../config.js';

const isTest = process.env.NODE_ENV === 'test';

/**
 * App logger — always writes to **stderr** (stdout is reserved for the stdio
 * MCP transport). Redacts auth/token fields. Silent under NODE_ENV=test.
 */
export const logger = pino(
  {
    level: isTest ? 'silent' : config.LOG_LEVEL,
    redact: {
      paths: [
        'authorization',
        'token',
        'apiKey',
        'ZEP_API_TOKEN',
        'headers.authorization',
        '*.authorization',
        '*.token',
        '*.apiKey',
      ],
      censor: '[REDACTED]',
    },
  },
  process.stderr,
);
