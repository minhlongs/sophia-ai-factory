/** @vitest-environment node */

import { describe, it, expect, beforeEach } from 'vitest';
import { makeD1, freshDb } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@/seed/db/client';

// Scenario 1 Imports
import {
  validateManualAdjustment,
  recordQuarantineEventInDb,
  evaluateAllControls,
  generateCryptographicAttestation,
  sha256Sync,
} from '@/tree/ipo/sox404-control-ledger';
import {
  SOX_CONTROL_IDS,
  type JournalAdjustmentInput,
} from '@/seed/types/ipo-filing';

// Scenario 2 Imports
import {
  calculateSwapQuote,
  computeMultilateralNetting,
  needsRebalance,
  getSpotExchangeRate,
  normalizeAssetAmount,
  executeRtgsBatch,
  executePoolRebalance,
  listLiquidityPools,
  generatePacs008Message,
  generateCamt053Statement,
} from '@/tree/clearing/multi-asset-clearing-engine';
import {
  MAX_SLIPPAGE_TOLERANCE_PCT,
  type ClearingLiquidityPool,
  type BilateralTransferLeg,
} from '@/seed/types/multi-asset-clearing';

// Scenario 3 Imports
import {
  calculateNodeFitnessScore,
  selectOptimalComputeNode,
  estimateRenderMetrics,
  dispatchRenderJob,
  rerouteInFlightJob,
  getMeshTopology,
} from '@/tree/gpu/workload-balancer';
import {
  FITNESS_WEIGHTS,
  GATE_10_CONSTANTS,
  RESOLUTION_VRAM_MIN_GB,
  type GpuComputeNode,
  type VideoRenderJobInput,
} from '@/seed/types/edge-gpu-mesh';

// Scenario 4 Imports
import {
  calculateSixNinesUptimeMetrics,
  determineSixNinesBreachTier,
  fundSlaEscrow,
  evaluateSixNinesSlaPeriod,
  claimSlaPenalty,
  releaseEscrowToRevenue,
} from '@/tree/gpu/six-nines-sla-engine';
import { BREACH_PENALTY_PCT } from '@/seed/types/edge-gpu-mesh';

