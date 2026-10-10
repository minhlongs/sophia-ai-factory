import { LogLevel } from './types';
import { safeLog } from '@/seed/observability/telemetry/safe-log';
import { LogBuffer } from '@/seed/observability/telemetry/log-buffer';
import { pushBatch, type BetterStackConfig } from '@/seed/observability/telemetry/better-stack-client';

declare global {
  var __betterStackBuffer: { buffer: LogBuffer } | undefined;
  var __betterStackFlushScheduled: boolean | undefined;
}

export function getBetterStackBuffer(): { buffer: LogBuffer } {
  if (!globalThis.__betterStackBuffer) {
    globalThis.__betterStackBuffer = {
      buffer: new LogBuffer(),
    };
  }
  return globalThis.__betterStackBuffer;
}

export async function flushBetterStackBuffer(): Promise<number> {
  const { buffer } = getBetterStackBuffer();
  const entries = buffer.flush();
  const dropped = buffer.droppedCount;
  buffer.droppedCount = 0;
  const config = {
    logsToken: process.env.BETTER_STACK_LOGS_TOKEN ?? '',
    ingestingHost: process.env.BETTER_STACK_INGESTING_HOST,
  };
  if (entries.length && config.logsToken) {
    await pushBatch(entries, config);
  }
  return dropped;
}

export function getBetterStackConfig(): BetterStackConfig {
  return {
    logsToken: process.env.BETTER_STACK_LOGS_TOKEN ?? '',
    ingestingHost: process.env.BETTER_STACK_INGESTING_HOST,
  };
}

export function scheduleBetterStackLog(entry: ReturnType<typeof safeLog>): void {
  const config = getBetterStackConfig();
  if (!config.logsToken) return;

  getBetterStackBuffer().buffer.push(entry);
  if (globalThis.__betterStackFlushScheduled) return;

  globalThis.__betterStackFlushScheduled = true;
  queueMicrotask(() => {
    globalThis.__betterStackFlushScheduled = false;
    void flushBetterStackBuffer();
  });
}

export function pushToBetterStack(
  lvl: LogLevel,
  msg: string,
  meta?: Record<string, unknown>,
  reqId?: string,
  errData?: { name: string; message: string; stack?: string },
): void {
  try {
    const ctx: Record<string, unknown> = {
      ...(meta ?? {}),
      commit: process.env.COMMIT_SHA ?? 'unknown',
    };
    if (reqId) ctx.requestId = reqId;
    if (errData) ctx.error = errData;
    scheduleBetterStackLog(safeLog(lvl, msg, ctx));
  } catch {
    // Logging must never affect request execution.
  }
}
