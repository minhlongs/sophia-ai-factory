/**
 * Affiliate Attribution Execution Helpers
 * Layer: tree (domain business logic, edge-compatible)
 *
 * @module tree/affiliates/attribution/attribution-execution-helpers
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import type {
  AffiliateAttributionResult,
  AttributionParams,
} from '@/seed/types/affiliate';
import { DEFAULT_HOLD_DAYS } from './types';
import type { AffiliatePartnerRow, AffiliateReferralRow } from './types';
import { calculatePayableAt, processTier2Commission } from './decay-calculator';
import { insertPrimaryCommissionRecord, updatePartnerAndReferralStatus } from './commission-writer';

export interface PersistAttributionArgs {
  d1: D1Database;
  primaryEventKey: string;
  partner: AffiliatePartnerRow;
  referral: AffiliateReferralRow | null;
  params: AttributionParams;
  ratePct: number;
  commissionCents: number;
}

/**
 * Persists primary commission, updates partner/referral counters, and dispatches Tier-2 override.
 */
export async function persistValidatedCommission(
  args: PersistAttributionArgs,
): Promise<AffiliateAttributionResult> {
  const { d1, primaryEventKey, partner, referral, params, ratePct, commissionCents } = args;
  const nowMs = Date.now();
  const holdDays = DEFAULT_HOLD_DAYS;
  const payableAt = calculatePayableAt(nowMs, holdDays);
  const primaryCommissionId = `comm_${crypto.randomUUID().replace(/-/g, '')}`;
  const currency = params.currency ?? 'USD';

  const inserted = await insertPrimaryCommissionRecord({
    d1,
    primaryCommissionId,
    primaryEventKey,
    partner,
    referral,
    params,
    ratePct,
    commissionCents,
    currency,
    holdDays,
    payableAt,
    nowMs,
  });

  if (!inserted) {
    return { success: true, attributed: false, reason: 'ALREADY_ATTRIBUTED' };
  }

  await updatePartnerAndReferralStatus(d1, partner.id, commissionCents, referral?.id, nowMs);

  logger.info('[AffiliateAttribution] Commission attributed successfully', {
    commissionId: primaryCommissionId,
    partnerId: partner.id,
    amountCents: commissionCents,
    provider: params.provider,
    paymentId: params.paymentId,
  });

  let tier2CommissionId: string | undefined;
  if (partner.parent_partner_id) {
    tier2CommissionId = await processTier2Commission({
      d1,
      partner,
      parentPartnerId: partner.parent_partner_id,
      customerId: params.customerId,
      grossAmountCents: params.grossAmountCents,
      referralId: referral?.id ?? null,
      provider: params.provider,
      paymentId: params.paymentId,
      orderId: params.orderId,
      currency,
      holdDays,
      payableAt,
      primaryEventKey,
      nowMs,
    });
  }

  return {
    success: true,
    attributed: true,
    commissionId: primaryCommissionId,
    tier2CommissionId,
    commissionCents,
    partnerId: partner.id,
  };
}
