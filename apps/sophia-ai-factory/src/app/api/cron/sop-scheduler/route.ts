/**
 * SOP Scheduler Cron Endpoint
 *
 * Triggered every 5 minutes by Cloudflare Cron → inject-scheduled-handler.mjs.
 * Claims and executes due SOP installations.
 *
 * Auth: Bearer CRON_SECRET (same pattern as all cron routes).
 * Idempotency: claimDueInstallations advances schedule atomically.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { handleSopSchedulerTick } from '@/land/cron/sop-scheduler';
import { runSop } from '@/forest/missions/sop-runner';
import { logger } from '@/seed/utils/logger-utility';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';

const CRON_NAME = 'sop-scheduler';

export const dynamic = 'force-dynamic';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);

  const db = getD1();
  if (!db) {
    logger.error('[cron/sop-scheduler] D1 binding not available');
    failCronCheckIn(cronCtx, CRON_NAME, new Error('DB binding unavailable'));
    return NextResponse.json({ ok: false, error: 'DB binding unavailable' }, { status: 500 });
  }

  try {
    const { processed } = await handleSopSchedulerTick(db, runSop);
    logger.info('[cron/sop-scheduler] Complete', { processed });
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[cron/sop-scheduler] Fatal error', err instanceof Error ? err : new Error(msg));
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return GET(request);
}
