import { NextResponse } from 'next/server';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { shouldDispatch } from '@/seed/utils/circuit-breaker';
import {
  CRON_NAME,
  IDEMPOTENCY_WINDOW_MS,
  type RetrySummary,
} from './types';
import { findDueRetryVideos } from './retry-queue-finder';
import { processRowRetry } from './backoff-runner';

/**
 * Executes the complete fulfillment retry cron orchestration run.
 */
export async function runFulfillmentRetryCron(): Promise<NextResponse> {
  const cronCtx = startCronCheckIn(CRON_NAME);
  let db: D1Database;
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 database binding not available');
    db = _db;
  } catch (err) {
    logger.error('[fulfillment-retry] D1 unavailable', err instanceof Error ? err : undefined);
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ status: 'error', idempotent: false, error: 'db_unavailable' });
  }

  // Idempotency guard: skip if already ran within the last 90s
  if (await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ status: 'ok', idempotent: true, skipped: 'recent_run' });
  }

  const summary: RetrySummary = { retried: 0, succeeded: 0, failed: 0, permanent: 0, skipped: 0, circuitBlocked: 0 };
  const now = Math.floor(Date.now() / 1000);

  // Check circuit breaker once per cron run — if open, skip all HeyGen attempts
  const dispatch = await shouldDispatch();
  if (!dispatch.allowed) {
    logger.warn('[fulfillment-retry] Circuit breaker blocked entire cron run', { reason: dispatch.reason });
    await recordCronRun(db, CRON_NAME, 'success');
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ status: 'ok', idempotent: false, ...summary, circuitBlocked: -1 });
  }

  try {
    const { dueRows, skippedCount } = await findDueRetryVideos(now);
    summary.skipped = skippedCount;

    const startTime = Date.now();
    const CHUNK_SIZE = 5;
    const MAX_WALL_TIME_MS = 20000;

    for (let i = 0; i < dueRows.length; i += CHUNK_SIZE) {
      if (Date.now() - startTime > MAX_WALL_TIME_MS) {
        logger.warn('[fulfillment-retry] Wall-time safety threshold reached; aborting remaining chunks', {
          elapsedMs: Date.now() - startTime,
          processedCount: i,
          totalCount: dueRows.length,
        });
        break;
      }

      const chunk = dueRows.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map((row) => processRowRetry(row, summary)),
      );

      if (Date.now() - startTime > MAX_WALL_TIME_MS) {
        logger.warn('[fulfillment-retry] Wall-time threshold reached after chunk; stopping', {
          elapsedMs: Date.now() - startTime,
          processedChunks: Math.floor(i / CHUNK_SIZE) + 1,
          totalChunks: Math.ceil(dueRows.length / CHUNK_SIZE),
        });
        break;
      }
    }

    await recordCronRun(db, CRON_NAME, 'success');
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ status: 'ok', idempotent: false, ...summary });
  } catch (err) {
    const errMsg = getErrorMessage(err);
    logger.error('[fulfillment-retry] Cron run failed', err instanceof Error ? err : undefined);
    await recordCronRun(db, CRON_NAME, 'failure', errMsg);
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ status: 'error', idempotent: false, error: 'internal_error' });
  }
}
