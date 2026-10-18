/**
 * Daily Hash Chain Verification Cron
 *
 * SOC 2 CC7.2: Automated monitoring of audit log integrity.
 * Runs daily, verifies hash chain continuity, and sends alerts if broken.
 *
 * Schedule: Daily at 03:30 UTC (via wrangler.toml)
 * Auth: CRON_SECRET via Authorization: Bearer, x-cron-secret, or ?token=
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';
import { toError } from '@/seed/utils/to-error';
import {
  CRON_NAME,
  IDEMPOTENCY_WINDOW_MS,
  runHashChainVerification,
} from './verify-hash-chain-runner';

export const dynamic = 'force-dynamic';

interface Env {
  DB?: D1Database;
}

export async function GET(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) {
    return authError;
  }

  const cronCtx = startCronCheckIn(CRON_NAME);
  const db = (globalThis as unknown as Env).DB;
  const startedAt = Date.now();

  if (db) {
    const alreadyRan = await wasRecentlyRun(db as D1Database, CRON_NAME, IDEMPOTENCY_WINDOW_MS);
    if (alreadyRan) {
      finishCronCheckIn(cronCtx, CRON_NAME);
      return NextResponse.json(
        {
          status: 'skipped',
          reason: 'recently_run',
        },
        { status: 200 },
      );
    }
  }

  try {
    return await runHashChainVerification(db, cronCtx, startedAt);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logger.error('[hash-chain-verification] Unexpected error', { error: String(error), durationMs });

    if (db) {
      await recordCronRun(db as D1Database, CRON_NAME, 'failure', String(error)).catch(() => {});
    }
    failCronCheckIn(cronCtx, CRON_NAME, toError(error));

    return NextResponse.json(
      {
        error: 'Verification failed',
        details: String(error),
      },
      { status: 500 },
    );
  }
}
