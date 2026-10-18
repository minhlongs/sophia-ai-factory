/**
 * Atomic Partner Balance CAS Deduction & Commission Approval SQL Helper.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/service/payout-deduction-sql
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { PayoutRequestInput } from '@/tree/partners/types';

export async function deductPartnerBalanceAndApproveCommissions(
  db: D1Database,
  input: PayoutRequestInput,
  payoutBatchId: string,
  nowMs: number,
): Promise<boolean> {
  const updateRes = await db
    .prepare(
      `UPDATE partner_profiles
       SET pending_payout_cents = pending_payout_cents - ?1,
           payout_rail = ?2,
           payout_destination_json = ?3,
           updated_at = ?4
       WHERE id = ?5 AND pending_payout_cents >= ?1`,
    )
    .bind(
      input.amountCents,
      input.payoutRail,
      JSON.stringify(input.destinationDetails),
      nowMs,
      input.partnerId,
    )
    .run();

  const changes = Number(
    (updateRes as { changes?: number })?.changes ??
      (updateRes as { meta?: { changes?: number } })?.meta?.changes ??
      0,
  );

  if (changes === 0) {
    return false;
  }

  await db
    .prepare(
      `UPDATE partner_commissions
       SET status = 'approved',
           payout_batch_id = ?1
       WHERE partner_id = ?2 AND status = 'pending'`,
    )
    .bind(payoutBatchId, input.partnerId)
    .run();

  return true;
}
