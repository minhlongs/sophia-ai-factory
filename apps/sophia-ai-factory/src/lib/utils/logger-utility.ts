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
    // New form: arg2 is a plain object { error?, ...metadata }
    // arg3 is the optional requestId string; arg4 is not used in this form
    const { error: embeddedErr, ...rest } = arg2 as Record<string, unknown>;
    const err = embeddedErr instanceof Error ? embeddedErr : undefined;
    const meta = Object.keys(rest).length > 0 ? rest : undefined;
    return { err, meta, reqId: arg3 as string | undefined };
  }
  // Legacy form
  return { err: arg2 as Error | undefined, meta: arg3, reqId: arg4 };
}

export const logger = {
  debug: (message: string, metadata?: Record<string, unknown>, requestId?: string) => {
    log('debug', message, metadata, undefined, requestId);
  },

  info: (message: string, metadata?: Record<string, unknown>, requestId?: string) => {
    log('info', message, metadata, undefined, requestId);
  },

  warn: (message: string, metadata?: Record<string, unknown>, requestId?: string) => {
    log('warn', message, metadata, undefined, requestId);
  },

  /**
   * Two supported call forms:
   *   Legacy: error(message, error?, metadata?, requestId?)
   *   New:    error(message, { error?, ...metadata }, requestId?)
   */
  error: (
    message: string,
    arg2?: Error | Record<string, unknown>,
    arg3?: Record<string, unknown> | string,
    arg4?: string
  ) => {
    // Normalise arg3 — in legacy form it's metadata (object); in new form it would be requestId (string)
    const meta3 = typeof arg3 === 'object' ? arg3 : undefined;
    const reqId3 = typeof arg3 === 'string' ? arg3 : arg4;
    const { err, meta, reqId } = resolveErrorArgs(
      arg2 as Error | Record<string, unknown> | undefined,
      meta3,
      reqId3
    );
    log('error', message, meta, err, reqId);
  },

  /**
   * Create a logger with a bound request ID
   */
  withRequestId: (requestId: string) => ({
    debug: (message: string, metadata?: Record<string, unknown>) =>
      logger.debug(message, metadata, requestId),
    info: (message: string, metadata?: Record<string, unknown>) =>
      logger.info(message, metadata, requestId),
    warn: (message: string, metadata?: Record<string, unknown>) =>
      logger.warn(message, metadata, requestId),
    error: (
      message: string,
      arg2?: Error | Record<string, unknown>,
      arg3?: Record<string, unknown> | string
    ) => logger.error(message, arg2, arg3, requestId),
  }),
};

export default logger;
