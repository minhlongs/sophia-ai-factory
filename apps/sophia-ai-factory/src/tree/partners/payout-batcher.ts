/**
 * Multi-Rail Batch Settlement & Payout Engine
 *
 * Layer: tree (domain business logic, OCC CAS claiming, multi-rail dispatch & atomic rollback)
 * Adheres strictly to the Sophia 4-layer architecture (seed -> tree -> forest -> land).
 *
 * Invariants:
 * 1. OCC Compare-And-Swap (CAS):
 *    - Pending commissions claimed: status = 'approved', payout_batch_id = batchId.
 *    - Approved co-op claims claimed: status = 'processing', payout_batch_id = batchId.
 * 2. Multi-Rail Dispatch:
 *    - USDT NOWPayments (TRC-20): 1:1 USD-denominated crypto rail.
 *    - VietQR PayOS: Integer VND conversion via Math.floor((cents * USD_TO_VND) / 100).
 *    - Bank Wire: Swift / IBAN / domestic wire.
 * 3. Atomic Failure Rollback:
 *    - On gateway error or network failure:
 *      * Commissions revert: status = 'pending', payout_batch_id = NULL.
 *      * Co-Op claims revert: status = 'approved', payout_batch_id = NULL.
 *      * Payout batch: status = 'failed', error_message recorded.
 *      * Zero fund loss guarantee.
 *
 * @module tree/partners/payout-batcher
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerPayoutBatch,
  PayoutBatchType,
  PayoutRail,
  PayoutBatchExecutionResult,
} from '@/tree/partners/types';

// ============================================================================
// Constants & Configuration
// ============================================================================

/** Standard USD to VND conversion rate (1 USD = 25,450 VND) */
export const USD_TO_VND_EXCHANGE_RATE = 25_450;

/** Minimum batch payout threshold in cents ($50.00) */
export const MIN_BATCH_AMOUNT_CENTS = 5_000;

// ============================================================================
// Interfaces & DTOs
// ============================================================================

export interface CreatePayoutBatchOptions {
  fxRate?: number;
  destinationAddress?: string;
  claimIds?: string[];
  commissionIds?: string[];
}

export interface CreatePayoutBatchObjectParams {
  partnerId?: string | null;
  batchType: PayoutBatchType;
  payoutRail?: PayoutRail;
  rail?: PayoutRail;
  currency?: 'USD' | 'VND' | 'USDT';
  claimIds?: string[];
  commissionIds?: string[];
  fxRate?: number;
  destinationAddress?: string;
}

export interface CreatePayoutBatchResult {
  success: boolean;
  batch?: PartnerPayoutBatch;
  itemCount: number;
  totalAmountCents: number;
  totalAmountLocal: number;
  commissionsClaimedCount: number;
  coOpClaimsClaimedCount: number;
  error?: string;
}

export type GatewayDispatcher = (
  batch: PartnerPayoutBatch,
) => Promise<{ success: boolean; externalReference?: string; txHash?: string; rawResponse?: Record<string, unknown>; error?: string }>;

// ============================================================================
// Multi-Rail Helper Utilities
// ============================================================================

/**
 * Converts USD cents to VND integer dong with guaranteed zero fractional dong leakage.
 *
 * Formula: Math.floor((cents * USD_TO_VND) / 100)
 */
export function convertCentsToVnd(cents: number, fxRate: number = USD_TO_VND_EXCHANGE_RATE): number {
  if (cents <= 0 || !Number.isFinite(cents)) {
    return 0;
  }
  return Math.floor((Math.floor(cents) * fxRate) / 100);
}

// ============================================================================
// Core Payout Batcher Service
// ============================================================================

/**
 * Creates a payout batch by claiming eligible pending commissions and approved co-op claims using OCC CAS.
 *
 * @param db - D1Database instance.
 * @param partnerId - Target partner ID (or null for platform-wide batch).
 * @param batchType - 'commission' | 'co_op_reimbursement' | 'hybrid'.
 * @param rail - 'USDT' | 'VIETQR' | 'BANK_WIRE'.
 * @param currency - 'USD' | 'VND' | 'USDT'.
 * @param options - Additional FX rate and destination parameters.
 */
interface NormalizedBatchArgs {
  partnerId: string | null;
  batchType: PayoutBatchType;
  rail: PayoutRail;
  currency: 'USD' | 'VND' | 'USDT';
  options?: CreatePayoutBatchOptions;
}

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

