/**
 * Multi-Asset Clearing Engine
 *
 * Layer: tree/clearing (Domain services & pure deterministic financial algorithms)
 * Dependencies:
 *   - @/seed/types/multi-asset-clearing
 *   - @/seed/db/client (D1Database interface)
 *   - @/seed/utils/logger-utility (logger)
 *
 * Implements:
 * 1. Multi-asset spot pricing & precision normalization (USDT, USDC, EUR, JPY, SGD, VND, USD)
 * 2. Virtual AMM reserve pricing with strict slippage cap (< 0.05% / 5 basis points)
 * 3. T+0 RTGS settlement pipeline with Merkle root attestation
 * 4. Multilateral netting matrix with zero-sum invariant check
 * 5. ISO 20022 pacs.008.001.10 and camt.053.001.10 financial messaging
 * 6. Automated banking statement reconciliation matching
 * 7. Reserve liquidity pool rebalancing with 15% threshold monitoring
 *
 * Rules:
 * - NO imports from @/land or @/forest
 * - NO :any types
 * - Strict mathematical precision and zero-penny leakage
 *
 * @module tree/clearing/multi-asset-clearing-engine
 */

import type { D1Database } from '@/seed/db/client';
import type {
  ClearingAsset,
  ClearingLiquidityPool,
  ClearingLiquidityPoolRow,
  CrossBorderClearingBatch,
  CrossBorderClearingBatchRow,
  SwapQuoteInput,
  SwapQuoteResult,
  ExecuteClearingBatchInput,
  ClearingExecutionResult,
  ReconcileBatchInput,
  ReconciliationResult,
  Iso20022Pacs008Message,
  Iso20022Camt053Message,
  BilateralTransferLeg,
  MultilateralNettingMatrix,
  NettingParticipantSummary,
  ClearingBatchStatus,
} from '@/seed/types/multi-asset-clearing';
import {
  MAX_SLIPPAGE_TOLERANCE_PCT,
  rowToClearingLiquidityPool,
  rowToCrossBorderClearingBatch,
} from '@/seed/types/multi-asset-clearing';
import { logger } from '@/seed/utils/logger-utility';

// ── 1. Currency Equivalences & Precision Handling ─────────────────────────────

/**
 * Base exchange rate equivalence in USD (ECB / Market reference rates for Gate 10 scale).
 * 1 Unit of Asset = X Units of USD.
 */
export const BASE_EQUIVALENCE_USD: Record<ClearingAsset, number> = {
  USD: 1.0,
  USDT: 1.0,
  USDC: 1.0,
  EUR: 1.0850,     // 1 EUR = $1.0850
  JPY: 0.0065,     // 1 JPY = $0.0065 (~153.85 JPY/USD)
  SGD: 0.7450,     // 1 SGD = $0.7450 (~1.3423 SGD/USD)
  VND: 0.00003937, // 1 VND = $0.00003937 (~25,400 VND/USD)
};

/**
 * Calculates spot exchange rate between any two supported clearing assets.
 */
export function getSpotExchangeRate(from: ClearingAsset, to: ClearingAsset): number {
  if (from === to) return 1.0;
  const fromUsd = BASE_EQUIVALENCE_USD[from];
  const toUsd = BASE_EQUIVALENCE_USD[to];
  return fromUsd / toUsd;
}

/**
 * Normalizes asset amount according to currency denomination rules:
 * - JPY: Integer (no fractional yen)
 * - VND: Rounded to 1,000 VND bank note minor unit
 * - USD/USDT/USDC/EUR/SGD: 2 decimal places (standard cents)
 */
export function normalizeAssetAmount(amount: number, asset: ClearingAsset): number {
  if (!Number.isFinite(amount) || amount === 0) return 0;
  const sign = amount < 0 ? -1 : 1;
  const absAmount = Math.abs(amount);

  if (asset === 'JPY') {
    return sign * Math.round(absAmount);
  }
  if (asset === 'VND') {
    return sign * (Math.round(absAmount / 1000) * 1000);
  }
  // Standard 2 decimal places
  return sign * (Math.round(absAmount * 100) / 100);
}

/**
 * Compute SHA-256 hash string for tamper-evident ledger attestations.
 */
export async function computeSha256(text: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  const nodeCrypto = await import('node:crypto');
  return nodeCrypto.createHash('sha256').update(data).digest('hex');
}

// ── 2. Virtual AMM Reserve Pricing & Strict Slippage (< 0.05%) ────────────────

