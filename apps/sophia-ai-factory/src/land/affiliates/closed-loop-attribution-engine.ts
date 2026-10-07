/**
 * Closed-Loop Attribution Engine
 *
 * Resolves referral touchpoints, links conversion webhooks to attribution tokens,
 * and triggers background Inngest ledger reconciliation without layer violations.
 *
 * Layer: land (affiliates domain workflow)
 * @module land/affiliates/closed-loop-attribution-engine
 */

import { getD1 } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { recordAtomicCommission } from './atomic-commission-recorder';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export interface TouchpointResolutionInput {
  attributionToken?: string;
  partnerCode?: string;
  subId?: string;
  userId?: string;
  ipHash?: string;
  userAgent?: string;
}

export interface TouchpointResolutionResult {
  attributed: boolean;
  partnerCode?: string;
  partnerId?: string;
  referralId?: string;
}

export interface ClosedLoopConversionInput {
  paymentProvider: 'nowpayments' | 'payos' | 'manual';
  paymentId: string;
  orderId?: string;
  customerUserId: string;
  grossAmountCents: number;
  attributionToken?: string;
  directPartnerCode?: string;
  subId?: string;
}

const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30-day cookie / touchpoint window

export async function resolveAttributionTouchpoint(
  input: TouchpointResolutionInput
): Promise<TouchpointResolutionResult> {
  const db = await getD1();
  if (!db) return { attributed: false };

  // 1. Try resolving via specific attribution token
  if (input.attributionToken) {
    const referral = await db
      .prepare(`SELECT r.id, r.partner_id, r.partner_code, r.created_at
                FROM affiliate_referrals r
                WHERE r.attribution_token = ?1 LIMIT 1`)
      .bind(input.attributionToken)
      .first<{ id: string; partner_id: string; partner_code: string; created_at: number }>();

    if (referral && Date.now() - referral.created_at <= ATTRIBUTION_WINDOW_MS) {
      return {
        attributed: true,
        partnerCode: referral.partner_code,
        partnerId: referral.partner_id,
        referralId: referral.id,
      };
    }
  }

  // 2. Direct partner code fallback
  if (input.partnerCode) {
    const partner = await db
      .prepare('SELECT id, partner_code FROM affiliate_partners WHERE partner_code = ?1 AND status = "active" LIMIT 1')
      .bind(input.partnerCode)
      .first<{ id: string; partner_code: string }>();

    if (partner) {
      return {
        attributed: true,
        partnerCode: partner.partner_code,
        partnerId: partner.id,
      };
    }
  }

  return { attributed: false };
}

export async function processClosedLoopConversion(
  input: ClosedLoopConversionInput
): Promise<{ success: boolean; commissionCents?: number; error?: string }> {
  try {
    const touchpoint = await resolveAttributionTouchpoint({
      attributionToken: input.attributionToken,
      partnerCode: input.directPartnerCode,
      subId: input.subId,
      userId: input.customerUserId,
    });

    if (!touchpoint.attributed || !touchpoint.partnerCode) {
      logger.info('[closed-loop-attribution] Conversion has no attributed partner', { paymentId: input.paymentId });
      return { success: true, commissionCents: 0 };
    }

    const recResult = await recordAtomicCommission({
      paymentProvider: input.paymentProvider,
      paymentId: input.paymentId,
      orderId: input.orderId,
      customerUserId: input.customerUserId,
      grossAmountCents: input.grossAmountCents,
      partnerCode: touchpoint.partnerCode,
      subId: input.subId,
    });

    if (!recResult.success) {
      return { success: false, error: recResult.error };
    }

    // Dispatch background event via Inngest client
    await inngest.send({
      name: 'affiliate/conversion.recorded',
      data: {
        partnerCode: touchpoint.partnerCode,
        commissionCents: recResult.commissionCents ?? 0,
        paymentId: input.paymentId,
        orderId: input.orderId,
        customerUserId: input.customerUserId,
      },
    }).catch((err) => {
      logger.warn('[closed-loop-attribution] Inngest event dispatch failed', { error: toError(err).message });
    });

    return { success: true, commissionCents: recResult.commissionCents };
  } catch (err) {
    const error = toError(err);
    logger.error('[closed-loop-attribution] Error processing conversion', { error: error.message });
    return { success: false, error: error.message };
  }
}
