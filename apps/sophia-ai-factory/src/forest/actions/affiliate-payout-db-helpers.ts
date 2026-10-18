/**
 * Helper to execute payout database operations.
 * Layer: forest/actions
 * @module forest/actions/affiliate-payout-db-helpers
 */

import { encryptSecret } from '@/tree/crypto/encrypt-secret';
import type { RequestDualRailPayoutInput } from './affiliate-payout-actions-schema';

export async function insertPayoutRecord(
  db: D1Database,
  input: RequestDualRailPayoutInput,
): Promise<string> {
  const destinationPlain = JSON.stringify(
    input.rail === 'VIETQR'
      ? { bankBin: input.bankBin, bankAccountNumber: input.bankAccountNumber, bankAccountName: input.bankAccountName }
      : { usdtAddress: input.usdtAddress, usdtNetwork: input.usdtNetwork },
  );
  const destinationEncrypted = await encryptSecret(destinationPlain);
  const payoutId = `payout_${crypto.randomUUID().slice(0, 12)}`;
  const payoutRef = `PAY-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
  const now = Date.now();

  await db
    .prepare(`INSERT INTO affiliate_payouts (
      id, payout_reference, partner_id, rail, amount_cents, currency, destination_encrypted,
      status, commission_count, version, created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, 'USD', ?6, 'processing', 1, 1, ?7, ?7)`)
    .bind(payoutId, payoutRef, input.partnerId, input.rail, input.amountCents, destinationEncrypted, now)
    .run();

  await db
    .prepare(`UPDATE affiliate_commissions SET status = 'settled', payout_id = ?1, settled_at = ?2, updated_at = ?2
              WHERE partner_id = ?3 AND status = 'payable' AND payout_id IS NULL`)
    .bind(payoutId, now, input.partnerId)
    .run();

  return payoutId;
}
