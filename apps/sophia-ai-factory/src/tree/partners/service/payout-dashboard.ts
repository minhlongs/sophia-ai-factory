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
} from '@/tree/partners/types';
import { getPartnerById } from './partner-profile';
import { getPartnerDashboardData } from './partner-dashboard-query';
import { deductPartnerBalanceAndApproveCommissions } from './payout-deduction-sql';

export { getPartnerDashboardData };

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

  const deducted = await deductPartnerBalanceAndApproveCommissions(
    db,
    input,
    payoutBatchId,
    nowMs,
  );

  if (!deducted) {
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
