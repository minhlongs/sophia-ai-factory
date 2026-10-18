/**
 * Server Actions for Dual-Rail Affiliate Payouts
 *
 * Implements encrypted payout requests (VietQR / USDT) and partner destination updates.
 *
 * Layer: forest (Server Actions)
 * @module forest/actions/affiliate-payout-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  requestDualRailPayoutSchema,
  updatePartnerPayoutDestinationSchema,
  type RequestDualRailPayoutInput,
  type UpdatePartnerPayoutDestinationInput,
} from './affiliate-payout-actions-schema';
import { insertPayoutRecord } from './affiliate-payout-db-helpers';

export async function requestDualRailPayoutAction(
  rawInput: RequestDualRailPayoutInput,
): Promise<{ success: boolean; payoutId?: string; error?: string }> {
  try {
    const user = await getCurrentUser().catch(() => null);
    if (!user) return { success: false, error: 'Unauthorized' };

    const parsed = requestDualRailPayoutSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues?.[0]?.message || 'Invalid payout input' };
    }
    const input = parsed.data;

    const db = await getD1();
    if (!db) return { success: false, error: 'Database binding unavailable' };

    const partner = await db
      .prepare('SELECT id FROM affiliate_partners WHERE id = ?1 LIMIT 1')
      .bind(input.partnerId)
      .first<{ id: string }>();

    if (!partner) return { success: false, error: 'Partner record not found' };

    const payableRow = await db
      .prepare(`SELECT COALESCE(SUM(commission_cents), 0) AS payable_total FROM affiliate_commissions
                WHERE partner_id = ?1 AND status = 'payable' AND payout_id IS NULL`)
      .bind(input.partnerId)
      .first<{ payable_total: number }>();

    if ((payableRow?.payable_total ?? 0) < input.amountCents) {
      return { success: false, error: `Requested amount exceeds payable balance` };
    }

    const payoutId = await insertPayoutRecord(db, input);

    logger.info('[affiliate-payout] Payout requested successfully', {
      payoutId,
      partnerId: input.partnerId,
      rail: input.rail,
      amountCents: input.amountCents,
    });
    return { success: true, payoutId };
  } catch (err) {
    const error = toError(err);
    logger.error('[affiliate-payout] Failed to request payout', { error: error.message });
    return { success: false, error: error.message };
  }
}

export async function updatePartnerPayoutDestinationAction(
  rawInput: UpdatePartnerPayoutDestinationInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser().catch(() => null);
    if (!user) return { success: false, error: 'Unauthorized' };

    const parsed = updatePartnerPayoutDestinationSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.issues?.[0]?.message || 'Invalid destination input' };
    const input = parsed.data;

    const db = await getD1();
    if (!db) return { success: false, error: 'Database binding unavailable' };

    const now = Date.now();
    if (input.rail === 'VIETQR') {
      await db
        .prepare(
          `UPDATE affiliate_partners SET payout_rail = 'VIETQR', bank_bin = ?1, bank_account_number = ?2, bank_account_name = ?3, updated_at = ?4 WHERE id = ?5`,
        )
        .bind(input.bankBin, input.bankAccountNumber, input.bankAccountName, now, input.partnerId)
        .run();
    } else {
      await db
        .prepare(`UPDATE affiliate_partners SET payout_rail = 'USDT', updated_at = ?1 WHERE id = ?2`)
        .bind(now, input.partnerId)
        .run();
    }

    return { success: true };
  } catch (err) {
    const error = toError(err);
    logger.error('[affiliate-payout] Failed to update destination', { error: error.message });
    return { success: false, error: error.message };
  }
}
