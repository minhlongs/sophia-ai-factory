import { TokenBucket } from '@/tree/payouts/token-bucket';
import type { PayoutRail } from './types';

const rateLimiter = new TokenBucket({ capacity: 5, refillRatePerSecond: 5 });

/**
 * Dispatches payouts to NOWPayments or synthetic mock fallback.
 */
export async function executeRailPayout(
  batchId: string,
  totalCents: number,
  _rail: PayoutRail,
): Promise<{ externalPaymentId: string }> {
  await rateLimiter.acquire();

  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey || process.env.SIMULATE_PAYOUT_RAIL === 'true' || process.env.NODE_ENV === 'test') {
    // Synthetic mock rail in dev/test/simulated mode
    return {
      externalPaymentId: `mock_${batchId}_${Date.now()}`,
    };
  }

  // Real NOWPayments API dispatch
  const response = await fetch('https://api.nowpayments.io/v1/payout', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      withdrawals: [
        {
          extra_id: batchId,
          currency: 'usdttrc20',
          amount: totalCents / 100,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NOWPayments payout API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { id?: string; withdrawals?: Array<{ id?: string }> };
  return {
    externalPaymentId: data.id || data.withdrawals?.[0]?.id || `payout_${batchId}`,
  };
}
