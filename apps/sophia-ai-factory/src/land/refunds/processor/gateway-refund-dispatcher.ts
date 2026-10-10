/**
 * NOWPayments crypto refund API dispatcher with circuit breaker
 * @module land/refunds/processor/gateway-refund-dispatcher
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, FailureKind } from '@/seed/types/failure-kind';
import { RefundProcessError } from './types';

const NOWPAYMENTS_API_BASE = 'https://api.nowpayments.io/v1';

/**
 * Call NOWPayments refund API for crypto payments.
 * If NOWPAYMENTS_API_KEY is not set, logs a warning and skips the API call
 * (the refund is still recorded internally — admin must manually process the
 * blockchain refund via NOWPayments dashboard).
 */
export async function callNowPaymentsRefund(
  paymentId: string,
  _customerWalletAddress: string | null,
): Promise<void> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;

  if (!apiKey) {
    logger.warn('[RefundProcessor] NOWPAYMENTS_API_KEY not set — skipping external refund API call');
    return;
  }

  if (!shouldAllowRequest('nowpayments')) {
    throw new Error('Circuit breaker open for NOWPayments — too many failures');
  }

  try {
    const resp = await fetch(`${NOWPAYMENTS_API_BASE}/payment/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payment_id: paymentId,
      }),
    });

    if (!resp.ok) {
      const errorBody = await resp.text().catch(() => 'unknown');
      const kind = resp.status === 401 || resp.status === 403
        ? FailureKind.AUTH_FAILURE
        : resp.status === 429
          ? FailureKind.RATE_LIMIT
          : FailureKind.SERVER_ERROR;
      recordFailure('nowpayments', kind);
      throw new RefundProcessError(
        'NOWPAYMENTS_API_ERROR',
        `NOWPayments refund API returned ${resp.status}: ${errorBody}`,
      );
    }

    recordSuccess('nowpayments');
    logger.info('[RefundProcessor] NOWPayments refund API success', { paymentId });
  } catch (error) {
    if (error instanceof RefundProcessError) throw error;
    const kind = classifyError(error);
    recordFailure('nowpayments', kind);
    throw error;
  }
}
