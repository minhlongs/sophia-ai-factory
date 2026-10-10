import { LogLevel, LogEntry } from './types';
import { redactSecretKeys } from './secret-redactor';
import { formatLogEntry, resolveErrorArgs } from './log-formatter';
import { pushToBetterStack } from './better-stack-transport';
import { captureToSentry, addLogBreadcrumbToSentry } from './sentry-transport';
import { forwardToSentry } from '@/seed/observability/sentry-forwarder';
import { scrubPII, scrubPIIDeep } from '@/seed/observability/telemetry/pii-scrubber';

const isDevelopment = process.env.NODE_ENV !== 'production';

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

  const breadcrumbMetadata = safeMetadata ? { ...safeMetadata } : {};
  if (entry.error) {
    breadcrumbMetadata.error = {
      name: entry.error.name,
      message: entry.error.message,
      ...(entry.error.stack && { stack: entry.error.stack }),
      ...(entry.error.code !== undefined && { code: entry.error.code }),
      ...(entry.error.details !== undefined && { details: entry.error.details }),
      ...(entry.error.hint !== undefined && { hint: entry.error.hint }),
    };
  }
  addLogBreadcrumbToSentry(level, safeMessage, breadcrumbMetadata);

  const formatted = formatLogEntry(entry);

  switch (level) {
    case 'error':
      if (isDevelopment) console.log(formatted);
      console.error(formatted);
      pushToBetterStack('error', entry.message, entry.metadata, entry.requestId, entry.error ? { name: entry.error.name, message: entry.error.message, stack: entry.error.stack } : undefined);
      if (error) {
        captureToSentry(error, entry.metadata).catch(() => { /* no-op */ });
      } else {
        void forwardToSentry({
          level: 'error',
          message: entry.message,
          extra: entry.metadata as Record<string, string> | undefined,
        });
      }
      break;
    case 'warn':
      if (isDevelopment) console.log(formatted);
      console.warn(`[logger-fallback] ${formatted}`);
      pushToBetterStack('warn', entry.message, entry.metadata, entry.requestId);
      break;
    case 'debug':
      if (isDevelopment) console.log(formatted);
      pushToBetterStack('debug', entry.message, entry.metadata, entry.requestId);
      console.debug(formatted);
      break;
    default:
      if (isDevelopment) console.log(formatted);
      pushToBetterStack('info', entry.message, entry.metadata, entry.requestId);
  }
};

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
  const mergedMeta = meta && meta3 ? { ...meta3, ...meta } : (meta || meta3);
  log(level, message, mergedMeta, err, reqId);
}
