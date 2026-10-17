/**
 * OCC CAS Payout Batch Creation Logic
 *
 * Layer: tree
 *
 * @module tree/partners/payouts/batch-creator
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PayoutBatchType,
  PayoutRail,
} from '@/tree/partners/types';
import { USD_TO_VND_EXCHANGE_RATE } from './constants';
import { resolveDestinationAddress } from './destination-resolver';
import { claimPendingCommissions } from './claim-commissions';
import { claimApprovedCoOpClaims } from './claim-co-op';
import {
  parseCreateBatchArgs,
  finalizeClaimedPayoutBatch,
} from './batch-creator-helpers';
import type {
  CreatePayoutBatchOptions,
  CreatePayoutBatchObjectParams,
  CreatePayoutBatchResult,
} from './types';

export { parseCreateBatchArgs, finalizeClaimedPayoutBatch };

/**
 * Creates a payout batch by claiming eligible pending commissions and approved co-op claims using OCC CAS.
 */
export async function createPayoutBatch(
  db: D1Database,
  partnerIdOrParams: string | null | CreatePayoutBatchObjectParams,
  batchTypeArg?: PayoutBatchType,
  railArg?: PayoutRail,
  currencyArg: 'USD' | 'VND' | 'USDT' = 'USD',
  optionsArg?: CreatePayoutBatchOptions,
): Promise<CreatePayoutBatchResult> {
  const { partnerId, batchType, rail, currency, options } = parseCreateBatchArgs(
    partnerIdOrParams,
    batchTypeArg,
    railArg,
    currencyArg,
    optionsArg,
  );

  const now = Date.now();
  const batchId = `batch_${crypto.randomUUID().slice(0, 16)}`;
  const destinationAddress = await resolveDestinationAddress(db, partnerId, rail, options?.destinationAddress);

  // 1. Insert initial pending batch header
  await db
    .prepare(`
      INSERT INTO partner_payout_batches (
        id, partner_id, batch_type, payout_rail, total_amount_cents,
        currency, total_amount_local, fx_rate, item_count, destination_address,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 0, ?, 0, ?, 0, ?, 'pending', ?, ?)
    `)
    .bind(
      batchId,
      partnerId,
      batchType,
      rail,
      currency,
      currency === 'VND' ? options?.fxRate ?? USD_TO_VND_EXCHANGE_RATE : 1.0,
      destinationAddress,
      now,
      now,
    )
    .run();

  let commissionsClaimedCount = 0;
  let commissionsSumCents = 0;
  let coOpClaimsClaimedCount = 0;
  let claimsSumCents = 0;

  // 2. Claim pending commissions (OCC CAS)
  if (batchType === 'commission' || batchType === 'hybrid') {
    const res = await claimPendingCommissions(db, batchId, partnerId, options?.commissionIds);
    commissionsClaimedCount = res.count;
    commissionsSumCents = res.sumCents;
  }

  // 3. Claim approved Co-Op claims (OCC CAS)
  if (batchType === 'co_op_reimbursement' || batchType === 'hybrid') {
    const res = await claimApprovedCoOpClaims(db, batchId, partnerId, options?.claimIds);
    coOpClaimsClaimedCount = res.count;
    claimsSumCents = res.sumCents;
  }

  return finalizeClaimedPayoutBatch(db, {
    batchId,
    partnerId,
    batchType,
    rail,
    currency,
    fxRateOption: options?.fxRate,
    destinationAddress,
    now,
    commissionsClaimedCount,
    commissionsSumCents,
    coOpClaimsClaimedCount,
    claimsSumCents,
  });
}
