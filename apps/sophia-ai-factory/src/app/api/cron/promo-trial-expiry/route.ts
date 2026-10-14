/**
 * Promo Trial Expiry Cron — daily at 00:00 UTC
 * Finds users with expired free trials and downgrades their tier.
 * Also sends "trial ended" email with upgrade CTA.
 * Schedule: "0 0 * * *" (already registered in wrangler.jsonc)
 * @module app/api/cron/promo-trial-expiry
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExpiredTrialUsers } from '@/land/promo/promo-repo';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { logger } from '@/seed/utils/logger-utility';
import { getD1 } from '@/seed/db/client';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';
import {
  downgradeExpiredTrial,
  getTrialEndingSoon,
  sendTrialEndedEmail,
  sendTrialWarningEmail,
} from './promo-trial-helpers';

const CRON_NAME = 'promo-trial-expiry';

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const nowSec = Math.floor(Date.now() / 1000);
  let expired = 0;
  let warned = 0;
  let failed = 0;

  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');

    const expiredUsers = await getExpiredTrialUsers(nowSec);
    logger.info(`[${CRON_NAME}] Found ${expiredUsers.length} expired trials`);

    for (const { user_id, email } of expiredUsers) {
      try {
        await downgradeExpiredTrial(db, user_id);
        if (email) await sendTrialEndedEmail(email);
        expired++;
      } catch (err) {
        failed++;
        logger.error(`[${CRON_NAME}] Failed for user`, err instanceof Error ? err : undefined, { user_id });
      }
    }

    const endingSoon = await getTrialEndingSoon(db, nowSec, 3);
    for (const { email } of endingSoon) {
      try {
        if (email) {
          await sendTrialWarningEmail(email, 3);
          warned++;
        }
      } catch (err) {
        logger.warn(`[${CRON_NAME}] Warning email failed`, { error: String(err) });
      }
    }

    logger.info(`[${CRON_NAME}] Done`, { expired, warned, failed });
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, expired, warned, failed, cron: CRON_NAME });
  } catch (err) {
    logger.error(`[${CRON_NAME}] Fatal error`, err instanceof Error ? err : undefined);
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'unknown' }, { status: 500 });
  }
}
