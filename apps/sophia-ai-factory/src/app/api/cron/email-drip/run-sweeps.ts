/**
 * Orchestrates email-drip sweep queries and returns enqueue counts.
 * Delegates activation/rest sweeps to sweep-activation-rest.ts.
 * @module app/api/cron/email-drip/run-sweeps
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { evaluateLifecycleEmails } from '@/tree/email/lifecycle-email-rules';
import { computeWeekStats } from '@/tree/email/week-stats';
import { processDecisions } from './sweep-helpers';
import { runActivationAndRestSweeps, type ActivationSweepCounts } from './sweep-activation-rest';
import { runAffiliateLifecycleSweep } from './sweep-affiliate';
import type { HandoverRow, UserRow } from './email-drip-types';

export interface SweepCounts extends ActivationSweepCounts {
  handover: number;
  affiliate: number;
}

/**
 * Run all lifecycle email sweeps and return per-sweep enqueue counts.
 */
export async function runAllSweeps(
  db: D1Database,
  now: number,
  nowSec: number,
): Promise<SweepCounts> {
  const window7d = 7.5 * 24 * 3600 * 1000;
  const window0_5d = 0.5 * 24 * 3600 * 1000;

  let handoverCount = 0;

  // ── Handover lifecycle sweep ──────────────────────────────────────────
  const handovers = await db
    .prepare(
      `SELECT id, customer_user_id, created_at, customer_first_login_at,
              customer_first_sop_install_at, agency_name, trigger_payment_id, source
       FROM customer_handovers
       WHERE created_at BETWEEN ?1 AND ?2`,
    )
    .bind(
      Math.floor((now - window7d) / 1000),
      Math.floor((now - window0_5d) / 1000),
    )
    .all<HandoverRow>();

  for (const handover of handovers.results ?? []) {
    try {
      const userRow = await db
        .prepare(`SELECT id, email, name FROM user WHERE id = ?1 LIMIT 1`)
        .bind(handover.customer_user_id)
        .first<UserRow>();
      if (!userRow) continue;

      const weekStats = handover.customer_first_login_at
        ? await computeWeekStats(db, handover.customer_user_id)
        : null;

      const decisions = evaluateLifecycleEmails(
        {
          createdAt: handover.created_at * 1000,
          firstLoginAt: handover.customer_first_login_at ? handover.customer_first_login_at * 1000 : null,
          firstSopInstallAt: handover.customer_first_sop_install_at ? handover.customer_first_sop_install_at * 1000 : null,
          ownerFullName: userRow.name ?? userRow.email.split('@')[0],
          locale: 'vi',
        },
        weekStats,
        now,
      );

      handoverCount += await processDecisions(
        db, handover.customer_user_id, userRow.email, decisions, nowSec,
        `handover ${handover.id}`,
      );
    } catch (e) {
      logger.error(`[email-drip] Failed for handover ${handover.id}`, toError(e));
    }
  }

  // ── Affiliate lifecycle sweep ─────────────────────────────────────────
  const affiliateCount = await runAffiliateLifecycleSweep(db, now, nowSec);

  // ── Activation + remaining sweeps ────────────────────────────────────
  const restCounts = await runActivationAndRestSweeps(db, now, nowSec);

  return {
    handover: handoverCount,
    affiliate: affiliateCount,
    ...restCounts,
  };
}
