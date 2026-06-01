import type { Dispatcher } from 'undici';

export interface ZepApiErrorInit {
  status: number;
  message: string;
  code?: string;
  requestId?: string;
  isModuleGate?: boolean;
  details?: unknown;
}

/**
 * Normalized ZEP API error. Never thrown to the MCP client directly — tool
 * handlers convert it via {@link ZepApiError.toToolMessage} into an
 * `isError: true` result.
 */
export class ZepApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  /** True when ZEP returned a 404 "route could not be found" = the endpoint's
   * module/licence is not active for this tenant (not a missing record). */
  readonly isModuleGate: boolean;
  readonly details?: unknown;

  constructor(init: ZepApiErrorInit) {
    super(init.message);
    this.name = 'ZepApiError';
    this.status = init.status;
    this.code = init.code;
    this.requestId = init.requestId;
    this.isModuleGate = init.isModuleGate ?? false;
    this.details = init.details;
  }

  /** User-facing message for tool/resource handlers. */
  toToolMessage(): string {
    if (this.isModuleGate) {
      return (
        'Dieser Endpunkt ist für dein ZEP-Modul/Lizenz nicht aktiviert. ' +
        'Wende dich an deinen ZEP-Admin, wenn du dieses Feature brauchst.'
      );
    }
    const rid = this.requestId ? ` [request ${this.requestId}]` : '';
    return `ZEP-API-Fehler (HTTP ${this.status}): ${this.message}${rid}`;
  }
}

const MODULE_GATE_RE = /route .* could not be found/i;

/** Maps a non-2xx undici response into a {@link ZepApiError}. Consumes the body. */
export async function mapZepError(res: Dispatcher.ResponseData): Promise<ZepApiError> {
  const status = res.statusCode;
  const requestId =
    (res.headers['x-request-id'] as string | undefined) ??
    (res.headers['x-requestid'] as string | undefined) ??
    undefined;

  let bodyText = '';
  try {
    bodyText = await res.body.text();
  } catch {
    /* body may be empty / already consumed */
  }

  let message = bodyText || `HTTP ${status}`;
  let code: string | undefined;
  let details: unknown;
  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      details = parsed;
      if (typeof parsed.message === 'string') message = parsed.message;
      if (typeof parsed.code === 'string') code = parsed.code;
      else if (typeof parsed.error === 'string') code = parsed.error;
    }
  } catch {
    /* non-JSON body (e.g. HTML) — keep raw text as message */
  }

  const isModuleGate = status === 404 && MODULE_GATE_RE.test(message);
  return new ZepApiError({ status, message, code, requestId, isModuleGate, details });
}
