/**
 * Structured JSON logger — wraps safeLog + LogBuffer.
 * All logs go through PII scrubbing before buffer push.
 * Batch flush via ctx.waitUntil() after response — zero hot-path subrequests.
 * Raw console.log FORBIDDEN in this module (eslint: no-console except below).
 */

import { safeLog, type LogLevel } from './safe-log';
import { LogBuffer } from './log-buffer';
import { pushBatch, type BetterStackConfig } from './better-stack-client';

// One buffer per request — caller must create and pass it
// Module-level default buffer for cases where no ctx is available (e.g. global errors)
const globalBuffer = new LogBuffer();

function buildConfig(): BetterStackConfig {
  return {
    logsToken: process.env.BETTER_STACK_LOGS_TOKEN ?? '',
    ingestingHost: process.env.BETTER_STACK_INGESTING_HOST,
  };
}

function log(
  level: LogLevel,
  msg: string,
  ctx: Record<string, unknown> = {},
  buffer: LogBuffer = globalBuffer
): void {
  const commit = process.env.COMMIT_SHA ?? 'unknown';
  const payload = safeLog(level, msg, { ...ctx, commit });
  buffer.push(payload);
}

export const logger = {
  debug(msg: string, ctx?: Record<string, unknown>, buf?: LogBuffer) {
    log('debug', msg, ctx, buf);
  },
  info(msg: string, ctx?: Record<string, unknown>, buf?: LogBuffer) {
    log('info', msg, ctx, buf);
  },
  warn(msg: string, ctx?: Record<string, unknown>, buf?: LogBuffer) {
    log('warn', msg, ctx, buf);
  },
  error(msg: string, ctx?: Record<string, unknown>, buf?: LogBuffer) {
    log('error', msg, ctx, buf);
  },
  fatal(msg: string, ctx?: Record<string, unknown>, buf?: LogBuffer) {
    log('fatal', msg, ctx, buf);
  },
};

/**
 * Flush a buffer to Better Stack.
 * Call inside ctx.waitUntil() so it runs after response is sent.
 * Returns dropped count for metrics tracking.
 */
export async function flushBuffer(buffer: LogBuffer): Promise<number> {
  const entries = buffer.flush();
  const dropped = buffer.droppedCount;
  if (entries.length) {
    await pushBatch(entries, buildConfig());
  }
  return dropped;
}

/**
 * Flush the global buffer (used for non-request-scoped logging).
 */
export async function flushGlobalBuffer(): Promise<number> {
  return flushBuffer(globalBuffer);
}

export { LogBuffer };