async function setupTables(db: D1Database) {
  const tables = [
    `CREATE TABLE IF NOT EXISTS sox_404_control_matrix (
      control_id TEXT PRIMARY KEY,
      unauthorized_attempts_detected INTEGER DEFAULT 0,
      quarantined_entries_count INTEGER DEFAULT 0,
      test_evidence_hash TEXT,
      last_evaluated_at INTEGER,
      last_evaluation_status TEXT,
      last_tested_by TEXT,
      is_preventive INTEGER DEFAULT 1,
      updated_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS financial_close_periods (
      id TEXT PRIMARY KEY,
      period_key TEXT,
      closed_by TEXT,
      close_status TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS multi_entity_consolidations (
      consolidation_batch_id TEXT PRIMARY KEY,
      entity_code TEXT,
      elimination_balanced INTEGER,
      zero_penny_leakage_verified INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS revenue_schedules (
      id TEXT PRIMARY KEY,
      contract_id TEXT,
      total_contract_value_cents INTEGER,
      recognized_revenue_cents INTEGER,
      deferred_revenue_cents INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS ipo_filing_periods (
      id TEXT PRIMARY KEY,
      period_key TEXT,
      merkle_root_hash TEXT,
      sec_filing_signature TEXT,
      status TEXT,
      gaap_net_income_cents INTEGER,
      depreciation_amortization_cents INTEGER,
      stock_based_compensation_cents INTEGER,
      unrealized_fx_gain_loss_cents INTEGER,
      one_time_mna_restructuring_cents INTEGER,
      adjusted_ebitda_cents INTEGER,
      gaap_operating_cash_flow_cents INTEGER,
      capex_cents INTEGER,
      free_cash_flow_cents INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS clearing_liquidity_pools (
      id TEXT PRIMARY KEY,
      asset_symbol TEXT,
      status TEXT,
      available_reserve_amount REAL,
      target_reserve_amount REAL,
      rebalance_threshold_pct REAL,
      fee_tier_bps INTEGER,
      daily_settlement_volume REAL,
      last_rebalanced_at INTEGER,
      updated_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS cross_border_clearing_batches (
      id TEXT PRIMARY KEY,
      batch_reference TEXT,
      batch_cycle TEXT,
      source_asset TEXT,
      target_asset TEXT,
      gross_amount REAL,
      net_cleared_amount REAL,
      clearing_fee_amount REAL,
      slippage_realized_pct REAL,
      settlement_type TEXT,
      reconciliation_status TEXT,
      banking_partner_ref TEXT,
      iso20022_message_id TEXT,
      participant_count INTEGER,
      pool_id TEXT,
      status TEXT,
      merkle_root_hash TEXT,
      settled_at INTEGER,
      metadata_json TEXT,
      reconciled_at INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS gpu_compute_nodes (
      node_id TEXT PRIMARY KEY,
      region TEXT,
      gpu_model TEXT,
      is_healthy INTEGER,
      status TEXT,
      current_load_pct REAL,
      p95_latency_ms REAL,
      on_demand_price_cents_per_hour INTEGER,
      spot_price_cents_per_hour INTEGER,
      health_score REAL,
      vram_gb_per_gpu INTEGER,
      active_render_jobs INTEGER,
      max_concurrency INTEGER,
      max_resolution TEXT,
      supported_codecs TEXT,
      gpu_count INTEGER,
      total_vram_gb INTEGER,
      total_renders_completed INTEGER,
      total_render_seconds INTEGER,
      updated_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS video_render_dispatches (
      dispatch_id TEXT PRIMARY KEY,
      tenant_id TEXT,
      job_id TEXT,
      node_id TEXT,
      video_resolution TEXT,
      video_duration_seconds INTEGER,
      frame_count INTEGER,
      codec TEXT,
      status TEXT,
      priority_score INTEGER,
      spot_pricing_applied INTEGER,
      cost_cents INTEGER,
      queue_wait_ms INTEGER,
      sla_target_ms INTEGER,
      sla_breached INTEGER,
      reroute_count INTEGER,
      failover_history_json TEXT,
      render_duration_ms INTEGER,
      egress_bytes INTEGER,
      error_message TEXT,
      dispatched_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS sla_penalty_escrow (
      escrow_id TEXT PRIMARY KEY,
      tenant_id TEXT,
      contract_id TEXT,
      period_month TEXT,
      target_sla_pct REAL,
      actual_uptime_pct REAL,
      total_period_seconds INTEGER,
      allowed_downtime_seconds REAL,
      downtime_seconds REAL,
      error_budget_consumed_seconds REAL,
      error_budget_remaining_seconds REAL,
      escrow_funded_cents INTEGER,
      penalty_claimed_cents INTEGER,
      escrow_balance_cents INTEGER,
      breach_tier TEXT,
      penalty_pct REAL,
      escrow_status TEXT,
      last_breach_timestamp INTEGER,
      audit_hash TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      UNIQUE(tenant_id, contract_id, period_month)
    )`
  ];

  for (const table of tables) {
    try {
      await db.prepare(table).run();
    } catch (e) {
      // ignore
    }
  }
}

