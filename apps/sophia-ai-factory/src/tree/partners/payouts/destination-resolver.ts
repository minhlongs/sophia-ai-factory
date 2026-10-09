/**
 * Partner Destination Address Resolution
 *
 * Layer: tree
 *
 * @module tree/partners/payouts/destination-resolver
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { PayoutRail } from '@/tree/partners/types';

export async function resolveDestinationAddress(
  db: D1Database,
  partnerId: string | null,
  rail: PayoutRail,
  initialDest: string | null | undefined,
): Promise<string | null> {
  if (initialDest) return initialDest;
  if (!partnerId) return null;

  try {
    const partner = await db
      .prepare('SELECT payout_destination_json FROM partner_profiles WHERE id = ?')
      .bind(partnerId)
      .first<{ payout_destination_json: string }>();

    if (partner?.payout_destination_json) {
      const dest = JSON.parse(partner.payout_destination_json) as Record<string, unknown>;
      if (rail === 'USDT' && typeof dest.usdtAddress === 'string') {
        return dest.usdtAddress;
      }
      if (rail === 'VIETQR' && typeof dest.bankAccountNumber === 'string') {
        return `${dest.bankCode ?? ''}:${dest.bankAccountNumber}`;
      }
    }
  } catch {
    // Fall back to null if parse fails
  }
  return null;
}
