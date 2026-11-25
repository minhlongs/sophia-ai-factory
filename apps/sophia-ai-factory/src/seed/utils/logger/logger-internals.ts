import { LogLevel, LogEntry } from './types';
import { redactSecretKeys, redactSecrets } from './secret-redactor';
import { formatLogEntry, resolveErrorArgs } from './log-formatter';
import { pushToBetterStack } from './better-stack-transport';
import { captureToSentry, addLogBreadcrumbToSentry } from './sentry-transport';
import { forwardToSentry } from '@/seed/observability/sentry-forwarder';
import { scrubPII, scrubPIIDeep } from '@/seed/observability/telemetry/pii-scrubber';

const isDevelopment = process.env.NODE_ENV !== 'production';

function scrubText(text: string): string {
  return scrubPII(redactSecrets(text));
}

function scrubUnknown(value: unknown): unknown {
  return scrubPIIDeep(redactSecretKeys(value));
}

function safeScrubUnknown(value: unknown): unknown {
  try {
    return scrubUnknown(value);
  } catch {
    return '[ERROR_DETAIL_SCRUB_FAILED]';
  }
}

function buildScrubbedError(rawError: unknown): {
  entryError: NonNullable<LogEntry['error']>;
  sentryError: Error;
} {
  if (rawError instanceof Error) {
    const errRecord = rawError as Error & { code?: unknown; details?: unknown; hint?: unknown };
    const safeName = scrubText(rawError.name || 'Error');
    const safeMessage = scrubText(rawError.message || '');
    const safeStack = rawError.stack ? scrubText(rawError.stack) : undefined;
    const safeCode = typeof errRecord.code === 'string' ? scrubText(errRecord.code) : errRecord.code;
    const safeDetails = errRecord.details !== undefined ? safeScrubUnknown(errRecord.details) : undefined;
    const safeHint = errRecord.hint !== undefined ? safeScrubUnknown(errRecord.hint) : undefined;

    const entryError: NonNullable<LogEntry['error']> = {
      name: safeName,
      message: safeMessage,
      stack: safeStack,
      ...(safeCode !== undefined && { code: safeCode }),
      ...(safeDetails !== undefined && { details: safeDetails }),
      ...(safeHint !== undefined && { hint: safeHint }),
    };

    const sentryError = new Error(safeMessage) as Error & {
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    sentryError.name = safeName;
    if (safeStack !== undefined) {
      sentryError.stack = safeStack;
    }
    if (safeCode !== undefined) sentryError.code = safeCode;
    if (safeDetails !== undefined) sentryError.details = safeDetails;
    if (safeHint !== undefined) sentryError.hint = safeHint;

    return { entryError, sentryError };
  }

  let safeMessage: string;
  if (typeof rawError === 'string') {
    safeMessage = scrubText(rawError);
  } else {
    try {
      safeMessage = scrubText(JSON.stringify(scrubUnknown(rawError)));
    } catch {
      safeMessage = '[UNSERIALIZABLE_ERROR]';
    }
  }

  const entryError: NonNullable<LogEntry['error']> = {
    name: 'NonErrorThrowable',
    message: safeMessage,
  };
  const sentryError = new Error(safeMessage);
  sentryError.name = 'NonErrorThrowable';
  return { entryError, sentryError };
}

export const log = (
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>,
  error?: unknown,
  requestId?: string
): void => {
  let safeMetadata: Record<string, unknown> | undefined;
  let safeMessage: string;
  try {
    safeMetadata = metadata
      ? (scrubUnknown(metadata) as Record<string, unknown>)
      : undefined;
    safeMessage = scrubText(message);
  } catch {
    safeMetadata = metadata ? { _scrub_error: 'PII scrub failed' } : undefined;
    safeMessage = '[LOG_SCRUB_ERROR]';
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: safeMessage,
    requestId,
    metadata: safeMetadata,
  };

  let scrubbedSentryError: Error | undefined;
  if (error !== undefined && error !== null) {
    try {
      const { entryError, sentryError } = buildScrubbedError(error);
      entry.error = entryError;
      scrubbedSentryError = sentryError;
    } catch {
      entry.error = { name: 'Error', message: '[ERROR_SCRUB_FAILED]' };
      scrubbedSentryError = new Error('[ERROR_SCRUB_FAILED]');
    }
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
      if (scrubbedSentryError) {
        captureToSentry(scrubbedSentryError, entry.metadata).catch(() => { /* no-op */ });
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
