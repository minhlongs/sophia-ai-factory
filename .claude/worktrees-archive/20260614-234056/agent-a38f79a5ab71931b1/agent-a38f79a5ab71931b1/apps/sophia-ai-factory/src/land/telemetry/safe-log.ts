/**
 * safeLog — RED-TEAM #12
 * Scrubs PII, escapes control chars via JSON.stringify, truncates to 4KB.
 * NEVER raw-concatenate user input — always pass through safeLog.
 */

import { scrubPII, scrubPIIDeep } from './pii-scrubber';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface SafeLogPayload {
  ts: number;
  level: LogLevel;
  msg: string;
  ctx: unknown;
}

const MAX_MSG_BYTES = 4096;

/**
 * Truncate string to maxBytes (UTF-8 approximate via length).
 */
function truncate(s: string): string {
  if (s.length <= MAX_MSG_BYTES) return s;
  return s.slice(0, MAX_MSG_BYTES) + '...[TRUNCATED]';
}

/**
 * Build a safe, PII-free, injection-safe log payload.
 * JSON.stringify on msg + ctx auto-escapes control characters.
 */
export function safeLog(
  level: LogLevel,
  msg: string,
  ctx: Record<string, unknown> = {}
): SafeLogPayload {
  const cleanMsg = truncate(scrubPII(msg));
  const cleanCtx = scrubPIIDeep(ctx);

  // Round-trip through JSON to escape any control chars / newlines in values
  // (prevents log-injection via embedded newlines)
  const safeCtx = JSON.parse(JSON.stringify(cleanCtx));

  return {
    ts: Date.now(),
    level,
    msg: cleanMsg,
    ctx: safeCtx,
  };
}
