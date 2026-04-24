/**
 * Structured JSON Logger Utility
 * Provides consistent logging with levels, request IDs, and metadata
 * Format: JSON in production, pretty-print in development
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Format log entry for output
 */
const formatLogEntry = (entry: LogEntry): string => {
  if (isDevelopment) {
    // Pretty print in development
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
      if (entry.error.stack) {
        output += `\n${entry.error.stack}`;
      }
    }

    return output;
  }

  // JSON in production
  return JSON.stringify(entry);
};

/**
 * Create log entry and output to console
 */
const log = (
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
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  const formatted = formatLogEntry(entry);

  // Use console methods for Edge Runtime compatibility
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

/**
 * Resolve overloaded error() arguments into (metadata, error) pair.
 *
 * Supports two call forms:
 *   Legacy:  error(msg, error?, metadata?, requestId?)
 *   New:     error(msg, { error?, ...metadata }, requestId?)
 *
 * When the second argument is a plain object (not an Error instance),
 * it is treated as the new form: `error` key pulled out, rest is metadata.
 */
function resolveErrorArgs(
  arg2: Error | Record<string, unknown> | undefined,
  arg3: Record<string, unknown> | undefined,
  arg4: string | undefined
): { err: Error | undefined; meta: Record<string, unknown> | undefined; reqId: string | undefined } {
  if (arg2 !== undefined && !(arg2 instanceof Error)) {
    const record = arg2 as Record<string, unknown>;
    const embeddedErr = record.error;
    if (embeddedErr instanceof Error) {
      // New form with genuine Error — pull it out, rest becomes metadata
      const { error: _pulled, ...rest } = record;
      void _pulled;
      const meta = Object.keys(rest).length > 0 ? rest : undefined;
      return { err: embeddedErr, meta, reqId: arg3 as string | undefined };
    }
    // Non-Error `error` value (string/number/object) — keep the whole record
    // as metadata so the value is preserved in output (no silent data loss).
    return { err: undefined, meta: record, reqId: arg3 as string | undefined };
  }
  // Legacy form — narrowing already guarantees arg2 is Error | undefined here
  return { err: arg2, meta: arg3, reqId: arg4 };
}

/**
 * Shared dispatch for debug/info/warn/error — resolves overloaded args and logs at the given level.
 *
 * Supports three call forms for all four levels:
 *   Metadata only: level(msg, metadata?, requestId?)
 *   Legacy error:  level(msg, errorInstance, metadata?, requestId?)
 *   New embedded:  level(msg, { error?, ...metadata }, requestId?)
 */
function dispatch(
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

export const logger = {
  debug: (
    message: string,
    arg2?: Error | Record<string, unknown>,
    arg3?: Record<string, unknown> | string,
    arg4?: string
  ) => dispatch('debug', message, arg2, arg3, arg4),

  info: (
    message: string,
    arg2?: Error | Record<string, unknown>,
    arg3?: Record<string, unknown> | string,
    arg4?: string
  ) => dispatch('info', message, arg2, arg3, arg4),

  warn: (
    message: string,
    arg2?: Error | Record<string, unknown>,
    arg3?: Record<string, unknown> | string,
    arg4?: string
  ) => dispatch('warn', message, arg2, arg3, arg4),

  error: (
    message: string,
    arg2?: Error | Record<string, unknown>,
    arg3?: Record<string, unknown> | string,
    arg4?: string
  ) => dispatch('error', message, arg2, arg3, arg4),

  /**
   * Create a logger with a bound request ID
   */
  withRequestId: (requestId: string) => ({
    debug: (message: string, arg2?: Error | Record<string, unknown>, arg3?: Record<string, unknown> | string) =>
      logger.debug(message, arg2, arg3, requestId),
    info: (message: string, arg2?: Error | Record<string, unknown>, arg3?: Record<string, unknown> | string) =>
      logger.info(message, arg2, arg3, requestId),
    warn: (message: string, arg2?: Error | Record<string, unknown>, arg3?: Record<string, unknown> | string) =>
      logger.warn(message, arg2, arg3, requestId),
    error: (message: string, arg2?: Error | Record<string, unknown>, arg3?: Record<string, unknown> | string) =>
      logger.error(message, arg2, arg3, requestId),
  }),
};

export default logger;
