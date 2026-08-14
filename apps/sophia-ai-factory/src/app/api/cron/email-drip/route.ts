/**
 * Email Drip Cron — milestone-aware lifecycle email sequence.
 * Schedule: Daily at 04:00 UTC via Cloudflare Cron Trigger.
 * @module app/api/cron/email-drip/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';
import { getD1 } from './get-d1';
import { runAllSweeps } from './run-sweeps';

// Re-export extracted modules for barrel compatibility
export { getD1 } from './get-d1';
export { processDecisions } from './sweep-helpers';
export { runAllSweeps } from './run-sweeps';
export { runActivationAndRestSweeps } from './sweep-activation-rest';
export { runNonActivationSweeps } from './sweep-non-activation';
export type { SweepCounts } from './run-sweeps';
export type { ActivationSweepCounts } from './sweep-activation-rest';
export type { NonActivationSweepCounts } from './sweep-non-activation';
export type {
  HandoverRow,
  UserRow,
  AffiliateEnrollmentRow,
  ActivationCandidateRow,
  PostPurchaseCandidateRow,
  FirstVideoCandidateRow,
  ReEngagementCandidateRow,
  CancelledSubscriptionRow,
  EmailDecision,
} from './email-drip-types';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'email-drip';
const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const db = getD1();
  if (!db) {
    failCronCheckIn(cronCtx, CRON_NAME, new Error('D1 not available'));
    return NextResponse.json({ ok: false, error: 'D1 not available' }, { status: 503 });
  }

  if (await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  const now = Date.now();
  const nowSec = Math.floor(now / 1000);

  try {
    const counts = await runAllSweeps(db, now, nowSec);

    logger.info(
      `[email-drip] Completed. handover=${counts.handover} affiliate=${counts.affiliate} activation=${counts.activation} toolsNudge=${counts.toolsNudge} reEngagement=${counts.reEngagement} winBack=${counts.winBack} ppNudge=${counts.postPurchaseNudge} firstSuccess=${counts.firstSuccess}`,
    );
    await recordCronRun(db, CRON_NAME, 'success');
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, ...counts });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    const errDetail = err instanceof Error ? err.message : String(err);
    logger.error('[Cron:EmailDrip] ' + errorId, { error: errDetail });
    await recordCronRun(db, CRON_NAME, 'failure', 'internal_error');
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ ok: false, error: 'internal_error', ref: errorId }, { status: 500 });
  }
}
