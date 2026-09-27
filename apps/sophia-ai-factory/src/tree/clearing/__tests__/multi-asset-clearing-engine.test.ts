/** @vitest-environment node */

/**
 * Unit Test Suite: Multi-Asset Clearing Engine
 *
 * Validates:
 * 1. Currency spot exchange rates and subunit normalization (JPY, VND, EUR, SGD, USDT, USDC, USD)
 * 2. Virtual AMM reserve pricing with strict slippage cap (< 0.05% / 5 bps)
 * 3. Liquidity pool rebalance threshold detection and rebalancing execution
 * 4. T+0 RTGS settlement pipeline with Merkle root hash attestation and D1 persistence
 * 5. Multilateral netting matrix with zero-sum invariant verification and compression ratio
 * 6. ISO 20022 pacs.008.001.10 and camt.053.001.10 financial message generation
 * 7. Automated banking statement reconciliation (exact match & discrepancy detection)
 *
 * @module tree/clearing/__tests__/multi-asset-clearing-engine.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@/seed/db/client';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type {
  ClearingLiquidityPool,
  BilateralTransferLeg,
} from '@/seed/types/multi-asset-clearing';
import {
  BASE_EQUIVALENCE_USD,
  getSpotExchangeRate,
  normalizeAssetAmount,
  calculateSwapQuote,
  needsRebalance,
  executePoolRebalance,
  executeRtgsBatch,
  computeMultilateralNetting,
  generatePacs008Message,
  generateCamt053Statement,
  reconcileBatchWithBankStatement,
  listLiquidityPools,
  getLiquidityPoolByAsset,
  computeSha256,
} from '../multi-asset-clearing-engine';
import {
  getClearingLiquidityPoolsAction,
  quoteClearingSwapAction,
  executeCrossBorderClearingAction,
  reconcileClearingBatchAction,
  getSwarmV2ConsensusStateAction,
  recordSwarmV2HeartbeatAction,
  triggerPoolRebalanceAction,
  getClearingBatchesAction,
} from '@/land/clearing/clearing-actions';

let mockCurrentUser: { id: string; email: string; role: string } | null = {
  id: 'usr_test_treasury_001',
  email: 'treasury@sophia.agencyos.network',
  role: 'treasury_lead',
};

let activeTestD1: D1Database;

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(async () => mockCurrentUser),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(async () => activeTestD1),
  getD1Safe: vi.fn(async () => activeTestD1),
  getD1Raw: vi.fn(async () => activeTestD1),
}));

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

describe('Multi-Asset Clearing Engine — Unit Tests', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let db: D1Database;

  const mockUsdtPool: ClearingLiquidityPool = {
    id: 'pool_usdt_primary',
    poolCode: 'LP-USDT',
    assetSymbol: 'USDT',
    poolName: 'Global Primary USDT Settlement Pool',
    totalReserveAmount: 2500000.0,
    availableReserveAmount: 2500000.0,
    lockedReserveAmount: 0.0,
    targetReserveAmount: 2500000.0,
    minReserveThreshold: 250000.0,
    maxSlippagePct: 0.05,
    virtualLiquidityK: 6250000000000.0,
    feeTierBps: 2,
    rebalanceThresholdPct: 15.0,
    dailySettlementVolume: 0.0,
    status: 'active',
    lastRebalancedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mockVndPool: ClearingLiquidityPool = {
    id: 'pool_vnd_primary',
    poolCode: 'LP-VND',
    assetSymbol: 'VND',
    poolName: 'Vietnam NAPAS VietQR VND Liquidity Pool',
    totalReserveAmount: 35000000000.0,
    availableReserveAmount: 35000000000.0,
    lockedReserveAmount: 0.0,
    targetReserveAmount: 35000000000.0,
    minReserveThreshold: 3500000000.0,
    maxSlippagePct: 0.05,
    virtualLiquidityK: 1225000000000000000000.0,
    feeTierBps: 4,
    rebalanceThresholdPct: 15.0,
    dailySettlementVolume: 0.0,
    status: 'active',
    lastRebalancedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS clearing_liquidity_pools (
        id TEXT PRIMARY KEY,
        pool_code TEXT NOT NULL UNIQUE,
        asset_symbol TEXT NOT NULL,
        pool_name TEXT NOT NULL,
        total_reserve_amount REAL NOT NULL DEFAULT 0.0,
        available_reserve_amount REAL NOT NULL DEFAULT 0.0,
        locked_reserve_amount REAL NOT NULL DEFAULT 0.0,
        target_reserve_amount REAL NOT NULL DEFAULT 0.0,
        min_reserve_threshold REAL NOT NULL DEFAULT 0.0,
        max_slippage_pct REAL NOT NULL DEFAULT 0.05,
        virtual_liquidity_k REAL NOT NULL DEFAULT 0.0,
        fee_tier_bps INTEGER NOT NULL DEFAULT 2,
        rebalance_threshold_pct REAL NOT NULL DEFAULT 15.0,
        daily_settlement_volume REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'active',
        last_rebalanced_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cross_border_clearing_batches (
        id TEXT PRIMARY KEY,
        batch_reference TEXT NOT NULL UNIQUE,
        batch_cycle TEXT NOT NULL,
        source_asset TEXT NOT NULL,
        target_asset TEXT NOT NULL,
        gross_amount REAL NOT NULL,
        net_cleared_amount REAL NOT NULL,
        clearing_fee_amount REAL NOT NULL DEFAULT 0.0,
        slippage_realized_pct REAL NOT NULL DEFAULT 0.0,
        settlement_type TEXT NOT NULL DEFAULT 'T0_RTGS',
        reconciliation_status TEXT NOT NULL DEFAULT 'pending',
        banking_partner_ref TEXT,
        iso20022_message_id TEXT,
        participant_count INTEGER NOT NULL DEFAULT 1,
        pool_id TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        merkle_root_hash TEXT,
        settled_at INTEGER,
        reconciled_at INTEGER,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      INSERT INTO clearing_liquidity_pools (
        id, pool_code, asset_symbol, pool_name, total_reserve_amount, available_reserve_amount,
        locked_reserve_amount, target_reserve_amount, min_reserve_threshold, max_slippage_pct,
        virtual_liquidity_k, fee_tier_bps, rebalance_threshold_pct, status, created_at, updated_at
      ) VALUES
      ('pool_usdt_primary', 'LP-USDT', 'USDT', 'Global Primary USDT Settlement Pool', 2500000.0, 2500000.0, 0.0, 2500000.0, 250000.0, 0.05, 6250000000000.0, 2, 15.0, 'active', 1700000000000, 1700000000000),
      ('pool_usdc_primary', 'LP-USDC', 'USDC', 'Global Primary USDC Settlement Pool', 3000000.0, 3000000.0, 0.0, 3000000.0, 300000.0, 0.05, 9000000000000.0, 2, 15.0, 'active', 1700000000000, 1700000000000),
      ('pool_eur_primary', 'LP-EUR', 'EUR', 'European SEPA Instant EUR Liquidity Pool', 1800000.0, 1800000.0, 0.0, 1800000.0, 180000.0, 0.05, 3240000000000.0, 3, 15.0, 'active', 1700000000000, 1700000000000),
      ('pool_vnd_primary', 'LP-VND', 'VND', 'Vietnam NAPAS VietQR VND Liquidity Pool', 35000000000.0, 35000000000.0, 0.0, 35000000000.0, 3500000000.0, 0.05, 1225000000000000000000.0, 4, 15.0, 'active', 1700000000000, 1700000000000);

      CREATE TABLE IF NOT EXISTS swarm_v2_consensus_state (
        id TEXT PRIMARY KEY,
        term INTEGER NOT NULL DEFAULT 0,
        leader_node_id TEXT,
        consensus_protocol TEXT NOT NULL DEFAULT 'RAFT_BFT',
        cluster_epoch INTEGER NOT NULL DEFAULT 1,
        view_number INTEGER NOT NULL DEFAULT 0,
        commit_index INTEGER NOT NULL DEFAULT 0,
        last_applied_index INTEGER NOT NULL DEFAULT 0,
        quorum_size INTEGER NOT NULL DEFAULT 3,
        active_voters_count INTEGER NOT NULL DEFAULT 1,
        byzantine_tolerance_f INTEGER NOT NULL DEFAULT 1,
        avg_heartbeat_latency_ms REAL NOT NULL DEFAULT 0.0,
        p99_heartbeat_latency_ms REAL NOT NULL DEFAULT 0.0,
        is_quorum_healthy INTEGER NOT NULL DEFAULT 1,
        split_brain_detected INTEGER NOT NULL DEFAULT 0,
        last_leader_election_at INTEGER NOT NULL,
        last_heartbeat_round_at INTEGER NOT NULL,
        membership_nodes_json TEXT NOT NULL DEFAULT '[]',
        audit_state_hash TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      INSERT INTO swarm_v2_consensus_state (
        id, term, leader_node_id, consensus_protocol, cluster_epoch, view_number,
        commit_index, last_applied_index, quorum_size, active_voters_count,
        byzantine_tolerance_f, avg_heartbeat_latency_ms, p99_heartbeat_latency_ms,
        is_quorum_healthy, split_brain_detected, last_leader_election_at,
        last_heartbeat_round_at, membership_nodes_json, audit_state_hash, updated_at
      ) VALUES (
        'state_mesh_v2_global', 1, 'node_apac_coordinator_01', 'RAFT_BFT', 1, 0,
        100, 100, 3, 5, 1, 4.35, 8.12, 1, 0, 1700000000000, 1700000000000,
        '["node_apac_coordinator_01", "node_apac_sales_01", "node_apac_healer_01", "node_us_sales_01", "node_eu_healer_01"]',
        '0000000000000000000000000000000000000000000000000000000000000000', 1700000000000
      );
    `);
    db = makeD1(rawDb) as unknown as D1Database;
    activeTestD1 = db;
    mockCurrentUser = {
      id: 'usr_test_treasury_001',
      email: 'treasury@sophia.agencyos.network',
      role: 'treasury_lead',
    };
  });

  describe('1. Currency Equivalences & Subunit Precision', () => {
    it('calculates correct spot exchange rates between clearing assets', () => {
      expect(getSpotExchangeRate('USD', 'USD')).toBe(1.0);
      expect(getSpotExchangeRate('USDT', 'USDC')).toBe(1.0);
      expect(getSpotExchangeRate('EUR', 'USD')).toBeCloseTo(1.0850, 4);
      expect(getSpotExchangeRate('USD', 'JPY')).toBeCloseTo(1 / BASE_EQUIVALENCE_USD.JPY, 2);
      expect(getSpotExchangeRate('SGD', 'USD')).toBeCloseTo(0.7450, 4);
    });

    it('normalizes currency amounts to appropriate minor units', () => {
      // JPY rounded to nearest integer
      expect(normalizeAssetAmount(1542.49, 'JPY')).toBe(1542);
      expect(normalizeAssetAmount(1542.51, 'JPY')).toBe(1543);

      // VND rounded to nearest 1,000 VND bank note
      expect(normalizeAssetAmount(25412.0, 'VND')).toBe(25000);
      expect(normalizeAssetAmount(25650.0, 'VND')).toBe(26000);

      // USD / USDT / EUR rounded to 2 decimal places
      expect(normalizeAssetAmount(100.456, 'USDT')).toBe(100.46);
      expect(normalizeAssetAmount(100.454, 'EUR')).toBe(100.45);
    });
  });

  describe('2. Virtual AMM Pricing & Strict Slippage Cap (< 0.05%)', () => {
    it('accepts swap quote when trade size causes slippage below 0.05% (5 bps)', () => {
      // Trade of $1,000 against a $2,500,000 reserve pool
      const quote = calculateSwapQuote(mockUsdtPool, {
        sourceAsset: 'USDC',
        targetAsset: 'USDT',
        sourceAmount: 1000.0,
      });

      expect(quote.slippageAcceptable).toBe(true);
      expect(quote.slippagePct).toBeLessThan(0.05);
      expect(quote.targetAmount).toBeGreaterThan(990);
      expect(quote.clearingFeeAmount).toBeGreaterThan(0); // 2 bps fee applied
      expect(quote.effectiveRate).toBeCloseTo(1.0, 2);
    });

    it('rejects swap quote when trade size causes slippage exceeding 0.05%', () => {
      // Trade of $50,000 against a $2,500,000 reserve pool:
      // nominalTarget = 50,000. 50,000 / (2 * 2,500,000 + 50,000) ~ 50,000 / 5,050,000 ~ 0.0099 => 0.99% >> 0.05%
      const quote = calculateSwapQuote(mockUsdtPool, {
        sourceAsset: 'USDC',
        targetAsset: 'USDT',
        sourceAmount: 50000.0,
      });

      expect(quote.slippageAcceptable).toBe(false);
      expect(quote.slippagePct).toBeGreaterThan(0.05);
    });

    it('rejects swap quote when pool is depleted or inactive', () => {
      const depletedPool: ClearingLiquidityPool = {
        ...mockUsdtPool,
        status: 'depleted',
        availableReserveAmount: 0.0,
      };

      const quote = calculateSwapQuote(depletedPool, {
        sourceAsset: 'USDC',
        targetAsset: 'USDT',
        sourceAmount: 500.0,
      });

      expect(quote.slippageAcceptable).toBe(false);
      expect(quote.targetAmount).toBe(0);
    });
  });

  describe('3. Liquidity Pool Rebalancing', () => {
    it('detects when reserve drift exceeds the 15% rebalance threshold', () => {
      const balancedPool: ClearingLiquidityPool = {
        ...mockUsdtPool,
        availableReserveAmount: 2400000.0, // 4% drift
        targetReserveAmount: 2500000.0,
      };
      expect(needsRebalance(balancedPool)).toBe(false);

      const driftedPool: ClearingLiquidityPool = {
        ...mockUsdtPool,
        availableReserveAmount: 2100000.0, // 16% drift
        targetReserveAmount: 2500000.0,
      };
      expect(needsRebalance(driftedPool)).toBe(true);
    });

    it('executes reserve rebalance between surplus and target pools', async () => {
      const result = await executePoolRebalance(
        db,
        'pool_usdc_primary',
        'pool_usdt_primary',
        100000.0
      );

      expect(result.success).toBe(true);
      expect(result.rebalancedAmount).toBe(100000.0);

      const usdcPool = await db.prepare('SELECT available_reserve_amount FROM clearing_liquidity_pools WHERE id = ?')
        .bind('pool_usdc_primary').first<{ available_reserve_amount: number }>();
      const usdtPool = await db.prepare('SELECT available_reserve_amount FROM clearing_liquidity_pools WHERE id = ?')
        .bind('pool_usdt_primary').first<{ available_reserve_amount: number }>();

      expect(usdcPool?.available_reserve_amount).toBe(2900000.0);
      expect(usdtPool?.available_reserve_amount).toBe(2600000.0);
    });
  });

  describe('4. T+0 RTGS Settlement Pipeline', () => {
    it('executes a T+0 RTGS batch, updates pool reserves and records Merkle attestation', async () => {
      const input = {
        sourceAsset: 'USD' as const,
        targetAsset: 'USDT' as const,
        grossAmount: 1200.0,
        settlementType: 'T0_RTGS' as const,
        bankingPartnerRef: 'TEST-PARTNER-REF-001',
      };

      const result = await executeRtgsBatch(db, input);

      expect(result.success).toBe(true);
      expect(result.status).toBe('cleared');
      expect(result.batchReference).toMatch(/^RTGS-\d{8}-[A-Z0-9]+$/);
      expect(result.slippageRealizedPct).toBeLessThan(0.05);
      expect(result.merkleRootHash).toHaveLength(64); // SHA-256
      expect(result.iso20022MessageId).toContain('pacs.008.001.10');

      // Verify pool reserve was deducted
      const pool = await getLiquidityPoolByAsset(db, 'USDT');
      expect(pool?.availableReserveAmount).toBeLessThan(2500000.0);
      expect(pool?.dailySettlementVolume).toBeGreaterThan(0);
    });

    it('rejects RTGS batch when trade volume causes slippage cap violation', async () => {
      const input = {
        sourceAsset: 'USD' as const,
        targetAsset: 'USDT' as const,
        grossAmount: 80000.0, // Excessive trade volume
      };

      const result = await executeRtgsBatch(db, input);

      expect(result.success).toBe(false);
      expect(result.status).toBe('rejected');
      expect(result.error).toContain('SLIPPAGE_EXCEEDED');
    });
  });

  describe('5. Multilateral Netting Algorithm', () => {
    it('compresses circular bilateral transfers and proves zero-sum equilibrium', () => {
      const legs: BilateralTransferLeg[] = [
        { fromParticipantId: 'P_ALICE', toParticipantId: 'P_BOB', asset: 'USDT', amount: 1000.0 },
        { fromParticipantId: 'P_BOB', toParticipantId: 'P_CHARLIE', asset: 'USDT', amount: 800.0 },
        { fromParticipantId: 'P_CHARLIE', toParticipantId: 'P_ALICE', asset: 'USDT', amount: 500.0 },
        { fromParticipantId: 'P_CHARLIE', toParticipantId: 'P_BOB', asset: 'USDT', amount: 200.0 },
      ];

      const matrix = computeMultilateralNetting(legs);

      expect(matrix.zeroSumBalanced).toBe(true);
      expect(matrix.totalGrossVolume).toBe(2500.0);
      expect(matrix.totalNetVolume).toBeLessThan(matrix.totalGrossVolume);
      expect(matrix.compressionRatioPct).toBeGreaterThan(0);

      // Verify individual net settlements
      // Alice: received 500, paid 1000 => net -500
      // Bob: received 1000 + 200 = 1200, paid 800 => net +400
      // Charlie: received 800, paid 500 + 200 = 700 => net +100
      // Net sum = -500 + 400 + 100 = 0!
      const alice = matrix.participantSummaries.find((p) => p.participantId === 'P_ALICE');
      const bob = matrix.participantSummaries.find((p) => p.participantId === 'P_BOB');
      const charlie = matrix.participantSummaries.find((p) => p.participantId === 'P_CHARLIE');

      expect(alice?.netSettlementAmount).toBe(-500.0);
      expect(bob?.netSettlementAmount).toBe(400.0);
      expect(charlie?.netSettlementAmount).toBe(100.0);
    });
  });

  describe('6. ISO 20022 Financial Messaging', () => {
    it('generates valid pacs.008.001.10 credit transfer message', () => {
      const mockBatch = {
        id: 'cbb_20270926_001',
        batchReference: 'RTGS-20270926-0001',
        batchCycle: 'instant_rtgs' as const,
        sourceAsset: 'USD' as const,
        targetAsset: 'EUR' as const,
        grossAmount: 1000.0,
        netClearedAmount: 921.45,
        clearingFeeAmount: 0.20,
        slippageRealizedPct: 0.015,
        settlementType: 'T0_RTGS' as const,
        reconciliationStatus: 'pending' as const,
        bankingPartnerRef: 'SEPA-UETR-999',
        iso20022MessageId: 'urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10:test-uuid',
        participantCount: 1,
        poolId: 'pool_eur_primary',
        status: 'cleared' as const,
        merkleRootHash: 'hash-abc-123',
        settledAt: Date.now(),
        reconciledAt: null,
        metadata: { uetr: 'test-uetr-uuid-001' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const msg = generatePacs008Message(mockBatch);

      expect(msg.messageDefinitionIdentifier).toBe('pacs.008.001.10');
      expect(msg.groupHeader.settlementInformation.settlementMethod).toBe('CLRG');
      expect(msg.creditTransferTransactionInformation.interbankSettlementAmount.currency).toBe('EUR');
      expect(msg.creditTransferTransactionInformation.interbankSettlementAmount.amount).toBe(921.45);
      expect(msg.creditTransferTransactionInformation.paymentIdentification.endToEndId).toBe('RTGS-20270926-0001');
    });

    it('generates valid camt.053.001.10 bank statement message', () => {
      const mockBatch = {
        id: 'cbb_20270926_002',
        batchReference: 'RTGS-20270926-0002',
        batchCycle: 'instant_rtgs' as const,
        sourceAsset: 'USD' as const,
        targetAsset: 'USDT' as const,
        grossAmount: 500.0,
        netClearedAmount: 499.85,
        clearingFeeAmount: 0.10,
        slippageRealizedPct: 0.01,
        settlementType: 'T0_RTGS' as const,
        reconciliationStatus: 'pending' as const,
        bankingPartnerRef: null,
        iso20022MessageId: null,
        participantCount: 1,
        poolId: 'pool_usdt_primary',
        status: 'cleared' as const,
        merkleRootHash: null,
        settledAt: Date.now(),
        reconciledAt: null,
        metadata: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const stmt = generateCamt053Statement([mockBatch]);

      expect(stmt.messageDefinitionIdentifier).toBe('camt.053.001.10');
      expect(stmt.statement.entries).toHaveLength(1);
      expect(stmt.statement.entries[0].amount).toBe(499.85);
      expect(stmt.statement.entries[0].creditDebitIndicator).toBe('CRDT');
    });
  });

  describe('7. Automated Banking Statement Reconciliation', () => {
    it('successfully matches internal batch with bank statement and updates status to reconciled', async () => {
      // First execute a batch
      const batchRes = await executeRtgsBatch(db, {
        sourceAsset: 'USD',
        targetAsset: 'USDT',
        grossAmount: 1000.0,
      });

      expect(batchRes.success).toBe(true);

      const recon = await reconcileBatchWithBankStatement(db, {
        batchReference: batchRes.batchReference,
        externalStatementRef: 'BANK-STMT-TRX-100234',
        settledAmount: batchRes.netClearedAmount,
        settledCurrency: 'USDT',
      });

      expect(recon.success).toBe(true);
      expect(recon.matched).toBe(true);
      expect(recon.newStatus).toBe('matched');

      // Verify batch in D1 is reconciled
      const batchRow = await db.prepare('SELECT status, reconciliation_status FROM cross_border_clearing_batches WHERE batch_reference = ?')
        .bind(batchRes.batchReference).first<{ status: string; reconciliation_status: string }>();

      expect(batchRow?.status).toBe('reconciled');
      expect(batchRow?.reconciliation_status).toBe('matched');
    });

    it('detects amount discrepancy and prevents false reconciliation', async () => {
      const batchRes = await executeRtgsBatch(db, {
        sourceAsset: 'USD',
        targetAsset: 'USDT',
        grossAmount: 1000.0,
      });

      const recon = await reconcileBatchWithBankStatement(db, {
        batchReference: batchRes.batchReference,
        externalStatementRef: 'BANK-STMT-TRX-DISCREPANT',
        settledAmount: batchRes.netClearedAmount - 50.0, // $50 mismatch
        settledCurrency: 'USDT',
      });

      expect(recon.success).toBe(false);
      expect(recon.matched).toBe(false);
      expect(recon.newStatus).toBe('discrepancy');
      expect(recon.discrepancyDelta).toBe(50.0);
    });
  });

  describe('8. Land Server Actions', () => {
    it('getClearingLiquidityPoolsAction returns pools when authenticated, rejects when unauthenticated', async () => {
      // Authenticated
      const authRes = await getClearingLiquidityPoolsAction();
      expect(authRes.ok).toBe(true);
      if (authRes.ok) {
        expect(authRes.value.length).toBeGreaterThanOrEqual(4);
      }

      // Unauthenticated
      mockCurrentUser = null;
      const unauthRes = await getClearingLiquidityPoolsAction();
      expect(unauthRes.ok).toBe(false);
      if (!unauthRes.ok) {
        expect(unauthRes.error.code).toBe('GET_POOLS_FAILED');
      }
      mockCurrentUser = { id: 'usr_test_treasury_001', email: 'treasury@sophia.agencyos.network', role: 'treasury_lead' };
    });

    it('quoteClearingSwapAction quotes valid asset swaps and rejects missing pools', async () => {
      const validQuote = await quoteClearingSwapAction({
        sourceAsset: 'USDC',
        targetAsset: 'USDT',
        sourceAmount: 1000.0,
      });
      expect(validQuote.ok).toBe(true);
      if (validQuote.ok) {
        expect(validQuote.value.slippageAcceptable).toBe(true);
        expect(validQuote.value.targetAmount).toBeGreaterThan(0);
      }

      const invalidQuote = await quoteClearingSwapAction({
        sourceAsset: 'USDC',
        targetAsset: 'JPY', // JPY not in initial in-memory DB
        sourceAmount: 1000.0,
      });
      expect(invalidQuote.ok).toBe(false);
    });

    it('executeCrossBorderClearingAction and reconcileClearingBatchAction lifecycle', async () => {
      const execRes = await executeCrossBorderClearingAction({
        sourceAsset: 'USD',
        targetAsset: 'USDT',
        grossAmount: 1500.0,
      });
      expect(execRes.ok).toBe(true);
      if (execRes.ok) {
        expect(execRes.value.status).toBe('cleared');
        expect(execRes.value.slippageRealizedPct).toBeLessThan(0.05);

        // Reconcile batch
        const reconRes = await reconcileClearingBatchAction({
          batchReference: execRes.value.batchReference,
          externalStatementRef: 'STATEMENT-WIRE-98765',
          settledAmount: execRes.value.netClearedAmount,
          settledCurrency: 'USDT',
        });
        expect(reconRes.ok).toBe(true);
        if (reconRes.ok) {
          expect(reconRes.value.matched).toBe(true);
        }
      }

      // Check batch list
      const listRes = await getClearingBatchesAction();
      expect(listRes.ok).toBe(true);
      if (listRes.ok) {
        expect(listRes.value.length).toBeGreaterThan(0);
      }
    });

    it('getSwarmV2ConsensusStateAction and recordSwarmV2HeartbeatAction telemetry', async () => {
      const stateRes = await getSwarmV2ConsensusStateAction();
      expect(stateRes.ok).toBe(true);
      if (stateRes.ok) {
        expect(stateRes.value.leaderNodeId).toBe('node_apac_coordinator_01');
        expect(stateRes.value.avgHeartbeatLatencyMs).toBeLessThan(10.0);
      }

      const hbRes = await recordSwarmV2HeartbeatAction({
        nodeId: 'node_apac_sales_01',
        roundTripLatencyMs: 4.8,
        term: 1,
        commitIndex: 100,
      });
      expect(hbRes.ok).toBe(true);
      if (hbRes.ok) {
        expect(hbRes.value.isSub10ms).toBe(true);
      }
    });

    it('triggerPoolRebalanceAction transfers reserves between pools', async () => {
      const rebalRes = await triggerPoolRebalanceAction({
        sourcePoolId: 'pool_usdc_primary',
        targetPoolId: 'pool_usdt_primary',
        amount: 50000.0,
      });
      expect(rebalRes.ok).toBe(true);
      if (rebalRes.ok) {
        expect(rebalRes.value.rebalancedAmount).toBe(50000.0);
      }
    });
  });
});
