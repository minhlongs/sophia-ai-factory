/**
 * Partner Payout Ledger & Dashboard Aggregator.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/service/payout-dashboard
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  MIN_PAYOUT_THRESHOLD_CENTS,
  type PayoutRequestInput,
  type PayoutRequestResult,
  type PartnerDashboardData,
  type PartnerCommission,
} from '@/tree/partners/types';
import { calculateNextTierProgress } from './commission-math';
import { getPartnerById } from './partner-profile';
import { getWhitelabelConfigByPartnerId } from './whitelabel-config';

/**
 * Request commission payout for partner pending earnings.
 * Enforces $50.00 (5,000 cents) minimum threshold and pending balance check.
 */
export async function requestCommissionPayout(
  db: D1Database,
  input: PayoutRequestInput,
  nowMs = Date.now(),
): Promise<PayoutRequestResult> {
  if (input.amountCents < MIN_PAYOUT_THRESHOLD_CENTS) {
    return {
      success: false,
      partnerId: input.partnerId,
      payoutBatchId: '',
      amountCents: input.amountCents,
      remainingPendingCents: 0,
      payoutRail: input.payoutRail,
      error: `Payout amount must be at least $${(MIN_PAYOUT_THRESHOLD_CENTS / 100).toFixed(2)} (5,000 cents)`,
    };
  }

  const partner = await getPartnerById(db, input.partnerId);
  if (!partner) {
    return {
      success: false,
      partnerId: input.partnerId,
      payoutBatchId: '',
      amountCents: input.amountCents,
      remainingPendingCents: 0,
      payoutRail: input.payoutRail,
      error: `Partner profile ${input.partnerId} not found`,
    };
  }

  if (partner.pending_payout_cents < input.amountCents) {
    return {
      success: false,
      partnerId: input.partnerId,
      payoutBatchId: '',
      amountCents: input.amountCents,
      remainingPendingCents: partner.pending_payout_cents,
      payoutRail: input.payoutRail,
      error: `Insufficient pending payout balance (${partner.pending_payout_cents} cents available, requested ${input.amountCents} cents)`,
    };
  }

  const payoutBatchId = `payout_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  // Atomic database-level balance deduction with CAS constraint (pending_payout_cents >= amountCents)
  const updateRes = await db
    .prepare(
      `UPDATE partner_profiles
       SET pending_payout_cents = pending_payout_cents - ?1,
           payout_rail = ?2,
           payout_destination_json = ?3,
           updated_at = ?4
       WHERE id = ?5 AND pending_payout_cents >= ?1`
    )
    .bind(
      input.amountCents,
      input.payoutRail,
      JSON.stringify(input.destinationDetails),
      nowMs,
      input.partnerId,
    )
    .run();

  const changes = Number(
    (updateRes as { changes?: number })?.changes ??
    (updateRes as { meta?: { changes?: number } })?.meta?.changes ??
    0
  );

  if (changes === 0) {
    // CAS check failed (insufficient balance or concurrent deduction)
    const currentPartner = await getPartnerById(db, input.partnerId);
    const currentPending = currentPartner ? currentPartner.pending_payout_cents : 0;
    return {
      success: false,
      partnerId: input.partnerId,
      payoutBatchId: '',
      amountCents: input.amountCents,
      remainingPendingCents: currentPending,
      payoutRail: input.payoutRail,
      error: `Insufficient pending payout balance (${currentPending} cents available, requested ${input.amountCents} cents)`,
    };
  }

  // Mark pending commissions as approved / linked to payout batch
  await db
    .prepare(
      `UPDATE partner_commissions
       SET status = 'approved',
           payout_batch_id = ?1
       WHERE partner_id = ?2 AND status = 'pending'`
    )
    .bind(payoutBatchId, input.partnerId)
    .run();

  // Query updated partner to return verified remaining balance
  const updatedPartner = await getPartnerById(db, input.partnerId);
  const remainingPending = updatedPartner ? updatedPartner.pending_payout_cents : 0;

  return {
    success: true,
    partnerId: input.partnerId,
    payoutBatchId,
    amountCents: input.amountCents,
    remainingPendingCents: remainingPending,
    payoutRail: input.payoutRail,
  };
}

/**
 * Alias for requestCommissionPayout to support partner payout operations.
 */
export const requestPartnerPayout = requestCommissionPayout;

/**
 * Aggregates complete partner dashboard metrics, commissions, and progress.
 */
export async function getPartnerDashboardData(
  db: D1Database,
  partnerId: string,
): Promise<PartnerDashboardData> {
  const profile = await getPartnerById(db, partnerId);
  if (!profile) {
    throw new Error(`Partner not found: ${partnerId}`);
  }

  const whitelabelConfig = await getWhitelabelConfigByPartnerId(db, partnerId);

  const commissionsResult = await db
    .prepare(
      `SELECT * FROM partner_commissions
       WHERE partner_id = ?1
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .bind(partnerId)
    .all<PartnerCommission>();

  const nextTier = calculateNextTierProgress(
    profile.tier,
    profile.total_referred_customers,
    profile.total_mrr_cents,
  );

  return {
    profile,
    whitelabelConfig,
    recentCommissions: commissionsResult.results ?? [],
    nextTier,
  };
}
