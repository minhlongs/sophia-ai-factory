/**
 * Usage Metering - Debug Logger
 *
 * Local debug logging for usage metering development
 * Writes to file and console when DEBUG_USAGE_METERING is enabled
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { logger } from '@/lib/utils/logger-utility';

const DEBUG_ENABLED = process.env.DEBUG_USAGE_METERING === 'true';
const DEBUG_LOG_FILE = process.env.USAGE_DEBUG_LOG_FILE || '/tmp/usage_debug.log';

/**
 * Debug logger for usage metering
 */
export const debugLogger = {
  /**
   * Log a debug message
   *
   * @param message - Message to log
   * @param data - Optional data to log
   */
  log(message: string, data?: unknown): void {
    if (!DEBUG_ENABLED) return;

    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}${data ? ' ' + JSON.stringify(data, null, 2) : ''}\n`;

    // Ensure directory exists
    const logDir = dirname(DEBUG_LOG_FILE);
    if (!existsSync(logDir)) {
      try {
        mkdirSync(logDir, { recursive: true });
      } catch (error) {
        logger.error('[Usage Debug] Failed to create log directory', error as Error);
      }
    }

    // Write to file
    try {
      appendFileSync(DEBUG_LOG_FILE, logLine);
    } catch (error) {
      logger.error('[Usage Debug] Failed to write to log file', error as Error);
    }

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      logger.info('[Usage Debug]', { message, data });
    }
  },

  /**
   * Clear the debug log file
   */
  clear(): void {
    if (existsSync(DEBUG_LOG_FILE)) {
      try {
        appendFileSync(DEBUG_LOG_FILE, '');
      } catch (error) {
        logger.error('[Usage Debug] Failed to clear log file', error as Error);
      }
    }
  },

  /**
   * Check if debug mode is enabled
   */
  isEnabled(): boolean {
    return DEBUG_ENABLED;
  },

  /**
   * Get the log file path
   */
  getLogFilePath(): string {
    return DEBUG_LOG_FILE;
  },
};

/**
 * Decorator for logging function calls
 */
export function logFunctionCall<T extends (...args: unknown[]) => unknown>(
  target: Record<string, unknown>,
  propertyKey: string,
  descriptor: TypedPropertyDescriptor<T>
): TypedPropertyDescriptor<T> {
  const originalMethod = descriptor.value;

  if (!originalMethod) {
    return descriptor;
  }

  // @ts-expect-error - TypeScript generic constraint limitation
  descriptor.value = function (...args: unknown[]) {
    if (!DEBUG_ENABLED) {
      return originalMethod.apply(this, args);
    }

    const startTime = Date.now();
    debugLogger.log(`[Function Call] ${propertyKey}() called`, { args });

    try {
      const result = originalMethod.apply(this, args);

      if (result instanceof Promise) {
        return result.then(resolvedResult => {
          debugLogger.log(`[Function Return] ${propertyKey}() completed`, {
            duration: Date.now() - startTime,
            result: resolvedResult,
          });
          return resolvedResult;
        });
      }

      debugLogger.log(`[Function Return] ${propertyKey}() completed`, {
        duration: Date.now() - startTime,
        result,
      });
      return result;
    } catch (error) {
      debugLogger.log(`[Function Error] ${propertyKey}() failed`, {
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  return descriptor;
}
