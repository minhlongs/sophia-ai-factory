/**
 * Logger Internals — formatting, log dispatch, and arg resolution.
 * Consumed by logger-utility.ts. Do not import from logger-utility.ts here.
 *
 * C2 fix: forwardToSentry is called fire-and-forget for error-level events
 * that have no Error object (message-only). Events with an Error object
 * are captured via captureToSentry (Sentry SDK captureException path).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
  };
}

import { forwardToSentry } from '@/land/observability/sentry-forwarder';
import { scrubPII, scrubPIIDeep } from '@/land/telemetry/pii-scrubber';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Redact common secret-named keys before they leave the process boundary.
 * Complements scrubPII (which catches value-shape patterns like sk-/eyJ/Bearer)
 * by also masking keys that hold secrets even when the value happens to be
 * a short string that wouldn't match a token regex.
 *
 * Applied alongside scrubPIIDeep — defence in depth for logger/Sentry emission.
 */
const SECRET_KEY_RE = /(?:^|_)(?:secret|password|passwd|token|api[_-]?key|cron[_-]?secret|auth[_-]?token|access[_-]?key|private[_-]?key|signing[_-]?key)(?:$|_)/i;
function redactSecretKeys(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redactSecretKeys);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_RE.test(k) ? '[REDACTED-KEY]' : redactSecretKeys(v);
    }
    return out;
  }
  return value;
}

export const formatLogEntry = (entry: LogEntry): string => {
  if (isDevelopment) {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      entry.requestId ? `[${entry.requestId}]` : '',
      entry.message,
    ].filter(Boolean);

    let output = parts.join(' ');

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      output += `\n  Metadata: ${JSON.stringify(entry.metadata, null, 2)}`;
    }

    if (entry.error) {
      output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      const extras: Record<string, unknown> = {};
      if (entry.error.code !== undefined) extras.code = entry.error.code;
      if (entry.error.details !== undefined) extras.details = entry.error.details;
      if (entry.error.hint !== undefined) extras.hint = entry.error.hint;
      if (Object.keys(extras).length > 0) {
        output += `\n  Details: ${JSON.stringify(extras, null, 2)}`;
      }
      if (entry.error.stack) {
        output += `\n${entry.error.stack}`;
      }
    }

    return output;
  }

  return JSON.stringify(entry);
};

export const log = (
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>,
  error?: Error,
  requestId?: string
): void => {
  let safeMetadata: Record<string, unknown> | undefined;
  let safeMessage: string;
  try {
    safeMetadata = metadata
      ? (scrubPIIDeep(redactSecretKeys(metadata)) as Record<string, unknown>)
      : undefined;
    safeMessage = scrubPII(message);
  } catch {
    safeMetadata = metadata ? { _scrub_error: 'PII scrub failed' } : undefined;
    safeMessage = message;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: safeMessage,
    requestId,
    metadata: safeMetadata,
  };

  if (error) {
    const errRecord = error as Error & { code?: unknown; details?: unknown; hint?: unknown };
    entry.error = {
      name: error.name,
      message: scrubPII(error.message),
      stack: error.stack ? scrubPII(error.stack) : undefined,
      ...(errRecord.code !== undefined && { code: errRecord.code }),
      ...(errRecord.details !== undefined && { details: scrubPIIDeep(errRecord.details) }),
      ...(errRecord.hint !== undefined && { hint: scrubPIIDeep(errRecord.hint) }),
    };
  }

  const formatted = formatLogEntry(entry);

  switch (level) {
    case 'error':
      console.error(formatted); // LEGIT FALLBACK — do not replace
      if (error) {
        // SDK path: captureException with full stack trace
        captureToSentry(error, entry.metadata).catch(() => { /* no-op */ });
      } else {
        // C2: message-only errors (no Error object) → forwardToSentry HTTP forwarder
        // fire-and-forget; never blocks caller
        void forwardToSentry({
          level: 'error',
          message: entry.message,
          extra: entry.metadata as Record<string, string> | undefined,
        });
      }
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'debug':
      if (isDevelopment) console.debug(formatted);
      break;
    default:
      console.log(formatted);
  }
};

// Module-level cache so dynamic import runs once per module lifetime
let _sentryModule: { captureException: (err: unknown, ctx?: Record<string, unknown>) => unknown } | null = null;
let _sentryLoadAttempted = false;

async function captureToSentry(
  error: Error,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (_sentryLoadAttempted && !_sentryModule) return; // SDK absent, skip
  try {
    if (!_sentryLoadAttempted) {
      _sentryLoadAttempted = true;
      // Dynamic import prevents circular dep (Sentry -> logger -> Sentry)
      const sentry = await import('@sentry/nextjs');
      // Narrow shape to only what we use — full module has 230+ exports
      _sentryModule = { captureException: sentry.captureException };
    }
    _sentryModule?.captureException(error, { extra: metadata });
  } catch {
    _sentryModule = null; // mark as unavailable
  }
}

export function resolveErrorArgs(
  arg2: Error | Record<string, unknown> | undefined,
  arg3: Record<string, unknown> | undefined,
  arg4: string | undefined
): { err: Error | undefined; meta: Record<string, unknown> | undefined; reqId: string | undefined } {
  if (arg2 !== undefined && !(arg2 instanceof Error)) {
    const record = arg2 as Record<string, unknown>;
    const embeddedErr = record.error;
    if (embeddedErr instanceof Error) {
      const { error: _pulled, ...rest } = record;
      void _pulled;
      const meta = Object.keys(rest).length > 0 ? rest : undefined;
      return { err: embeddedErr, meta, reqId: arg3 as string | undefined };
    }
    return { err: undefined, meta: record, reqId: arg3 as string | undefined };
  }
  return { err: arg2, meta: arg3, reqId: arg4 };
}

export function dispatch(
  level: LogLevel,
  message: string,
  arg2: Error | Record<string, unknown> | undefined,
  arg3: Record<string, unknown> | string | undefined,
  arg4: string | undefined
): void {
  const meta3 = typeof arg3 === 'object' ? arg3 : undefined;
  const reqId3 = typeof arg3 === 'string' ? arg3 : arg4;
  const { err, meta, reqId } = resolveErrorArgs(arg2, meta3, reqId3);
  log(level, message, meta, err, reqId);
}
