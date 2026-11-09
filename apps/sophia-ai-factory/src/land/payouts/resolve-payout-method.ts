/**
 * Resolve which payout rail an affiliate should use this batch.
 *
 * Precedence: VietQR / USDT (default row in `payout_methods`) → Stripe Connect fallback → null (skip).
 * VietQR (`bank_account`, NAPAS 247 / PayOS) and USDT (`usdt_trc20` / `usdt_erc20`, NOWPayments)
 * are primary rails for VN and global operators; Stripe Connect serves as an international fallback
 * when no default `payout_methods` record exists.
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
  network?: string | null
}

export async function resolvePayoutMethod(
  tenantId: string,
  affiliateId: string,
): Promise<ResolvedPayoutMethod | null> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const cryptoRow = await db
    .prepare(
      `SELECT method, recipient_addr_encrypted
       FROM payout_methods
       WHERE affiliate_id = ? AND tenant_id = ? AND is_default = 1
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(affiliateId, tenantId)
    .first<CryptoRow>()

  if (cryptoRow) {
    const defaultNetwork =
      cryptoRow.method === 'bank_account'
        ? 'VIETQR'
        : cryptoRow.method === 'usdt_erc20'
          ? 'ERC20'
          : 'TRC20'
    return {
      kind: 'usdt',
      method: cryptoRow.method,
      recipientAddrEncrypted: cryptoRow.recipient_addr_encrypted,
      network: cryptoRow.network ?? defaultNetwork,
    }
  }

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

  return null
}