/**
 * Calculates a swap quotation through a liquidity pool's virtual AMM curve.
 * Strictly verifies that slippage is less than the 0.05% threshold.
 */
export function calculateSwapQuote(
  pool: ClearingLiquidityPool,
  input: SwapQuoteInput
): SwapQuoteResult {
  const { sourceAsset, targetAsset, sourceAmount } = input;
  const maxAcceptableSlippage = input.maxAcceptableSlippagePct ?? MAX_SLIPPAGE_TOLERANCE_PCT;

  const marketRate = getSpotExchangeRate(sourceAsset, targetAsset);
  const nominalTargetAmount = sourceAmount * marketRate;

  // Check pool status and liquidity availability
  if (
    pool.status !== 'active' ||
    pool.availableReserveAmount <= 0 ||
    nominalTargetAmount > pool.availableReserveAmount
  ) {
    return {
      sourceAsset,
      targetAsset,
      sourceAmount,
      targetAmount: 0,
      effectiveRate: 0,
      marketRate,
      slippagePct: 100.0,
      clearingFeeAmount: 0,
      slippageAcceptable: false,
      recommendedPoolId: pool.id,
      routeLegs: [],
    };
  }

  // Virtual AMM Slippage curve:
  // slippageRatio = nominalTarget / (2 * availableReserve + nominalTarget)
  const slippageRatio = nominalTargetAmount / (2 * pool.availableReserveAmount + nominalTargetAmount);
  const slippagePct = Math.round(slippageRatio * 1000000) / 10000; // in percentage points, e.g. 0.02%

  const isAcceptable = slippagePct <= maxAcceptableSlippage;

  // Clearing fee in bps (e.g. 2 bps = 0.0002)
  const feeRate = pool.feeTierBps / 10000;
  const grossFee = nominalTargetAmount * feeRate;
  const clearingFeeAmount = normalizeAssetAmount(grossFee, targetAsset);

  // Net target output amount
  const grossSlippedAmount = nominalTargetAmount * (1 - slippageRatio);
  const rawTargetAmount = Math.max(0, grossSlippedAmount - clearingFeeAmount);
  const targetAmount = normalizeAssetAmount(rawTargetAmount, targetAsset);

  const effectiveRate = sourceAmount > 0 ? targetAmount / sourceAmount : 0;

  return {
    sourceAsset,
    targetAsset,
    sourceAmount,
    targetAmount,
    effectiveRate,
    marketRate,
    slippagePct,
    clearingFeeAmount,
    slippageAcceptable: isAcceptable,
    recommendedPoolId: pool.id,
    routeLegs: [
      {
        from: sourceAsset,
        to: targetAsset,
        rate: effectiveRate,
      },
    ],
  };
}

/**
 * Checks whether a liquidity pool has drifted beyond its rebalance threshold (default 15%).
 */
export function needsRebalance(pool: ClearingLiquidityPool): boolean {
  if (pool.targetReserveAmount <= 0) return false;
  const driftRatio = Math.abs(pool.availableReserveAmount - pool.targetReserveAmount) / pool.targetReserveAmount;
  return (driftRatio * 100) >= pool.rebalanceThresholdPct;
}

/**
 * Executes an automated liquidity pool rebalance between a surplus pool and a target pool.
 */
