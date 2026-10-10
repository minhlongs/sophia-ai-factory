/**
 * Partner Commission & Payout Server Actions
 *
 * Layer: land/partners/partner-ops
 *
 * @module land/partners/partner-ops/partner-commission-ops
 */

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  getPartnerByUserId,
  requestCommissionPayout,
  accruePartnerCommission,
} from '@/tree/partners/partner-service';
import type {
  PayoutRequestResult,
  CommissionResult,
  PartnerActionError,
  RequestPayoutActionInput,
  AccrueCommissionActionInput,
} from './types';

/**
 * Request commission payout for accumulated pending earnings.
 */
export async function requestCommissionPayoutAction(
  input: RequestPayoutActionInput,
): Promise<Result<PayoutRequestResult, PartnerActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const partner = await getPartnerByUserId(db, user.id);
    if (!partner) {
      return failure({ code: 'NOT_FOUND', message: 'Partner profile not found for user' });
    }

    const result = await requestCommissionPayout(db, {
      partnerId: partner.id,
      amountCents: input.amountCents,
      payoutRail: input.payoutRail,
      destinationDetails: input.destinationDetails,
    });

    if (!result.success) {
      return failure({ code: 'PAYOUT_REJECTED', message: result.error || 'Payout request rejected' });
    }

    logger.info('Partner payout requested', {
      partnerId: partner.id,
      amountCents: input.amountCents,
      batchId: result.payoutBatchId,
    });
    return success(result);
  } catch (err) {
    const error = toError(err);
    logger.error('Failed to request commission payout', { error: error.message });
    return failure({ code: 'PAYOUT_FAILED', message: error.message });
  }
}

/**
 * Accrue a commission for an order payment (called from payment IPN / order fulfillment).
 */
export async function recordAttributedCommissionAction(
  input: AccrueCommissionActionInput,
): Promise<Result<CommissionResult, PartnerActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const result = await accruePartnerCommission(db, {
      partnerId: input.partnerId,
      referredUserId: input.referredUserId,
      referredTenantId: input.referredTenantId,
      orderId: input.orderId,
      mrrCents: input.mrrCents,
      isNewCustomer: input.isNewCustomer,
      referredAtMs: input.referredAtMs,
    });

    if (!result.success) {
      return failure({ code: 'COMMISSION_REJECTED', message: result.error || 'Commission accrual rejected' });
    }

    return success(result);
  } catch (err) {
    const error = toError(err);
    logger.error('Failed to record commission', { error: error.message });
    return failure({ code: 'COMMISSION_FAILED', message: error.message });
  }
}
