/**
 * Affiliate lifecycle email sweep helper.
 * @module app/api/cron/email-drip/sweep-affiliate
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { evaluateAffiliateLifecycleEmails } from '@/tree/email/lifecycle-email-rules';
import { getAffiliateClickStats } from '@/land/affiliates/dashboard-stats';
import { processDecisions } from './sweep-helpers';
import type { UserRow, AffiliateEnrollmentRow } from './email-drip-types';

export async function runAffiliateLifecycleSweep(
  db: D1Database,
  now: number,
  nowSec: number,
): Promise<number> {
  let affiliateCount = 0;
  const affiliateWindowMs = 8 * 24 * 3600 * 1000;
  const affiliates = await db
    .prepare(
      `SELECT user_id, code, created_at
       FROM referral_codes
       WHERE user_id IS NOT NULL
         AND datetime(created_at) >= datetime('now', '-8 days')
         AND datetime(created_at) <= datetime('now', '-12 hours')`,
    )
    .all<AffiliateEnrollmentRow>();

  for (const aff of affiliates.results ?? []) {
    try {
      const userRow = await db
        .prepare(`SELECT id, email, name FROM user WHERE id = ?1 LIMIT 1`)
        .bind(aff.user_id)
        .first<UserRow>();
      if (!userRow) continue;

      const enrolledMs = Date.parse(aff.created_at);
      if (Number.isNaN(enrolledMs)) continue;
      if (now - enrolledMs > affiliateWindowMs) continue;

      const since7d = Math.floor((now - 7 * 24 * 3600 * 1000) / 1000);
      const stats = await getAffiliateClickStats(
        aff.user_id, aff.user_id, since7d, nowSec,
      ).catch(() => null);

      const decisions = evaluateAffiliateLifecycleEmails(
        {
          enrolledAt: enrolledMs,
          ownerFullName: userRow.name ?? userRow.email.split('@')[0],
          locale: 'en',
          referralCode: aff.code,
          totalClicks: stats?.totalClicks,
          totalConversions: stats?.totalConversions,
          pendingEarningsUsd: stats?.totalCommissionUsd,
        },
        now,
      );

      affiliateCount += await processDecisions(
        db, aff.user_id, userRow.email, decisions, nowSec,
        `affiliate ${aff.user_id}`,
      );
    } catch (e) {
      logger.error(`[email-drip] Affiliate sweep failed for ${aff.user_id}`, toError(e));
    }
  }

  return affiliateCount;
}