export async function executePoolRebalance(
  db: D1Database,
  sourcePoolId: string,
  targetPoolId: string,
  amount: number
): Promise<{ success: boolean; rebalancedAmount: number; error?: string }> {
  const now = Date.now();
  const sourceRow = await db
    .prepare('SELECT * FROM clearing_liquidity_pools WHERE id = ?')
    .bind(sourcePoolId)
    .first<ClearingLiquidityPoolRow>();

  const targetRow = await db
    .prepare('SELECT * FROM clearing_liquidity_pools WHERE id = ?')
    .bind(targetPoolId)
    .first<ClearingLiquidityPoolRow>();

  if (!sourceRow || !targetRow) {
    return { success: false, rebalancedAmount: 0, error: 'POOL_NOT_FOUND' };
  }

  const sourcePool = rowToClearingLiquidityPool(sourceRow);
  if (sourcePool.availableReserveAmount < amount) {
    return { success: false, rebalancedAmount: 0, error: 'INSUFFICIENT_SOURCE_LIQUIDITY' };
  }

  // Deduct from source pool, credit to target pool
  await db
    .prepare(
      `UPDATE clearing_liquidity_pools 
       SET available_reserve_amount = available_reserve_amount - ?,
           last_rebalanced_at = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(amount, now, now, sourcePoolId)
    .run();

  await db
    .prepare(
      `UPDATE clearing_liquidity_pools 
       SET available_reserve_amount = available_reserve_amount + ?,
           last_rebalanced_at = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(amount, now, now, targetPoolId)
    .run();

  logger.info('Pool rebalance completed successfully', {
    sourcePoolId,
    targetPoolId,
    amount,
  });

  return { success: true, rebalancedAmount: amount };
}

// ── 3. T+0 RTGS Settlement Pipeline ──────────────────────────────────────────

/**
 * Executes a T+0 Real-Time Gross Settlement (RTGS) batch.
 * Verifies liquidity, confirms strict slippage (< 0.05%), records Merkle attestation,
 * updates pool reserves, and persists batch record into D1.
 */
export async function executeRtgsBatch(
  db: D1Database,
  input: ExecuteClearingBatchInput
): Promise<ClearingExecutionResult> {
  const { sourceAsset, targetAsset, grossAmount } = input;
  const settlementType = input.settlementType ?? 'T0_RTGS';

  // Find target pool for settlement asset
  const targetPoolRow = await db
    .prepare(
      `SELECT * FROM clearing_liquidity_pools 
       WHERE asset_symbol = ? AND status = 'active'
       ORDER BY available_reserve_amount DESC LIMIT 1`
    )
    .bind(targetAsset)
    .first<ClearingLiquidityPoolRow>();

  if (!targetPoolRow) {
    return {
      success: false,
      batchId: '',
      batchReference: '',
      sourceAsset,
      targetAsset,
      grossAmount,
      netClearedAmount: 0,
      clearingFeeAmount: 0,
      slippageRealizedPct: 0,
      iso20022MessageId: '',
      merkleRootHash: '',
      settlementType,
      status: 'failed',
      reconciliationStatus: 'pending',
      settledAt: 0,
      error: `NO_ACTIVE_POOL_FOR_ASSET: ${targetAsset}`,
    };
  }

  const pool = rowToClearingLiquidityPool(targetPoolRow);
  const quote = calculateSwapQuote(pool, {
    sourceAsset,
    targetAsset,
    sourceAmount: grossAmount,
    maxAcceptableSlippagePct: MAX_SLIPPAGE_TOLERANCE_PCT,
  });

  if (!quote.slippageAcceptable) {
    return {
      success: false,
      batchId: '',
      batchReference: '',
      sourceAsset,
      targetAsset,
      grossAmount,
      netClearedAmount: 0,
      clearingFeeAmount: 0,
      slippageRealizedPct: quote.slippagePct,
      iso20022MessageId: '',
      merkleRootHash: '',
      settlementType,
      status: 'rejected',
      reconciliationStatus: 'pending',
      settledAt: 0,
      error: `SLIPPAGE_EXCEEDED: Realized ${quote.slippagePct.toFixed(4)}% exceeds 0.05% tolerance cap`,
    };
  }

  if (quote.targetAmount > pool.availableReserveAmount) {
    return {
      success: false,
      batchId: '',
      batchReference: '',
      sourceAsset,
      targetAsset,
      grossAmount,
      netClearedAmount: 0,
      clearingFeeAmount: 0,
      slippageRealizedPct: quote.slippagePct,
      iso20022MessageId: '',
      merkleRootHash: '',
      settlementType,
      status: 'rejected',
      reconciliationStatus: 'pending',
      settledAt: 0,
      error: 'INSUFFICIENT_POOL_RESERVE',
    };
  }

  const now = Date.now();
  const dateStr = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8).toUpperCase()
    : Math.random().toString(36).slice(2, 10).toUpperCase();

  const batchId = `cbb_${dateStr}_${randomSuffix.toLowerCase()}`;
  const batchReference = `RTGS-${dateStr}-${randomSuffix}`;
  const uetr = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${randomSuffix}-0000-4000-8000-${dateStr}`;

  const iso20022MessageId = `urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10:${uetr}`;

  // Compute Merkle root attestation hash
  const merklePayload = `${batchReference}:${sourceAsset}:${targetAsset}:${grossAmount}:${quote.targetAmount}:${uetr}:${now}`;
  const merkleRootHash = await computeSha256(merklePayload);

  // Update liquidity pool reserves in D1
  await db
    .prepare(
      `UPDATE clearing_liquidity_pools 
       SET available_reserve_amount = available_reserve_amount - ?,
           daily_settlement_volume = daily_settlement_volume + ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(quote.targetAmount, quote.targetAmount, now, pool.id)
    .run();

  const metadataJson = JSON.stringify({
    ...(input.metadata ?? {}),
    uetr,
    effectiveRate: quote.effectiveRate,
    marketRate: quote.marketRate,
    poolId: pool.id,
    bankingPartnerRef: input.bankingPartnerRef ?? null,
  });

  // Insert clearing batch record into D1
  await db
    .prepare(
      `INSERT INTO cross_border_clearing_batches (
        id, batch_reference, batch_cycle, source_asset, target_asset,
        gross_amount, net_cleared_amount, clearing_fee_amount, slippage_realized_pct,
        settlement_type, reconciliation_status, banking_partner_ref, iso20022_message_id,
        participant_count, pool_id, status, merkle_root_hash, settled_at,
        metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      batchId,
      batchReference,
      'instant_rtgs',
      sourceAsset,
      targetAsset,
      grossAmount,
      quote.targetAmount,
      quote.clearingFeeAmount,
      quote.slippagePct,
      settlementType,
      'pending',
      input.bankingPartnerRef ?? null,
      iso20022MessageId,
      1,
      pool.id,
      'cleared',
      merkleRootHash,
      now,
      metadataJson,
      now,
      now
    )
    .run();

  logger.info('T+0 RTGS settlement batch cleared', {
    batchId,
    batchReference,
    sourceAsset,
    targetAsset,
    grossAmount,
    netClearedAmount: quote.targetAmount,
    slippagePct: quote.slippagePct,
  });

  return {
    success: true,
    batchId,
    batchReference,
    sourceAsset,
    targetAsset,
    grossAmount,
    netClearedAmount: quote.targetAmount,
    clearingFeeAmount: quote.clearingFeeAmount,
    slippageRealizedPct: quote.slippagePct,
    iso20022MessageId,
    merkleRootHash,
    settlementType,
    status: 'cleared',
    reconciliationStatus: 'pending',
    settledAt: now,
  };
}

// ── 4. Multilateral Netting Algorithm ────────────────────────────────────────

/**
 * Computes multilateral zero-sum netting matrix from bilateral payment legs.
 * Conserves total balances and verifies zero-sum equilibrium.
 */
export function computeMultilateralNetting(
  legs: BilateralTransferLeg[],
  cycleId?: string
): MultilateralNettingMatrix {
  const resolvedCycleId = cycleId ?? `NET-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  if (legs.length === 0) {
    return {
      cycleId: resolvedCycleId,
      asset: 'USD',
      totalGrossVolume: 0,
      totalNetVolume: 0,
      compressionRatioPct: 0,
      zeroSumBalanced: true,
      participantSummaries: [],
      settlementBatchIds: [],
    };
  }

  const asset = legs[0].asset;
  let totalGrossVolume = 0;
  const participantMap: Map<string, { grossPayable: number; grossReceivable: number }> = new Map();

  for (const leg of legs) {
    totalGrossVolume += leg.amount;

    // Sender
    const sender = participantMap.get(leg.fromParticipantId) ?? { grossPayable: 0, grossReceivable: 0 };
    sender.grossPayable += leg.amount;
    participantMap.set(leg.fromParticipantId, sender);

    // Receiver
    const receiver = participantMap.get(leg.toParticipantId) ?? { grossPayable: 0, grossReceivable: 0 };
    receiver.grossReceivable += leg.amount;
    participantMap.set(leg.toParticipantId, receiver);
  }

  const participantSummaries: NettingParticipantSummary[] = [];
  let sumNetBalances = 0;
  let totalNetVolume = 0;

  for (const [participantId, data] of participantMap.entries()) {
    const netSettlementAmount = normalizeAssetAmount(data.grossReceivable - data.grossPayable, asset);
    sumNetBalances += netSettlementAmount;
    if (netSettlementAmount > 0) {
      totalNetVolume += netSettlementAmount;
    }

    participantSummaries.push({
      participantId,
      asset,
      grossPayable: normalizeAssetAmount(data.grossPayable, asset),
      grossReceivable: normalizeAssetAmount(data.grossReceivable, asset),
      netSettlementAmount,
    });
  }

  // Zero-sum invariant: sum of net balances must be ~0 (accounting for precision rounding)
  const zeroSumBalanced = Math.abs(sumNetBalances) < 0.01;
  const compressionRatioPct = totalGrossVolume > 0
    ? Math.max(0, Math.round((1 - (totalNetVolume / totalGrossVolume)) * 10000) / 100)
    : 0;

  return {
    cycleId: resolvedCycleId,
    asset,
    totalGrossVolume: normalizeAssetAmount(totalGrossVolume, asset),
    totalNetVolume: normalizeAssetAmount(totalNetVolume, asset),
    compressionRatioPct,
    zeroSumBalanced,
    participantSummaries,
    settlementBatchIds: [],
  };
}

// ── 5. ISO 20022 Financial Messaging ─────────────────────────────────────────

/**
 * Generates ISO 20022 pacs.008.001.10 Financial Credit Transfer message.
 */
export function generatePacs008Message(
  batch: CrossBorderClearingBatch,
  debtorName: string = 'Sophia Sovereign Clearing Vault',
  creditorName: string = 'Authorized Participant Settlement Entity'
): Iso20022Pacs008Message {
  const now = new Date(batch.settledAt ?? Date.now());
  const creationDateTime = now.toISOString();
  const settlementDate = creationDateTime.slice(0, 10);
  const uetr = (batch.metadata.uetr as string) || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : batch.batchReference);

  return {
    messageDefinitionIdentifier: 'pacs.008.001.10',
    groupHeader: {
      messageId: batch.iso20022MessageId ?? `urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10:${uetr}`,
      creationDateTime,
      numberOfTransactions: 1,
      settlementInformation: {
        settlementMethod: 'CLRG',
        clearingSystem: 'SOPHIA-RTGS-MESH',
      },
    },
    creditTransferTransactionInformation: {
      paymentIdentification: {
        instructionId: batch.id,
        endToEndId: batch.batchReference,
        uetr,
      },
      interbankSettlementAmount: {
        currency: batch.targetAsset,
        amount: batch.netClearedAmount,
      },
      interbankSettlementDate: settlementDate,
      chargeBearer: 'SHAR',
      debtor: {
        name: debtorName,
        identification: 'VAULT-SOPHIA-001',
      },
      creditor: {
        name: creditorName,
        identification: (batch.bankingPartnerRef as string) || 'EXT-BENEFICIARY-001',
      },
      remittanceInformation: {
        unstructured: `T+0 RTGS Clearing Settlement Ref: ${batch.batchReference}`,
      },
    },
  };
}