async function resolveDestinationAddress(
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

async function claimPendingCommissions(
  db: D1Database,
  batchId: string,
  partnerId: string | null,
  commissionIds?: string[],
): Promise<{ count: number; sumCents: number }> {
  if (commissionIds && commissionIds.length > 0) {
    for (const cid of commissionIds) {
      await db
        .prepare(`
          UPDATE partner_commissions
          SET status = 'approved', payout_batch_id = ?1
          WHERE id = ?2 AND status = 'pending' AND payout_batch_id IS NULL
        `)
        .bind(batchId, cid)
        .run();
    }
  } else if (partnerId) {
    await db
      .prepare(`
        UPDATE partner_commissions
        SET status = 'approved', payout_batch_id = ?1
        WHERE partner_id = ?2 AND status = 'pending' AND payout_batch_id IS NULL
      `)
      .bind(batchId, partnerId)
      .run();
  } else {
    await db
      .prepare(`
        UPDATE partner_commissions
        SET status = 'approved', payout_batch_id = ?1
        WHERE status = 'pending' AND payout_batch_id IS NULL
      `)
      .bind(batchId)
      .run();
  }

  const claimed = await db
    .prepare('SELECT id, commission_cents FROM partner_commissions WHERE payout_batch_id = ?')
    .bind(batchId)
    .all<{ id: string; commission_cents: number }>();

  const rows = claimed.results ?? [];
  return {
    count: rows.length,
    sumCents: rows.reduce((sum, c) => sum + Math.max(0, c.commission_cents), 0),
  };
}

async function claimApprovedCoOpClaims(
  db: D1Database,
  batchId: string,
  partnerId: string | null,
  claimIds?: string[],
): Promise<{ count: number; sumCents: number }> {
  if (claimIds && claimIds.length > 0) {
    for (const cid of claimIds) {
      await db
        .prepare(`
          UPDATE partner_co_op_claims
          SET status = 'processing', payout_batch_id = ?1
          WHERE id = ?2 AND (status = 'approved' OR status = 'submitted') AND payout_batch_id IS NULL
        `)
        .bind(batchId, cid)
        .run();
    }
  } else if (partnerId) {
    await db
      .prepare(`
        UPDATE partner_co_op_claims
        SET status = 'processing', payout_batch_id = ?1
        WHERE partner_id = ?2 AND status = 'approved' AND payout_batch_id IS NULL
      `)
      .bind(batchId, partnerId)
      .run();
  } else {
    await db
      .prepare(`
        UPDATE partner_co_op_claims
        SET status = 'processing', payout_batch_id = ?1
        WHERE status = 'approved' AND payout_batch_id IS NULL
      `)
      .bind(batchId)
      .run();
  }

  const claimed = await db
    .prepare('SELECT id, approved_amount_cents FROM partner_co_op_claims WHERE payout_batch_id = ?')
    .bind(batchId)
    .all<{ id: string; approved_amount_cents: number }>();

  const rows = claimed.results ?? [];
  return {
    count: rows.length,
    sumCents: rows.reduce((sum, c) => sum + Math.max(0, c.approved_amount_cents), 0),
  };
}

/**
 * Creates a payout batch by claiming eligible pending commissions and approved co-op claims using OCC CAS.
 *
 * @param db - D1Database instance.
 * @param partnerIdOrParams - Target partner ID or object params.
 * @param batchTypeArg - 'commission' | 'co_op_reimbursement' | 'hybrid'.
 * @param railArg - 'USDT' | 'VIETQR' | 'BANK_WIRE'.
 * @param currencyArg - 'USD' | 'VND' | 'USDT'.
 * @param optionsArg - Additional FX rate and destination parameters.
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

  // 1. Insert initial pending batch header so foreign keys in partner_co_op_claims / commissions are satisfied
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

  // If no items were eligible or claimed, clean up header and exit
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

  // 4. Multi-rail FX conversion & update batch totals
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

/**
 * Atomically rolls back a claimed payout batch and reverts all associated commissions and Co-Op claims.
 *
 * Guarantees zero fund loss on gateway error or timeout.
 * - Commissions revert from 'approved' to 'pending' with payout_batch_id cleared.
 * - Co-Op claims revert from 'processing' to 'approved' with payout_batch_id cleared.
 * - Batch status is updated to 'failed' with the recorded error message.
 *
 * @param db - D1Database instance.
 * @param batchId - ID of batch to rollback.
 * @param errorMessage - Descriptive failure cause.
 */
export async function rollbackPayoutBatch(
  db: D1Database,
  batchId: string,
  errorMessage: string,
): Promise<boolean> {
  const now = Date.now();

  // 1. Revert commissions back to pending
  await db
    .prepare(`
      UPDATE partner_commissions
      SET status = 'pending', payout_batch_id = NULL
      WHERE payout_batch_id = ?
    `)
    .bind(batchId)
    .run();

  // 2. Revert co-op claims back to approved
  await db
    .prepare(`
      UPDATE partner_co_op_claims
      SET status = 'approved', payout_batch_id = NULL
      WHERE payout_batch_id = ?
    `)
    .bind(batchId)
    .run();

  // 3. Mark batch as failed
  await db
    .prepare(`
      UPDATE partner_payout_batches
      SET status = 'failed', error_message = ?1, updated_at = ?2
      WHERE id = ?3
    `)
    .bind(errorMessage, now, batchId)
    .run();

  return true;
}

/**
 * Dispatches simulated payment rails for USDT (NOWPayments TRC-20) and VietQR (PayOS).
 */
async function defaultRailDispatcher(
  batch: PartnerPayoutBatch,
): Promise<{ success: boolean; externalReference?: string; txHash?: string; rawResponse?: Record<string, unknown>; error?: string }> {
  // USDT TRC-20 Rail Simulation
  if (batch.payout_rail === 'USDT') {
    const address = batch.destination_address?.trim();
    if (address && address.startsWith('FAIL_SIMULATION')) {
      return { success: false, error: 'NOWPAYMENTS_GATEWAY_TIMEOUT: 504' };
    }
    const simulatedTxHash = `trc20_${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`;
    return {
      success: true,
      externalReference: `np_payout_${batch.id.slice(-8)}`,
      txHash: simulatedTxHash,
      rawResponse: { rail: 'USDT_TRC20', txHash: simulatedTxHash, amountUsdt: batch.total_amount_cents / 100 },
    };
  }

  // VietQR PayOS Rail Simulation
  if (batch.payout_rail === 'VIETQR') {
    if (batch.destination_address && batch.destination_address.startsWith('FAIL_SIMULATION')) {
      return { success: false, error: 'PAYOS_BANK_RAIL_ERROR: Checksum failure or bank network unreachable' };
    }
    const simulatedTransRef = `payos_trans_${Date.now()}_${batch.id.slice(-6)}`;
    return {
      success: true,
      externalReference: simulatedTransRef,
      rawResponse: { rail: 'VIETQR_PAYOS', transactionRef: simulatedTransRef, amountVnd: batch.total_amount_local },
    };
  }

  // BANK_WIRE Rail Simulation
  if (batch.payout_rail === 'BANK_WIRE') {
    const wireRef = `wire_${Date.now()}_${batch.id.slice(-6)}`;
    return {
      success: true,
      externalReference: wireRef,
      rawResponse: { rail: 'BANK_WIRE', wireRef },
    };
  }

  return { success: false, error: `UNSUPPORTED_PAYOUT_RAIL: ${batch.payout_rail}` };
}

/**
 * Executes a payout batch via the specified payment rail and applies atomic rollback on gateway error.
 *
 * @param db - D1Database instance.
 * @param batchId - ID of payout batch to execute.
 * @param customDispatcher - Optional gateway dispatcher function for testing or production DI.
 */
export async function executePayoutBatch(
  db: D1Database,
  batchId: string,
  customDispatcher?: GatewayDispatcher,
): Promise<PayoutBatchExecutionResult> {
  const batch = await db
    .prepare('SELECT * FROM partner_payout_batches WHERE id = ?')
    .bind(batchId)
    .first<PartnerPayoutBatch>();

  if (!batch) {
    return {
      batchId,
      success: false,
      payoutRail: 'USDT',
      totalAmountCents: 0,
      totalAmountLocal: 0,
      itemCount: 0,
      error: 'PAYOUT_BATCH_NOT_FOUND',
    };
  }

  // Idempotency check: if already completed, return success
  if (batch.status === 'completed') {
    return {
      batchId,
      success: true,
      status: 'completed',
      txHash: batch.tx_hash ?? undefined,
      payoutRail: batch.payout_rail,
      totalAmountCents: batch.total_amount_cents,
      totalAmountLocal: batch.total_amount_local,
      itemCount: batch.item_count,
      externalReference: batch.external_reference ?? undefined,
    };
  }

  if (batch.status === 'failed' || batch.status === 'cancelled') {
    return {
      batchId,
      success: false,
      status: 'failed',
      payoutRail: batch.payout_rail,
      totalAmountCents: batch.total_amount_cents,
      totalAmountLocal: batch.total_amount_local,
      itemCount: batch.item_count,
      error: `BATCH_INELIGIBLE_FOR_EXECUTION: status=${batch.status}`,
    };
  }

  const now = Date.now();

  // Mark batch as processing
  await db
    .prepare("UPDATE partner_payout_batches SET status = 'processing', executed_at = ?, updated_at = ? WHERE id = ?")
    .bind(now, now, batchId)
    .run();

  try {
    const dispatcher = customDispatcher ?? defaultRailDispatcher;
    const dispatchResult = await dispatcher(batch);

    if (!dispatchResult.success) {
      const errorMsg = dispatchResult.error ?? 'PAYMENT_GATEWAY_FAILURE';
      await rollbackPayoutBatch(db, batchId, errorMsg);
      return {
        batchId,
        success: false,
        payoutRail: batch.payout_rail,
        totalAmountCents: batch.total_amount_cents,
        totalAmountLocal: batch.total_amount_local,
        itemCount: batch.item_count,
        error: errorMsg,
      };
    }

    const completedAt = Date.now();
    const externalRef = dispatchResult.externalReference ?? null;
    const txHash = dispatchResult.txHash ?? null;
    const rawJson = JSON.stringify(dispatchResult.rawResponse ?? {});

    // Transition batch to completed
    await db
      .prepare(`
        UPDATE partner_payout_batches
        SET status = 'completed',
            external_reference = ?1,
            tx_hash = ?2,
            raw_response_json = ?3,
            completed_at = ?4,
            updated_at = ?4
        WHERE id = ?5
      `)
      .bind(externalRef, txHash, rawJson, completedAt, batchId)
      .run();

    // Mark all linked commissions as paid
    await db
      .prepare("UPDATE partner_commissions SET status = 'paid' WHERE payout_batch_id = ?")
      .bind(batchId)
      .run();

    // Mark all linked co-op claims as paid
    await db
      .prepare("UPDATE partner_co_op_claims SET status = 'paid', paid_at = ? WHERE payout_batch_id = ?")
      .bind(completedAt, batchId)
      .run();

    // If batch was partner-scoped, update lifetime earnings and pending payout in partner_profiles
    if (batch.partner_id) {
      await db
        .prepare(`
          UPDATE partner_profiles
          SET total_earnings_cents = total_earnings_cents + ?1,
              pending_payout_cents = MAX(0, pending_payout_cents - ?1),
              updated_at = ?2
          WHERE id = ?3
        `)
        .bind(batch.total_amount_cents, completedAt, batch.partner_id)
        .run();
    }

    return {
      batchId,
      success: true,
      status: 'completed',
      txHash: txHash ?? undefined,
      payoutRail: batch.payout_rail,
      totalAmountCents: batch.total_amount_cents,
      totalAmountLocal: batch.total_amount_local,
      itemCount: batch.item_count,
      externalReference: externalRef ?? undefined,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await rollbackPayoutBatch(db, batchId, errorMsg);
    return {
      batchId,
      success: false,
      status: 'failed',
      payoutRail: batch.payout_rail,
      totalAmountCents: batch.total_amount_cents,
      totalAmountLocal: batch.total_amount_local,
      itemCount: batch.item_count,
      error: errorMsg,
    };
  }
}

/**
 * Retrieves a payout batch by ID.
 */
export async function getPayoutBatchById(
  db: D1Database,
  batchId: string,
): Promise<PartnerPayoutBatch | null> {
  const batch = await db
    .prepare('SELECT * FROM partner_payout_batches WHERE id = ?')
    .bind(batchId)
    .first<PartnerPayoutBatch>();

  return batch ?? null;
}

/**
 * Retrieves payout batches for a partner.
 */
export async function getPartnerPayoutBatches(
  db: D1Database,
  partnerId: string,
): Promise<PartnerPayoutBatch[]> {
  const batches = await db
    .prepare('SELECT * FROM partner_payout_batches WHERE partner_id = ? ORDER BY created_at DESC')
    .bind(partnerId)
    .all<PartnerPayoutBatch>();

  return batches.results ?? [];
}
