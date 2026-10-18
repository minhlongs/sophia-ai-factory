/**
 * Closed-Loop Attribution Engine
 *
 * Resolves referral touchpoints, links conversion webhooks to attribution tokens,
 * and triggers background Inngest ledger reconciliation without layer violations.
 *
 * Layer: land (affiliates domain workflow)
 * @module land/affiliates/closed-loop-attribution-engine
 */

import { inngest } from '@/seed/inngest/client';
import { recordAtomicCommission } from './atomic-commission-recorder';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  resolveAttributionTouchpoint,
  type TouchpointResolutionInput,
  type TouchpointResolutionResult,
} from './closed-loop-touchpoint-resolver';

export {
  resolveAttributionTouchpoint,
  type TouchpointResolutionInput,
  type TouchpointResolutionResult,
};

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
