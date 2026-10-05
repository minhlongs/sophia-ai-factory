/**
 * Email Outbox Flush Cron
 * Processes pending welcome emails with retry logic.
 * Schedule: Every 1 minute (reuses existing cron slot: every-1-min)
 * @module app/api/cron/email-outbox-flush
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { flushOutbox } from '@/tree/email/outbox';
import { logger } from '@/seed/utils/logger-utility';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';
import { getD1 } from '@/seed/db/client';

const CRON_NAME = 'email-outbox-flush';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const db = await getD1();
  if (!db) {
    logger.warn('[email-outbox-flush] D1 not available');
    failCronCheckIn(cronCtx, CRON_NAME, new Error('D1 not available'));
    return NextResponse.json({ ok: false, error: 'D1 not available' }, { status: 503 });
  }

  try {
    const summary = await flushOutbox(db);
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[email-outbox-flush] Flush failed', err instanceof Error ? err : new Error(msg));
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
