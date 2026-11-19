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
 * Missing credentials fail closed so the caller cannot record an undispatched refund.
 * A successful HTTP response is not independent confirmation of blockchain settlement.
 */
export async function callNowPaymentsRefund(
  paymentId: string,
  _customerWalletAddress: string | null,
): Promise<void> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;

  if (!apiKey?.trim()) {
    throw new RefundProcessError(
      'NOWPAYMENTS_API_ERROR',
      'NOWPAYMENTS_API_KEY is required to dispatch a refund',
    );
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
