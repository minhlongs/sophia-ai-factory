import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, FailureKind } from '@/seed/types/failure-kind';
import { sanitizeErrorText } from '../commission-cents';
import type { PayoutPayload, WithdrawalResponse } from './types';

export const NOWPAYMENTS_API_BASE = 'https://api.nowpayments.io/v1';
export const RATE_LIMIT_MS = 200; // 5 requests/sec

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Send a single payout via NOWPayments API.
 * Returns external_payment_id on success.
 */
export async function sendSinglePayout(
  apiKey: string,
  payload: PayoutPayload,
): Promise<string> {
  // Circuit breaker: check if NOWPayments is available
  if (!shouldAllowRequest('nowpayments')) {
    throw new Error('Circuit breaker open for NOWPayments — too many failures');
  }

  try {
    const resp = await fetch(`${NOWPAYMENTS_API_BASE}/payout`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        withdrawals: [
          {
            address: payload.address,
            currency: 'usdttrc20',
            amount: payload.amountUsdt,
            ipn_callback_url: payload.ipn_callback_url,
            extra_id: payload.extraId,
          },
        ],
      }),
    });

    if (!resp.ok) {
      const rawErr = await resp.text();
      // H3: sanitize before logging — strips addresses, keys
      const safeErr = sanitizeErrorText(rawErr);
      logger.error('[NOWPayments] Payout API error', new Error(safeErr), {
        status: resp.status,
      });
      // Circuit breaker: classify HTTP status
      const kind =
        resp.status === 401 || resp.status === 403
          ? FailureKind.AUTH_FAILURE
          : resp.status === 429
            ? FailureKind.RATE_LIMIT
            : FailureKind.SERVER_ERROR;
      recordFailure('nowpayments', kind);
      throw new Error(`NOWPayments payout API error ${resp.status}: ${safeErr}`);
    }

    const data = (await resp.json()) as { withdrawals?: WithdrawalResponse[] };
    const withdrawal = data.withdrawals?.[0];
    if (!withdrawal?.id) {
      throw new Error('NOWPayments payout response missing withdrawal id');
    }

    // Circuit breaker: record success
    recordSuccess('nowpayments');
    return withdrawal.id;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
    if (error instanceof Error && error.message.includes('NOWPayments payout API')) throw error;
    // Circuit breaker: classify network errors
    const kind = classifyError(error);
    recordFailure('nowpayments', kind);
    throw error;
  }
}
