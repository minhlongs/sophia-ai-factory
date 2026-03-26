/**
 * Usage Metering - Debug Logger
 *
 * Console-based debug logging for usage metering development.
 * Edge Runtime compatible (no fs/path imports).
 */

import { logger } from '@/lib/utils/logger-utility';

const DEBUG_ENABLED = process.env.DEBUG_USAGE_METERING === 'true';

/**
 * Debug logger for usage metering
 */
export const debugLogger = {
  log(message: string, data?: unknown): void {
    if (!DEBUG_ENABLED) return;
    logger.info('[Usage Debug]', { message, ...(data ? { data } : {}) });
  },

  clear(): void {
    // No-op in Edge-compatible mode
  },

  isEnabled(): boolean {
    return DEBUG_ENABLED;
  },

  getLogFilePath(): string {
    return '(console-only)';
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