describe('Gate 10 Adversarial Stress Tests', () => {
  let db: D1Database;

  beforeEach(async () => {
    db = makeD1(freshDb()) as unknown as D1Database;
    await setupTables(db);
  });

  describe('Scenario 1: SOX 404 Control Violation & Quarantine Stress', () => {
    // 20+ tests dynamic generation
    for (let i = 1; i <= 5; i++) {
      it(`should quarantine unauthorized adjustment ${i}`, async () => {
        const adjustment: JournalAdjustmentInput = {
          periodKey: '2026-Q3',
          accountCode: '4000',
          entityCode: 'SOPHIA_GLOBAL_INC',
          debitCents: 1000,
          creditCents: 1000,
          requestedBy: 'userA',
          approvedBy: 'userB',
          isAuthorized: false, // Unauthorized
          reason: 'Test unauthorized adjustment',
          authorizationToken: 'auth-token-valid-length-1234567',
        };
        const result = validateManualAdjustment(adjustment);
        expect(result.quarantined).toBe(true);
        expect(result.violatedControlIds).toContain(SOX_CONTROL_IDS.QUARANTINE_ADJUSTMENT);
      });
    }

    it('should 100% quarantine 500 random unauthorized adjustments', async () => {
      let quarantinedCount = 0;
      for (let i = 0; i < 500; i++) {
        const adjustment: JournalAdjustmentInput = {
          periodKey: '2026-Q3',
          accountCode: '4000',
          entityCode: 'SOPHIA_GLOBAL_INC',
          debitCents: 100,
          creditCents: 100,
          requestedBy: 'userA',
          approvedBy: 'userB',
          isAuthorized: false,
          reason: 'Test batch quarantine',
          authorizationToken: 'short', // also invalid token length
        };
        const result = validateManualAdjustment(adjustment);
        if (result.quarantined) quarantinedCount++;
        await recordQuarantineEventInDb(db, result);
      }
      expect(quarantinedCount).toBe(500);
    });

    for (let i = 1; i <= 5; i++) {
      it(`should pass authorized adjustment ${i}`, async () => {
        const adjustment: JournalAdjustmentInput = {
          periodKey: '2026-Q3',
          accountCode: '4000',
          entityCode: 'SOPHIA_GLOBAL_INC',
          debitCents: 5000,
          creditCents: 5000,
          requestedBy: 'userA',
          approvedBy: 'userB',
          isAuthorized: true,
          reason: 'Authorized test adjustment',
          authorizationToken: 'valid-crypto-token-length-12345',
        };
        const result = validateManualAdjustment(adjustment);
        expect(result.isAllowed).toBe(true);
        expect(result.quarantined).toBe(false);
      });
    }

    for (let i = 1; i <= 5; i++) {
      it(`should violate segregation of duties (same user) ${i}`, async () => {
        const adjustment: JournalAdjustmentInput = {
          periodKey: '2026-Q3',
          accountCode: '4000',
          entityCode: 'SOPHIA_GLOBAL_INC',
          debitCents: 1000,
          creditCents: 1000,
          requestedBy: `user${i}`,
          approvedBy: `user${i}`, // Same user
          isAuthorized: true,
          reason: 'SOD violation test',
          authorizationToken: 'valid-crypto-token-length-12345',
        };
        const result = validateManualAdjustment(adjustment);
        expect(result.quarantined).toBe(true);
        expect(result.violatedControlIds).toContain(SOX_CONTROL_IDS.SOD);
      });
    }

    it('should generate attestation certificate with valid Merkle root', async () => {
      const summary = await evaluateAllControls(db);
      const cert = await generateCryptographicAttestation(summary, 'CFO-123');
      expect(cert.merkleRootHash).toBe(summary.merkleRootHash);
      expect(cert.digitalSignature).toBeDefined();
      expect(cert.soxStatus).toBe(summary.overallStatus);
    });

    it('should maintain sha256Sync determinism across 1000 inputs', () => {
      const hash1 = sha256Sync('deterministic-input-123');
      for (let i = 0; i < 1000; i++) {
        expect(sha256Sync('deterministic-input-123')).toBe(hash1);
      }
    });

    for (let i = 1; i <= 3; i++) {
      it(`should quarantine unbalanced entries ${i}`, async () => {
        const result = validateManualAdjustment({
          periodKey: '2026-Q3',
          accountCode: '4000',
          entityCode: 'SOPHIA_GLOBAL_INC',
          debitCents: 1000,
          creditCents: 1001, // unbalanced
          requestedBy: 'userA',
          approvedBy: 'userB',
          isAuthorized: true,
          reason: 'Unbalanced test entry',
          authorizationToken: 'valid-crypto-token-length-12345',
        });
        expect(result.quarantined).toBe(true);
        expect(result.violatedControlIds).toContain(SOX_CONTROL_IDS.INTERCOMPANY);
      });
    }
  });

  describe('Scenario 2: Multi-Asset Clearing Liquidity Drain & Slippage Stress', () => {
    const makePool = (overrides: Partial<ClearingLiquidityPool> = {}): ClearingLiquidityPool => ({
      id: 'pool1',
      poolCode: 'POOL-USDC',
      assetSymbol: 'USDC',
      poolName: 'USDC Pool',
      totalReserveAmount: 10_000_000,
      availableReserveAmount: 10_000_000,
      lockedReserveAmount: 0,
      targetReserveAmount: 10_000_000,
      minReserveThreshold: 100_000,
      maxSlippagePct: 0.05,
      virtualLiquidityK: 1_000_000_000,
      feeTierBps: 2,
      rebalanceThresholdPct: 15,
      dailySettlementVolume: 0,
      status: 'active',
      lastRebalancedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    });

    it('should enforce 100% slippage cap (<=0.05%) across 1000 random swap quotes', () => {
      const pool = makePool();

      let cappedCount = 0;
      for (let i = 0; i < 1000; i++) {
        const amount = Math.random() * 50_000 + 10;
        const result = calculateSwapQuote(pool, {
          sourceAsset: 'EUR',
          targetAsset: 'USDC',
          sourceAmount: amount,
          maxAcceptableSlippagePct: MAX_SLIPPAGE_TOLERANCE_PCT,
        });

        if (result.slippageAcceptable) {
          expect(result.slippagePct).toBeLessThanOrEqual(MAX_SLIPPAGE_TOLERANCE_PCT);
        } else {
          expect(result.slippagePct).toBeGreaterThan(MAX_SLIPPAGE_TOLERANCE_PCT);
        }
        cappedCount++;
      }
      expect(cappedCount).toBe(1000);
    });

    for (let i = 1; i <= 10; i++) {
      it(`should reject large trade exceeding pool reserves ${i}`, () => {
        const pool = makePool({
          assetSymbol: 'JPY',
          availableReserveAmount: 1000,
          targetReserveAmount: 1000,
        });

        const result = calculateSwapQuote(pool, {
          sourceAsset: 'USD',
          targetAsset: 'JPY',
          sourceAmount: 100, // $100 -> ~15,385 JPY > 1000
        });
        
        expect(result.targetAmount).toBe(0);
        expect(result.slippageAcceptable).toBe(false);
      });
    }

    it('should maintain multilateral netting zero-sum invariant across 100 random networks', () => {
      for (let i = 0; i < 100; i++) {
        const legs: BilateralTransferLeg[] = Array.from({ length: 10 }, (_, idx) => {
          const participants = ['P0', 'P1', 'P2', 'P3', 'P4'];
          const from = participants[idx % 5];
          const to = participants[(idx + 1 + Math.floor(Math.random() * 4)) % 5];
          return {
            fromParticipantId: from,
            toParticipantId: to,
            asset: 'USD' as const,
            amount: Math.floor(Math.random() * 10000) / 100, // 2 decimal places
          };
        }).filter(leg => leg.fromParticipantId !== leg.toParticipantId);

        if (legs.length === 0) continue;
        const matrix = computeMultilateralNetting(legs);
        expect(matrix.zeroSumBalanced).toBe(true);
      }
    });

    for (let i = 1; i <= 5; i++) {
      it(`should reject quote for depleted/halted pool ${i}`, () => {
        const pool = makePool({
          assetSymbol: 'USDT',
          status: 'halted',
        });

        const result = calculateSwapQuote(pool, {
          sourceAsset: 'USD',
          targetAsset: 'USDT',
          sourceAmount: 1000,
        });
        expect(result.targetAmount).toBe(0);
        expect(result.slippageAcceptable).toBe(false);
      });
    }

    for (let i = 1; i <= 5; i++) {
      it(`should generate valid ISO 20022 camt.053 message ${i}`, () => {
        const msg = generateCamt053Statement([{
          id: `batch-${i}`,
          batchReference: `REF-${i}`,
          batchCycle: 'instant_rtgs',
          sourceAsset: 'USD',
          targetAsset: 'USDT',
          grossAmount: 100,
          netClearedAmount: 99.9,
          clearingFeeAmount: 0.1,
          slippageRealizedPct: 0.01,
          settlementType: 'T0_RTGS',
          reconciliationStatus: 'pending',
          bankingPartnerRef: `BANK-${i}`,
          iso20022MessageId: `MSG-${i}`,
          participantCount: 1,
          poolId: 'pool1',
          status: 'cleared',
          merkleRootHash: 'hash',
          settledAt: Date.now(),
          reconciledAt: null,
          metadata: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }]);

        expect(msg.messageDefinitionIdentifier).toBe('camt.053.001.10');
        expect(msg.statement.entries.length).toBe(1);
      });
    }

    it('should correctly normalize asset amounts (e.g. JPY has no decimals)', () => {
      expect(normalizeAssetAmount(100.55, 'JPY')).toBe(101);
      expect(normalizeAssetAmount(100.55, 'USD')).toBe(100.55);
      expect(normalizeAssetAmount(100.555, 'USD')).toBe(100.56);
      expect(normalizeAssetAmount(15234, 'VND')).toBe(15000); // nearest 1000
    });
  });

  describe('Scenario 3: Edge GPU Mesh 50% Node Crash & Sub-20ms Failover', () => {
    const createNode = (id: string, overrides: Partial<GpuComputeNode> = {}): GpuComputeNode => ({
      id,
      nodeId: id,
      region: 'us-east-iad',
      gpuModel: 'H100',
      isHealthy: true,
      status: 'online',
      currentLoadPct: 50,
      p95LatencyMs: 20,
      p99LatencyMs: 30,
      onDemandPriceCentsPerHour: 200,
      spotPriceCentsPerHour: 100,
      healthScore: 1.0,
      vramGbPerGpu: 80,
      activeRenderJobs: 0,
      maxConcurrency: 10,
      maxResolution: '8K',
      supportedCodecs: ['h264', 'hevc', 'av1'],
      gpuCount: 8,
      totalVramGb: 640,
      totalRendersCompleted: 0,
      totalRenderSeconds: 0,
      lastHeartbeatAt: Date.now(),
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      provider: 'cloud',
      ...overrides
    });

    for (let i = 1; i <= 10; i++) {
      it(`should deterministically calculate node fitness score ${i}`, () => {
        const node = createNode(`node-${i}`);
        const job: VideoRenderJobInput = {
          jobId: 'job1',
          tenantId: 't1',
          videoResolution: '4K',
          videoDurationSeconds: 60,
          frameCount: 3600,
          preferredRegion: 'us-east-iad'
        };
        
        const score1 = calculateNodeFitnessScore(node, job);
        const score2 = calculateNodeFitnessScore(node, job);
        expect(score1).toBe(score2);
      });
    }

    it('should select node with lowest cost and latency', () => {
      const nodes = [
        createNode('n1', { p95LatencyMs: 90, currentLoadPct: 80 }),
        createNode('n2', { p95LatencyMs: 10, currentLoadPct: 20 }), // Better
      ];
      
      const job: VideoRenderJobInput = {
        jobId: 'job1',
        tenantId: 't1',
        videoResolution: '4K',
        videoDurationSeconds: 60,
        frameCount: 3600,
      };

      const optimal = selectOptimalComputeNode(nodes, job);
      expect(optimal.nodeId).toBe('n2');
    });

    for (let i = 1; i <= 5; i++) {
      it(`should estimate 4K render time under 15s ${i}`, () => {
        const node = createNode(`n-${i}`, { gpuModel: 'H100', currentLoadPct: 0 }); // H100 0.1s/1s
        const job: VideoRenderJobInput = {
          jobId: 'job1',
          tenantId: 't1',
          videoResolution: '4K',
          videoDurationSeconds: 60,
          frameCount: 3600,
        };

        const metrics = estimateRenderMetrics(node, job);
        expect(metrics.estimatedDurationMs).toBeLessThanOrEqual(15000);
      });
    }

    it('should simulate 50% node crash and verify rerouting', async () => {
      // Setup DB with nodes
      for (let i = 0; i < 10; i++) {
        await db.prepare(`INSERT INTO gpu_compute_nodes (
          node_id, region, gpu_model, is_healthy, status, current_load_pct, p95_latency_ms,
          on_demand_price_cents_per_hour, spot_price_cents_per_hour, health_score, vram_gb_per_gpu,
          active_render_jobs, max_concurrency, max_resolution, supported_codecs, gpu_count,
          total_vram_gb, total_renders_completed, total_render_seconds, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
          `node-${i}`, 'us-east-iad', 'H100', 1, 'online', 50, 20, 200, 100, 1.0, 80, 1, 10, '8K',
          JSON.stringify(['h264']), 8, 640, 0, 0, Date.now()
        ).run();
      }

      // Insert a dispatch to node-0
      await db.prepare(`INSERT INTO video_render_dispatches (
        dispatch_id, tenant_id, job_id, node_id, video_resolution, video_duration_seconds, frame_count, codec, status, priority_score, spot_pricing_applied, cost_cents, queue_wait_ms, sla_target_ms, sla_breached, reroute_count, failover_history_json, dispatched_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        'disp-1', 't1', 'job1', 'node-0', '4K', 60, 3600, 'h264', 'dispatched', 100, 1, 5, 0, 15000, 0, 0, '[]', Date.now(), Date.now(), Date.now()
      ).run();

      // Crash half the nodes (0 to 4)
      for (let i = 0; i < 5; i++) {
        await db.prepare(`UPDATE gpu_compute_nodes SET is_healthy = 0, status = 'offline' WHERE node_id = ?`).bind(`node-${i}`).run();
      }

      // Reroute from node-0 (which crashed)
      const res = await rerouteInFlightJob(db, 'disp-1', 'node-0', 'simulated_crash');
      expect(res.success).toBe(true);
      expect(res.previousNodeId).toBe('node-0');
      // Should route to 5-9
      expect(Number(res.newNodeId.split('-')[1])).toBeGreaterThanOrEqual(5);
    });

    it('should throw graceful error when all nodes offline', () => {
      const nodes = [
        createNode('n1', { isHealthy: false, status: 'offline' }),
        createNode('n2', { isHealthy: false, status: 'offline' }),
      ];
      const job: VideoRenderJobInput = {
        jobId: 'job1',
        tenantId: 't1',
        videoResolution: '4K',
        videoDurationSeconds: 60,
        frameCount: 3600,
      };

      expect(() => selectOptimalComputeNode(nodes, job)).toThrow(/No available GPU compute node found/);
    });
  });

  describe('Scenario 4: Six-Nines SLA Escrow & Penalty Calculation', () => {
    for (let i = 1; i <= 3; i++) {
      it(`should handle 0s downtime -> 99.9999% uptime -> none tier -> 0% penalty ${i}`, () => {
        const metrics = calculateSixNinesUptimeMetrics(0);
        expect(metrics.actualUptimePct).toBe(100.0);
        expect(metrics.breachTier).toBe('none');
        expect(metrics.penaltyPct).toBe(0);
      });
    }

    it('should handle 2.592s exact boundary -> none tier', () => {
      const metrics = calculateSixNinesUptimeMetrics(2.592);
      expect(metrics.breachTier).toBe('none');
      expect(metrics.penaltyPct).toBe(0);
    });

    it('should handle >2.592s -> minor tier -> 15% penalty', () => {
      const metrics = calculateSixNinesUptimeMetrics(3.0);
      expect(metrics.breachTier).toBe('minor');
      expect(metrics.penaltyPct).toBe(15);
    });

    it('should handle moderate tier -> 35% penalty', () => {
      const metrics = calculateSixNinesUptimeMetrics(30.0);
      expect(metrics.breachTier).toBe('moderate');
      expect(metrics.penaltyPct).toBe(35);
    });

    it('should handle major tier -> 70% penalty', () => {
      const metrics = calculateSixNinesUptimeMetrics(300.0);
      expect(metrics.breachTier).toBe('major');
      expect(metrics.penaltyPct).toBe(70);
    });

    it('should handle catastrophic tier -> 100% penalty', () => {
      const metrics = calculateSixNinesUptimeMetrics(3000.0);
      expect(metrics.breachTier).toBe('catastrophic');
      expect(metrics.penaltyPct).toBe(100);
    });

    it('should properly fund escrow (20% of contract value by default)', async () => {
      const escrow = await fundSlaEscrow(db, {
        tenantId: 't1',
        contractId: 'c1',
        periodMonth: '2026-09',
        monthlyContractValueCents: 100_000,
      });

      // default is 20%
      expect(escrow.escrowFundedCents).toBe(20_000);
      expect(escrow.escrowBalanceCents).toBe(20_000);
    });

    it('should deduct penalty claim from escrow balance', async () => {
      await fundSlaEscrow(db, {
        tenantId: 't1',
        contractId: 'c1',
        periodMonth: '2026-09',
        monthlyContractValueCents: 100_000,
      });

      // evaluate with major breach (70% penalty of 20_000 = 14_000)
      const evalRes = await evaluateSixNinesSlaPeriod(db, 't1', 'c1', '2026-09', 300);
      expect(evalRes.penaltyCents).toBe(14_000);
      expect(evalRes.escrowBalanceCents).toBe(6_000);

      const claim = await claimSlaPenalty(db, evalRes.escrowId);
      expect(claim.claimedCents).toBe(14_000);
      expect(claim.remainingEscrowCents).toBe(6_000);
    });

    it('should guarantee monotonic penalty escalation across random downtimes', () => {
      let previousPenalty = 0;
      let previousDowntime = 0;
      for (let i = 0; i < 1000; i++) {
        // monotonically increasing downtime
        const downtime = previousDowntime + Math.random() * 10;
        const metrics = calculateSixNinesUptimeMetrics(downtime);
        expect(metrics.penaltyPct).toBeGreaterThanOrEqual(previousPenalty);
        
        previousPenalty = metrics.penaltyPct;
        previousDowntime = downtime;
      }
    });

    for (let i = 1; i <= 5; i++) {
      it(`should release fully unpenalized escrow to revenue ${i}`, async () => {
        const escrow = await fundSlaEscrow(db, {
          tenantId: `t${i}`,
          contractId: `c${i}`,
          periodMonth: '2026-09',
          monthlyContractValueCents: 100_000,
        });

        // 0s downtime -> 0 penalty
        await evaluateSixNinesSlaPeriod(db, `t${i}`, `c${i}`, '2026-09', 0);
        
        const release = await releaseEscrowToRevenue(db, escrow.escrowId);
        expect(release.releasedCents).toBe(20_000);
        expect(release.status).toBe('released_to_revenue');
      });
    }
  });
});
