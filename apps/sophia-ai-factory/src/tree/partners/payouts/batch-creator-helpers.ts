/**
 * OCC CAS Payout Batch Creation Argument Normalization & Finalization Helpers
 *
 * Layer: tree
 *
 * @module tree/partners/payouts/batch-creator-helpers
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerPayoutBatch,
  PayoutBatchType,
  PayoutRail,
} from '@/tree/partners/types';
import { USD_TO_VND_EXCHANGE_RATE } from './constants';
import { convertCentsToVnd } from './currency-converter';
import type {
  CreatePayoutBatchOptions,
  CreatePayoutBatchObjectParams,
  CreatePayoutBatchResult,
  NormalizedBatchArgs,
} from './types';

export function parseCreateBatchArgs(
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

export async function finalizeClaimedPayoutBatch(
  db: D1Database,
  params: {
    batchId: string;
    partnerId: string | null;
    batchType: PayoutBatchType;
    rail: PayoutRail;
    currency: 'USD' | 'VND' | 'USDT';
    fxRateOption?: number;
    destinationAddress: string | null;
    now: number;
    commissionsClaimedCount: number;
    commissionsSumCents: number;
    coOpClaimsClaimedCount: number;
    claimsSumCents: number;
  },
): Promise<CreatePayoutBatchResult> {
  const {
    batchId, partnerId, batchType, rail, currency, fxRateOption,
    destinationAddress, now, commissionsClaimedCount, commissionsSumCents,
    coOpClaimsClaimedCount, claimsSumCents,
  } = params;

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

  const fxRate = currency === 'VND' ? fxRateOption ?? USD_TO_VND_EXCHANGE_RATE : 1.0;
  const totalAmountLocal = currency === 'VND' ? convertCentsToVnd(totalAmountCents, fxRate) : totalAmountCents;

  await db
    .prepare(
      `UPDATE partner_payout_batches
       SET total_amount_cents = ?1, total_amount_local = ?2, fx_rate = ?3, item_count = ?4, updated_at = ?5
       WHERE id = ?6`,
    )
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
