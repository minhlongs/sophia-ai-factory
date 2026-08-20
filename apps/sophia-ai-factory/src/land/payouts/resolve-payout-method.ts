/**
 * Resolve which payout rail an affiliate should use this batch.
 *
 * Precedence: Stripe Connect (fiat USD) → USDT crypto → null (skip).
 * Stripe wins when the affiliate has completed Connect KYC AND
 * `stripe_payout_enabled = 1`; otherwise fall back to the default row in
 * `payout_methods`.
 *
 * @module payouts/resolve-payout-method
 */

import { getD1 } from '@/seed/db/client'

export type ResolvedPayoutMethod =
  | { kind: 'stripe'; stripeAccountId: string }
  | {
      kind: 'usdt'
      method: 'usdt_trc20' | 'usdt_erc20' | 'bank_account'
      recipientAddrEncrypted: string
      network: string
    }

interface StripeRow {
  stripe_account_id: string
}

interface CryptoRow {
  method: 'usdt_trc20' | 'usdt_erc20' | 'bank_account'
  recipient_addr_encrypted: string
  network: string | null
}

export async function resolvePayoutMethod(
  tenantId: string,
  affiliateId: string,
): Promise<ResolvedPayoutMethod | null> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const stripeRow = await db
    .prepare(
      `SELECT stripe_account_id
       FROM user_payout_settings
       WHERE user_id = ?
         AND stripe_payout_enabled = 1
         AND stripe_account_id IS NOT NULL
       LIMIT 1`,
    )
    .bind(affiliateId)
    .first<StripeRow>()

  if (stripeRow?.stripe_account_id) {
    return { kind: 'stripe', stripeAccountId: stripeRow.stripe_account_id }
  }

  const cryptoRow = await db
    .prepare(
      `SELECT method, recipient_addr_encrypted, network
       FROM payout_methods
       WHERE affiliate_id = ? AND tenant_id = ? AND is_default = 1
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(affiliateId, tenantId)
    .first<CryptoRow>()

  if (cryptoRow) {
    return {
      kind: 'usdt',
      method: cryptoRow.method,
      recipientAddrEncrypted: cryptoRow.recipient_addr_encrypted,
      network: cryptoRow.network ?? 'TRC20',
    }
  }

  return null
}
