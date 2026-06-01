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

/** Max array items rendered into the JSON text block (token control). */
const MAX_TEXT_ITEMS = 50;

/**
 * Success result. Returns BOTH `structuredContent` AND the data as a compact JSON
 * text block, because several MCP clients/proxies (MetaMCP/MCPHub, Claude Web) do
 * not render `structuredContent` — without the text block the user only sees the
 * summary line. content[0] is the human summary, content[1] is the JSON.
 * Long `data` arrays are truncated in the text view only (structuredContent stays full).
 */
export function toolOk(
  structuredContent: Record<string, unknown>,
  summary: string,
): ToolResult {
  return {
    structuredContent,
    content: [
      { type: 'text', text: summary },
      { type: 'text', text: dataAsText(structuredContent) },
    ],
  };
}

/** Compact JSON of the payload; truncates a long `data` array + appends a hint. */
function dataAsText(payload: Record<string, unknown>): string {
  const data = (payload as { data?: unknown }).data;
  if (Array.isArray(data) && data.length > MAX_TEXT_ITEMS) {
    const omitted = data.length - MAX_TEXT_ITEMS;
    const truncated = { ...payload, data: data.slice(0, MAX_TEXT_ITEMS) };
    return (
      JSON.stringify(truncated) +
      `\n[+${omitted} more item(s) omitted from this text view — full set is in ` +
      `structuredContent; narrow with filters or the page/limit parameters]`
    );
  }
  return JSON.stringify(payload);
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
