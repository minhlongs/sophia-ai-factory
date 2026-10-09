/**
 * Affiliate Ledger Submodule: Payout Disbursement Creation.
 * Layer: tree (domain reusable; imports from @/seed)
 *
 * @module tree/affiliates/ledger/payout-disbursement
 */

import { logger } from '@/seed/utils/logger-utility';
import type { AffiliatePartnerRow } from '@/seed/types/affiliate';
import { resolveD1 } from './db-resolver';
import type { CreatePayoutInput, PayoutMutationResult } from './types';

/**
 * Initiates a new payout disbursement with Optimistic Concurrency Control (OCC) version 1.
 * Supports dual-rail disbursements: 'USDT' (TRC-20) and 'VIETQR' (NAPAS 247).
 */
export async function createPayoutDisbursement(
  input: CreatePayoutInput
): Promise<PayoutMutationResult> {
  const d1 = await resolveD1(input.d1);
  if (!d1) return { success: false, error: 'DATABASE_UNAVAILABLE' };

  if (input.amountCents <= 0) {
    return { success: false, error: 'INVALID_AMOUNT' };
  }

  try {
    const partner = await d1
      .prepare(`SELECT * FROM affiliate_partners WHERE id = ?1 LIMIT 1`)
      .bind(input.partnerId)
      .first<AffiliatePartnerRow>();

    if (!partner) return { success: false, error: 'PARTNER_NOT_FOUND' };
    if (partner.status !== 'active') return { success: false, error: 'PARTNER_INACTIVE' };
    if (partner.pending_payout_cents < input.amountCents) {
      return { success: false, error: 'INSUFFICIENT_PENDING_BALANCE' };
    }

    const payoutId = `po_${crypto.randomUUID().replace(/-/g, '')}`;
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = crypto.randomUUID().slice(0, 6).toUpperCase();
    const payoutReference = `PO_${datePart}_${randPart}`;
    const nowMs = Date.now();
    const currency = input.currency ?? (input.rail === 'VIETQR' ? 'VND' : 'USD');

    await d1
      .prepare(
        `INSERT INTO affiliate_payouts (
           id, payout_reference, partner_id, rail, amount_cents, currency,
           destination_encrypted, status, commission_count, version, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0, 1, ?, ?)`
      )
      .bind(
        payoutId,
        payoutReference,
        input.partnerId,
        input.rail,
        input.amountCents,
        currency,
        input.destinationEncrypted,
        nowMs,
        nowMs
      )
      .run();

    return {
      success: true,
      payoutId,
      payoutReference,
    };
  } catch (err) {
    logger.error('[AffiliateLedgerService] Failed to create payout disbursement', {
      partnerId: input.partnerId,
      error: String(err),
    });
    return { success: false, error: String(err) };
  }
}
