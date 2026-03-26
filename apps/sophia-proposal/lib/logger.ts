/**
 * Structured logger for Sophia Proposal.
 * Outputs JSON-formatted log entries for centralized log aggregation.
 * Wraps console methods — swap transport here without touching call sites.
 *
 * Format: { timestamp, level, message, context?, error? }
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface RequestContext {
  path?: string;
  method?: string;
  orgId?: string;
  userId?: string;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: RequestContext | Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

function buildEntry(
  level: LogLevel,
  message: string,
  context?: RequestContext | Record<string, unknown>,
  err?: unknown,
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context) entry.context = context;

  if (err) {
    if (err instanceof Error) {
      entry.error = {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
    } else {
      entry.error = {
        name: 'UnknownError',
        message: String(err),
      };
    }
  }

  return entry;
}

function serialize(entry: LogEntry): string {
  try {
    return JSON.stringify(entry);
  } catch {
    // Fallback if entry contains non-serializable values
    return JSON.stringify({ ...entry, context: '[unserializable]', error: String(entry.error) });
  }
}

export const logger = {
  debug(message: string, context?: RequestContext | Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'production') return;
    console.debug(serialize(buildEntry('debug', message, context)));
  },

  info(message: string, context?: RequestContext | Record<string, unknown>): void {
    console.info(serialize(buildEntry('info', message, context)));
  },

  warn(message: string, context?: RequestContext | Record<string, unknown>): void {
    console.warn(serialize(buildEntry('warn', message, context)));
  },

  error(
    message: string,
    err?: unknown,
    context?: RequestContext | Record<string, unknown>,
  ): void {
    console.error(serialize(buildEntry('error', message, context, err)));
  },
};
