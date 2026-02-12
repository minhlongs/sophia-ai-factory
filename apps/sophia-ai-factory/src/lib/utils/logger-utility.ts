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

  error: (
    message: string,
    error?: Error,
    metadata?: Record<string, unknown>,
    requestId?: string
  ) => {
    log('error', message, metadata, error, requestId);
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
    error: (message: string, error?: Error, metadata?: Record<string, unknown>) =>
      logger.error(message, error, metadata, requestId),
  }),
};

export default logger;
