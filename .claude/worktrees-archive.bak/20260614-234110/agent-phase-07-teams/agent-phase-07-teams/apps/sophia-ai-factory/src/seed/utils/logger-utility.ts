/**
 * Structured JSON Logger Utility
 * Provides consistent logging with levels, request IDs, and metadata.
 * Format: JSON in production, pretty-print in development.
 *
 * Internals (formatLogEntry, log, dispatch, resolveErrorArgs) live in logger-internals.ts.
 */

import { dispatch } from '@/seed/utils/logger-internals';

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

  /** Create a logger with a bound request ID */
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
