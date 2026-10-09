/**
 * OCC CAS Payout Batch Creation Logic
 *
 * Layer: tree
 *
 * @module tree/partners/payouts/batch-creator
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerPayoutBatch,
  PayoutBatchType,
  PayoutRail,
} from '@/tree/partners/types';
import { USD_TO_VND_EXCHANGE_RATE } from './constants';
import { convertCentsToVnd } from './currency-converter';
import { resolveDestinationAddress } from './destination-resolver';
import { claimPendingCommissions } from './claim-commissions';
import { claimApprovedCoOpClaims } from './claim-co-op';
import type {
  CreatePayoutBatchOptions,
  CreatePayoutBatchObjectParams,
  CreatePayoutBatchResult,
  NormalizedBatchArgs,
} from './types';

function parseCreateBatchArgs(
  partnerIdOrParams: string | null | CreatePayoutBatchObjectParams,
  batchTypeArg?: PayoutBatchType,
  railArg?: PayoutRail,
  currencyArg: 'USD' | 'VND' | 'USDT' = 'USD',
  optionsArg?: CreatePayoutBatchOptions,
): NormalizedBatchArgs {
  const isObjectCall = typeof partnerIdOrParams === 'object' && partnerIdOrParams !== null;
  const partnerId = isObjectCall ? (partnerIdOrParams.partnerId ?? null) : partnerIdOrParams;
  const batchType = isObjectCall ? partnerIdOrParams.batchType : batchTypeArg!;
  const rail = isObjectCall ? (partnerIdOrParams.payoutRail ?? partnerIdOrParams.rail ?? 'USDT') : railArg!;
  const currency = isObjectCall ? (partnerIdOrParams.currency ?? 'USD') : currencyArg;
  const options = isObjectCall
    ? {
        fxRate: partnerIdOrParams.fxRate,
        destinationAddress: partnerIdOrParams.destinationAddress,
        claimIds: partnerIdOrParams.claimIds,
        commissionIds: partnerIdOrParams.commissionIds,
      }
    : optionsArg;

  return { partnerId, batchType, rail, currency, options };
}

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

  const itemCount = commissionsClaimedCount + coOpClaimsClaimedCount;
  const totalAmountCents = commissionsSumCents + claimsSumCents;

  if (itemCount === 0 || totalAmountCents === 0) {
    await db.prepare('DELETE FROM partner_payout_batches WHERE id = ?').bind(batchId).run();
    return {
      success: false,
      itemCount: 0,
      totalAmountCents: 0,
      totalAmountLocal: 0,
      commissionsClaimedCount: 0,
      coOpClaimsClaimedCount: 0,
      error: 'NO_ELIGIBLE_PAYOUT_ITEMS',
    };
  }

  const fxRate = currency === 'VND' ? options?.fxRate ?? USD_TO_VND_EXCHANGE_RATE : 1.0;
  const totalAmountLocal = currency === 'VND' ? convertCentsToVnd(totalAmountCents, fxRate) : totalAmountCents;

  await db
    .prepare(`
      UPDATE partner_payout_batches
      SET total_amount_cents = ?1,
          total_amount_local = ?2,
          fx_rate = ?3,
          item_count = ?4,
          updated_at = ?5
      WHERE id = ?6
    `)
    .bind(totalAmountCents, totalAmountLocal, fxRate, itemCount, Date.now(), batchId)
    .run();

  const batch: PartnerPayoutBatch = {
    id: batchId,
    partner_id: partnerId,
    batch_type: batchType,
    payout_rail: rail,
    total_amount_cents: totalAmountCents,
    currency,
    total_amount_local: totalAmountLocal,
    fx_rate: fxRate,
    item_count: itemCount,
    destination_address: destinationAddress,
    tx_hash: null,
    status: 'pending',
    external_reference: null,
    raw_response_json: '{}',
    error_message: null,
    executed_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };

  return {
    success: true,
    batch,
    itemCount,
    totalAmountCents,
    totalAmountLocal,
    commissionsClaimedCount,
    coOpClaimsClaimedCount,
  };
}
