/**
 * Logger Internals — formatting, log dispatch, and arg resolution.
 * Consumed by logger-utility.ts. Do not import from logger-utility.ts here.
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

const isDevelopment = process.env.NODE_ENV === 'development';

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
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    requestId,
    metadata,
  };

  if (error) {
    const errRecord = error as Error & { code?: unknown; details?: unknown; hint?: unknown };
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(errRecord.code !== undefined && { code: errRecord.code }),
      ...(errRecord.details !== undefined && { details: errRecord.details }),
      ...(errRecord.hint !== undefined && { hint: errRecord.hint }),
    };
  }

  const formatted = formatLogEntry(entry);

  switch (level) {
    case 'error':
      console.error(formatted);
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
