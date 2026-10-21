/**
 * Affiliate NET-30 Payout Job
 *
 * Aggregates `payable` commissions past their 14-day anti-fraud hold into
 * `affiliate_payouts`. A commission becomes fundable once `payable_at` has
 * passed; each partner's mature total is batched once per daily run.
 *
 * Payout routing:
 *   - total < $50   → skipped (aggregation cost exceeds value moved)
 *   - total <= $500 → auto-approved, handed to the existing payout rails
 *   - total > $500  → pending_approval, requiring admin sign-off in
 *                     `/admin/affiliate-payouts`
 *
 * Idempotency comes from reserving the swept commissions: the moment a payout is
 * created, every commission it aggregated is stamped with that payout's id, so
 * the next run's query — which requires `payout_id IS NULL` — sees nothing left
 * to claim and cannot pay the same money twice. The reservation is released only
 * if the payout is later cancelled.
 *
 * Layer: forest (infrastructure orchestrator)
 *
 * @module forest/inngest/functions/affiliate-net30-payout
 */

import type { D1Database } from '@cloudflare/workers-types';
import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { createPayoutDisbursement } from '@/tree/affiliates/ledger/payout-disbursement';
import { linkCommissionsToPayout } from '@/tree/affiliates/ledger/commission-payout-linker';
import { approvePayoutDisbursement } from '@/tree/affiliates/ledger/payout-lifecycle';
import {
  aggregateByPartner,
  isAboveMinimum,
  needsAdminApproval,
  summarizePayoutRun,
  type Net30PayoutResult,
  type PartnerPayoutOutcome,
  type PartnerPayoutPlan,
} from './affiliate-net30-payout-helpers';

export {
  aggregateByPartner,
  isAboveMinimum,
  needsAdminApproval,
  summarizePayoutRun,
  type Net30PayoutResult,
  type PartnerPayoutOutcome,
  type PartnerPayoutPlan,
};

interface MatureCommissionRow {
  partner_id: string;
  commission_count: number;
  total_cents: number | null;
}

/**
 * Creates one payout for a partner and, when the amount is within the
 * auto-approve ceiling, approves it immediately so the existing
 * disbursement rails can pick it up.
 */
async function settlePartner(
  db: D1Database,
  plan: PartnerPayoutPlan,
  nowMs: number,
): Promise<PartnerPayoutOutcome> {
  const created = await createPayoutDisbursement({
    d1: db,
    partnerId: plan.partnerId,
    rail: 'USDT',
    amountCents: plan.amountCents,
    currency: 'USD',
    destinationEncrypted: 'net30_auto_batch',
  });

  if (!created.success || !created.payoutId || !created.payoutReference) {
    logger.warn('[Net30Payout] Payout creation skipped', {
      partnerId: plan.partnerId,
      amountCents: plan.amountCents,
      reason: created.error,
    });
    return { ...plan, status: 'failed', reason: created.error ?? 'PAYOUT_NOT_CREATED' };
  }

  // Reserve what this payout was built from. Without this the commissions stay
  // `payable` with a null payout_id and the next sweep pays them again.
  const linked = await linkCommissionsToPayout({
    d1: db,
    payoutId: created.payoutId,
    partnerId: plan.partnerId,
    maturedBeforeMs: nowMs,
  });
  if (!linked.success) {
    logger.warn('[Net30Payout] Payout created but commissions not reserved', {
      payoutId: created.payoutId,
      partnerId: plan.partnerId,
      reason: linked.error,
    });
  } else if (linked.reservedCount !== plan.commissionCount) {
    logger.warn('[Net30Payout] Reserved fewer commissions than the run aggregated', {
      payoutId: created.payoutId,
      partnerId: plan.partnerId,
      aggregated: plan.commissionCount,
      reserved: linked.reservedCount,
    });
  }

  if (needsAdminApproval(plan.amountCents)) {
    return {
      ...plan,
      status: 'pending_approval',
      payoutId: created.payoutId,
      payoutReference: created.payoutReference,
    };
  }

  await approvePayoutDisbursement({
    d1: db,
    payoutId: created.payoutId,
    currentVersion: 1,
    approvedBy: 'system:net30',
  });

  return {
    ...plan,
    status: 'auto_approved',
    payoutId: created.payoutId,
    payoutReference: created.payoutReference,
  };
}

/**
 * Aggregates mature commissions and creates payouts for every partner that
 * clears the minimum.
 */
export async function runNet30PayoutJob(db: D1Database): Promise<Net30PayoutResult> {
  const nowMs = Date.now();

  const mature = await db
    .prepare(
      `SELECT partner_id, COUNT(*) AS commission_count, SUM(commission_cents) AS total_cents
       FROM affiliate_commissions
       WHERE status = 'payable'
         AND (payable_at IS NULL OR payable_at <= ?)
         AND payout_id IS NULL
       GROUP BY partner_id`,
    )
    .bind(nowMs)
    .all<MatureCommissionRow>();

  const plans = aggregateByPartner(mature.results ?? []);
  const outcomes: PartnerPayoutOutcome[] = [];

  for (const plan of plans) {
    if (!isAboveMinimum(plan.amountCents)) {
      outcomes.push({ ...plan, status: 'skipped_below_minimum' });
      continue;
    }

    try {
      outcomes.push(await settlePartner(db, plan, nowMs));
    } catch (err) {
      logger.error('[Net30Payout] Unexpected payout error', {
        partnerId: plan.partnerId,
        error: String(err),
      });
      outcomes.push({ ...plan, status: 'failed', reason: String(err) });
    }
  }

  return summarizePayoutRun(outcomes, plans.length);
}

/**
 * Daily sweep that converts matured affiliate commissions into payouts.
 */
export const affiliateNet30PayoutJob = inngest.createFunction(
  {
    id: 'affiliate-net30-payout-daily',
    name: 'Affiliate NET-30 Payout Sweep — Daily',
    concurrency: { limit: 1 },
  },
  { cron: '0 3 * * *' },
  async ({ step }) => {
    const db = await getD1();
    if (!db) {
      logger.error('[Net30Payout] D1 binding unavailable; aborting run');
      throw new Error('D1 database binding not available');
    }

    const result = await step.run('sweep-mature-commissions', () => runNet30PayoutJob(db));

    logger.info('[Net30Payout] Daily sweep complete', {
      partnerCount: result.partnerCount,
      createdCount: result.createdCount,
      pendingApprovalCount: result.pendingApprovalCount,
      autoApprovedCount: result.autoApprovedCount,
      totalAmountCents: result.totalAmountCents,
    });

    return result;
  },
);
