/**
 * Structured JSON Logger Utility
 * Provides consistent logging with levels, request IDs, and metadata.
 * Format: JSON in production, pretty-print in development.
 *
 * Internals (formatLogEntry, log, dispatch, resolveErrorArgs) live in logger-internals.ts.
 */

import { dispatch } from '@/seed/utils/logger-internals';

export interface Logger {
  debug: (message: string, arg2?: Error | Record<string, unknown>, arg3?: Record<string, unknown> | string, arg4?: string) => void;
  info: (message: string, arg2?: Error | Record<string, unknown>, arg3?: Record<string, unknown> | string, arg4?: string) => void;
  warn: (message: string, arg2?: Error | Record<string, unknown>, arg3?: Record<string, unknown> | string, arg4?: string) => void;
  error: (message: string, arg2?: Error | Record<string, unknown>, arg3?: Record<string, unknown> | string, arg4?: string) => void;
  withRequestId: (requestId: string) => Logger;
  child: (context: string) => Logger;
  readonly context: string;
}

/** Create a logger with a bound context */
export function createLogger(context: string): Logger {
  const meta = { context };
  const create = (ctx: string): Logger => ({
    debug: (message, arg2, arg3, arg4) => dispatch("debug", message, arg2, arg3 ? { ...(typeof arg3 === "object" ? arg3 : {}), ...meta } : meta, arg4),
    info: (message, arg2, arg3, arg4) => dispatch("info", message, arg2, arg3 ? { ...(typeof arg3 === "object" ? arg3 : {}), ...meta } : meta, arg4),
    warn: (message, arg2, arg3, arg4) => dispatch("warn", message, arg2, arg3 ? { ...(typeof arg3 === "object" ? arg3 : {}), ...meta } : meta, arg4),
    error: (message, arg2, arg3, arg4) => dispatch("error", message, arg2, arg3 ? { ...(typeof arg3 === "object" ? arg3 : {}), ...meta } : meta, arg4),
    withRequestId: (requestId: string) => create(`${ctx}[req:${requestId}]`),
    child: (childContext: string) => create(`${ctx}.${childContext}`),
    get context() { return ctx; },
  });

  return create(context);
}

export const logger = createLogger('seed/utils');

export default logger;