/**
 * Generates ISO 20022 camt.053.001.10 Bank-to-Customer Statement message.
 */
export function generateCamt053Statement(
  batches: CrossBorderClearingBatch[],
  accountId: string = 'ACCOUNT-SOPHIA-TREASURY'
): Iso20022Camt053Message {
  const now = new Date().toISOString();
  const entries = batches.map((batch) => ({
    entryReference: batch.batchReference,
    amount: batch.netClearedAmount,
    currency: batch.targetAsset,
    creditDebitIndicator: 'CRDT' as const,
    status: 'BOOK' as const,
    bookingDate: new Date(batch.settledAt ?? Date.now()).toISOString().slice(0, 10),
    bankTransactionCode: 'PMNT-ICDT-ESCT',
    proprietaryRef: batch.bankingPartnerRef || batch.id,
  }));

  const totalBalance = batches.reduce((sum, b) => sum + b.netClearedAmount, 0);

  return {
    messageDefinitionIdentifier: 'camt.053.001.10',
    groupHeader: {
      messageId: `STATEMENT-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      creationDateTime: now,
      accountServicer: 'Sophia Central Clearing Mesh',
    },
    statement: {
      statementId: `STMT-${Date.now()}`,
      electronicSequenceNumber: 1,
      creationDateTime: now,
      accountIdentification: accountId,
      balance: {
        type: 'CLBD',
        amount: normalizeAssetAmount(totalBalance, batches[0]?.targetAsset ?? 'USDT'),
        currency: batches[0]?.targetAsset ?? 'USDT',
        date: now.slice(0, 10),
      },
      entries,
    },
  };
}

// ── 6. Automated Banking Reconciliation Engine ────────────────────────────────

/**
 * Reconciles an internal clearing batch against an external bank statement or payment rail feed.
 */
export async function reconcileBatchWithBankStatement(
  db: D1Database,
  input: ReconcileBatchInput
): Promise<ReconciliationResult> {
  const { batchReference, settledAmount, settledCurrency } = input;
  const now = Date.now();

  const batchRow = await db
    .prepare('SELECT * FROM cross_border_clearing_batches WHERE batch_reference = ?')
    .bind(batchReference)
    .first<CrossBorderClearingBatchRow>();

  if (!batchRow) {
    return {
      success: false,
      batchReference,
      previousStatus: 'pending',
      newStatus: 'pending',
      matched: false,
      reconciledAt: now,
      error: 'BATCH_NOT_FOUND',
    };
  }

  const batch = rowToCrossBorderClearingBatch(batchRow);
  const delta = Math.abs(batch.netClearedAmount - settledAmount);
  const currencyMatched = batch.targetAsset === settledCurrency;
  const amountMatched = delta <= 0.01;

  if (currencyMatched && amountMatched) {
    await db
      .prepare(
        `UPDATE cross_border_clearing_batches 
         SET reconciliation_status = 'matched',
             status = 'reconciled',
             banking_partner_ref = COALESCE(banking_partner_ref, ?),
             reconciled_at = ?,
             updated_at = ?
         WHERE batch_reference = ?`
      )
      .bind(input.externalStatementRef, now, now, batchReference)
      .run();

    logger.info('Banking reconciliation matched', {
      batchReference,
      externalRef: input.externalStatementRef,
      settledAmount,
    });

    return {
      success: true,
      batchReference,
      previousStatus: batch.reconciliationStatus,
      newStatus: 'matched',
      matched: true,
      reconciledAt: now,
    };
  }

  // Mismatch detected
  await db
    .prepare(
      `UPDATE cross_border_clearing_batches 
       SET reconciliation_status = 'discrepancy',
           updated_at = ?
       WHERE batch_reference = ?`
    )
    .bind(now, batchReference)
    .run();

  logger.warn('Banking reconciliation discrepancy detected', {
    batchReference,
    expectedAmount: batch.netClearedAmount,
    actualAmount: settledAmount,
    currencyExpected: batch.targetAsset,
    currencyActual: settledCurrency,
    delta,
  });

  return {
    success: false,
    batchReference,
    previousStatus: batch.reconciliationStatus,
    newStatus: 'discrepancy',
    discrepancyDelta: delta,
    matched: false,
    reconciledAt: now,
    error: `DISCREPANCY: Expected ${batch.netClearedAmount} ${batch.targetAsset}, received ${settledAmount} ${settledCurrency}`,
  };
}

// ── 7. Query Helpers ─────────────────────────────────────────────────────────

export async function listLiquidityPools(db: D1Database): Promise<ClearingLiquidityPool[]> {
  const result = await db
    .prepare('SELECT * FROM clearing_liquidity_pools ORDER BY asset_symbol ASC')
    .all<ClearingLiquidityPoolRow>();

  return (result.results ?? []).map(rowToClearingLiquidityPool);
}

export async function getLiquidityPoolByAsset(
  db: D1Database,
  asset: ClearingAsset
): Promise<ClearingLiquidityPool | null> {
  const row = await db
    .prepare("SELECT * FROM clearing_liquidity_pools WHERE asset_symbol = ? AND status = 'active'")
    .bind(asset)
    .first<ClearingLiquidityPoolRow>();

  return row ? rowToClearingLiquidityPool(row) : null;
}

export async function getClearingBatchByRef(
  db: D1Database,
  batchReference: string
): Promise<CrossBorderClearingBatch | null> {
  const row = await db
    .prepare('SELECT * FROM cross_border_clearing_batches WHERE batch_reference = ?')
    .bind(batchReference)
    .first<CrossBorderClearingBatchRow>();

  return row ? rowToCrossBorderClearingBatch(row) : null;
}

export async function listClearingBatches(
  db: D1Database,
  options?: { status?: ClearingBatchStatus; limit?: number }
): Promise<CrossBorderClearingBatch[]> {
  const limit = options?.limit ?? 50;
  if (options?.status) {
    const result = await db
      .prepare('SELECT * FROM cross_border_clearing_batches WHERE status = ? ORDER BY created_at DESC LIMIT ?')
      .bind(options.status, limit)
      .all<CrossBorderClearingBatchRow>();
    return (result.results ?? []).map(rowToCrossBorderClearingBatch);
  }

  const result = await db
    .prepare('SELECT * FROM cross_border_clearing_batches ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all<CrossBorderClearingBatchRow>();

  return (result.results ?? []).map(rowToCrossBorderClearingBatch);
}
