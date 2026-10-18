/**
 * Dunning Advance Cron
 *
 * Advances overdue dunning states:
 * - past_due + grace period expired → suspended
 * - delinquent + no retry in window → suspended
 *
 * Schedule: Daily via Cloudflare Cron Trigger (0 1 * * *)
 * Auth: x-cron-secret header or x-cf-cron: true
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { runDunningAdvanceBatch } from './dunning-advance-processor';

const CRON_NAME = 'dunning-advance';
/** Daily — skip if ran within last 12 hours */
const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const d1 = await getD1();

  if (d1 && await wasRecentlyRun(d1, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ status: 'ok', idempotent: true, skipped: 'recent_run' });
  }

  try {
    const db = createServerClient();
    const { advanced, errors } = await runDunningAdvanceBatch(db, new Date());

    logger.info('[DunningAdvance] Cron complete', { advanced, errors });
    if (d1) await recordCronRun(d1, CRON_NAME, 'success');
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ status: 'ok', idempotent: false, advanced, errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[DunningAdvance] Critical error', new Error(message));
    if (d1) await recordCronRun(d1, CRON_NAME, 'failure', message);
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ status: 'error', idempotent: false, error: message });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
