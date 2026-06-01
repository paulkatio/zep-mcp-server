import { logger } from './logger.js';
import { ZepApiError } from '../client/errors.js';

export interface ToolTextContent {
  type: 'text';
  text: string;
}

export interface ToolResult {
  // Index signature mirrors the SDK's CallToolResult so these are assignable.
  [key: string]: unknown;
  content: ToolTextContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/** Success result: structured payload + human summary text. */
export function toolOk(
  structuredContent: Record<string, unknown>,
  summary: string,
): ToolResult {
  return { structuredContent, content: [{ type: 'text', text: summary }] };
}

/** Error result: maps {@link ZepApiError} to a friendly message, logs, returns isError. */
export function toolError(
  err: unknown,
  tool: string,
  ctx: Record<string, unknown> = {},
): ToolResult {
  const message =
    err instanceof ZepApiError
      ? err.toToolMessage()
      : err instanceof Error
        ? err.message
        : String(err);
  logger.error(
    { tool, err: err instanceof Error ? err.message : String(err), ...ctx },
    'tool_error',
  );
  return { isError: true, content: [{ type: 'text', text: message }] };
}
