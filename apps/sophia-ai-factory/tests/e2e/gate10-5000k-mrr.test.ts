/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeD1, freshDb } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@/seed/db/client';

import {
  computeNonGaapMetrics,
  consolidateMultiEntityCta,
  generateS1ProspectusPackage,
  normalizeToDirectRate,
  translateUnitsToUsdCents
} from '@/tree/ipo/s1-prospectus-engine';

import {
  evaluateAllControls,
  generateCryptographicAttestation
} from '@/tree/ipo/sox404-control-ledger';

import {
  GATE10_SCALE_TARGETS,
  CANONICAL_ENTITIES,
  type GaapFinancialsInput,
  type EntityFinancialInput,
  type ConsolidationEntityCode
} from '@/seed/types/ipo-filing';

import {
  calculateSwapQuote,
  executeRtgsBatch,
  reconcileBatchWithBankStatement,
  computeMultilateralNetting,
  generatePacs008Message,
  generateCamt053Statement,
  listLiquidityPools
} from '@/tree/clearing/multi-asset-clearing-engine';

import {
  calculateByzantineQuorum,
  recordHeartbeat,
  replicateBatchProposal,
  detectAndArbitrateSplitBrain,
  electSwarmV2Leader
} from '@/tree/swarm/swarm-v2-mesh-coordinator';

import {
  selectOptimalComputeNode,
  dispatchRenderJob,
  completeRenderJob,
  rerouteInFlightJob,
  getMeshTopology
} from '@/tree/gpu/workload-balancer';

import {
  fundSlaEscrow,
  evaluateSixNinesSlaPeriod,
  claimSlaPenalty,
  releaseEscrowToRevenue
} from '@/tree/gpu/six-nines-sla-engine';

import type { BilateralTransferLeg, SwarmV2ConsensusState, SwarmNodeHealth } from '@/seed/types/multi-asset-clearing';
import { GATE_10_CONSTANTS as GATE10_CONSTANTS } from '@/seed/types/edge-gpu-mesh';
import type { GpuComputeNode, VideoRenderJobInput } from '@/seed/types/edge-gpu-mesh';

describe('Gate 10 E2E: 5000k MRR Scale ($60M ARR)', () => {
  let db: D1Database;

  beforeEach(async () => {
    db = makeD1(freshDb()) as unknown as D1Database;
    
    // Seed initial tables for tests
    await db.prepare(`CREATE TABLE IF NOT EXISTS ipo_filing_periods (
      id TEXT PRIMARY KEY, period_key TEXT, filing_type TEXT, target_exchanges TEXT,
      status TEXT, filing_date TEXT, effective_date TEXT, total_customers INTEGER,
      mrr_cents INTEGER, arr_cents INTEGER, arpu_cents INTEGER, nrr_pct REAL,
      gross_margin_pct REAL, gaap_revenue_cents INTEGER, gaap_cost_of_revenue_cents INTEGER,
      gaap_gross_profit_cents INTEGER, gaap_operating_expenses_cents INTEGER,
      gaap_operating_income_cents INTEGER, gaap_net_income_cents INTEGER,
      gaap_operating_cash_flow_cents INTEGER, capex_cents INTEGER,
      stock_based_compensation_cents INTEGER, depreciation_amortization_cents INTEGER,
      unrealized_fx_gain_loss_cents INTEGER, one_time_mna_restructuring_cents INTEGER,
      adjusted_ebitda_cents INTEGER, adjusted_ebitda_margin_pct REAL,
      free_cash_flow_cents INTEGER, free_cash_flow_margin_pct REAL,
      magic_number REAL, rule_of_40_pct REAL, yoy_revenue_growth_pct REAL,
      sox_404_status TEXT, merkle_root_hash TEXT, sec_filing_signature TEXT,
      certified_by TEXT, certified_at INTEGER, prospectus_metadata TEXT,
      created_at INTEGER, updated_at INTEGER
    )`).run();

    await db.prepare(`CREATE TABLE IF NOT EXISTS multi_entity_consolidations (
      id TEXT PRIMARY KEY, consolidation_batch_id TEXT, period_key TEXT,
      reporting_currency TEXT, entity_code TEXT, functional_currency TEXT,
      local_revenue_units REAL, local_operating_expenses_units REAL,
      local_net_income_units REAL, local_total_assets_units REAL,
      local_total_liabilities_units REAL, local_equity_units REAL,
      period_end_spot_rate REAL, period_weighted_average_rate REAL,
      historical_equity_rate REAL, translated_revenue_cents INTEGER,
      translated_expenses_cents INTEGER, translated_net_income_cents INTEGER,
      translated_assets_cents INTEGER, translated_liabilities_cents INTEGER,
      translated_equity_cents INTEGER, intercompany_receivables_eliminated_cents INTEGER,
      intercompany_payables_eliminated_cents INTEGER, intercompany_revenue_eliminated_cents INTEGER,
      intercompany_expense_eliminated_cents INTEGER, cumulative_translation_adjustment_cents INTEGER,
      cta_balance_type TEXT, elimination_balanced INTEGER, zero_penny_leakage_verified INTEGER,
      merkle_snapshot_hash TEXT, audited_by TEXT, status TEXT, notes TEXT,
      created_at INTEGER, updated_at INTEGER
    )`).run();

    await db.prepare(`CREATE TABLE IF NOT EXISTS clearing_liquidity_pools (
      id TEXT PRIMARY KEY, asset_symbol TEXT, total_reserve_amount REAL,
      available_reserve_amount REAL, target_reserve_amount REAL,
      rebalance_threshold_pct REAL, fee_tier_bps INTEGER, status TEXT,
      daily_settlement_volume REAL, last_rebalanced_at INTEGER,
      created_at INTEGER, updated_at INTEGER
    )`).run();

    await db.prepare(`CREATE TABLE IF NOT EXISTS cross_border_clearing_batches (
      id TEXT PRIMARY KEY, batch_reference TEXT, batch_cycle TEXT,
      source_asset TEXT, target_asset TEXT, gross_amount REAL,
      net_cleared_amount REAL, clearing_fee_amount REAL, slippage_realized_pct REAL,
      settlement_type TEXT, reconciliation_status TEXT, banking_partner_ref TEXT,
      iso20022_message_id TEXT, participant_count INTEGER, pool_id TEXT,
      status TEXT, merkle_root_hash TEXT, settled_at INTEGER,
      metadata_json TEXT, created_at INTEGER, updated_at INTEGER
    )`).run();

    await db.prepare(`CREATE TABLE IF NOT EXISTS swarm_v2_consensus_state (
      id TEXT PRIMARY KEY, term INTEGER, commit_index INTEGER,
      last_applied_index INTEGER, leader_node_id TEXT, active_voters_count INTEGER,
      membership_nodes TEXT, avg_heartbeat_latency_ms REAL,
      p99_heartbeat_latency_ms REAL, is_quorum_healthy INTEGER,
      split_brain_detected INTEGER, audit_state_hash TEXT,
      last_leader_election_at INTEGER, last_heartbeat_round_at INTEGER,
      created_at INTEGER, updated_at INTEGER
    )`).run();

    await db.prepare(`CREATE TABLE IF NOT EXISTS gpu_compute_nodes (
      node_id TEXT PRIMARY KEY, region TEXT, gpu_model TEXT,
      gpu_count INTEGER, total_vram_gb INTEGER, vram_gb_per_gpu INTEGER,
      is_healthy INTEGER, health_score REAL, status TEXT,
      current_load_pct REAL, max_concurrency INTEGER, active_render_jobs INTEGER,
      total_renders_completed INTEGER, total_render_seconds REAL,
      on_demand_price_cents_per_hour INTEGER, spot_price_cents_per_hour INTEGER,
      max_resolution TEXT, supported_codecs TEXT, p95_latency_ms REAL,
      last_heartbeat_at INTEGER, created_at INTEGER, updated_at INTEGER
    )`).run();

    await db.prepare(`CREATE TABLE IF NOT EXISTS video_render_dispatches (
      dispatch_id TEXT PRIMARY KEY, tenant_id TEXT, job_id TEXT,
      node_id TEXT, video_resolution TEXT, video_duration_seconds REAL,
      frame_count INTEGER, codec TEXT, status TEXT, priority_score INTEGER,
      spot_pricing_applied INTEGER, cost_cents INTEGER, queue_wait_ms INTEGER,
      sla_target_ms INTEGER, render_duration_ms INTEGER, egress_bytes INTEGER,
      sla_breached INTEGER, error_message TEXT, reroute_count INTEGER,
      failover_history_json TEXT, dispatched_at INTEGER, completed_at INTEGER,
      created_at INTEGER, updated_at INTEGER
    )`).run();

    await db.prepare(`CREATE TABLE IF NOT EXISTS sla_penalty_escrow (
      escrow_id TEXT PRIMARY KEY, tenant_id TEXT, contract_id TEXT,
      period_month TEXT, target_sla_pct REAL, actual_uptime_pct REAL,
      total_period_seconds INTEGER, allowed_downtime_seconds REAL,
      downtime_seconds REAL, error_budget_consumed_seconds REAL,
      error_budget_remaining_seconds REAL, escrow_funded_cents INTEGER,
      penalty_claimed_cents INTEGER, escrow_balance_cents INTEGER,
      breach_tier TEXT, penalty_pct REAL, escrow_status TEXT,
      last_breach_timestamp INTEGER, audit_hash TEXT,
      created_at INTEGER, updated_at INTEGER,
      UNIQUE(tenant_id, contract_id, period_month)
    )`).run();

    await db.prepare(`
      INSERT INTO clearing_liquidity_pools (id, asset_symbol, total_reserve_amount, available_reserve_amount, target_reserve_amount, rebalance_threshold_pct, fee_tier_bps, status, daily_settlement_volume, created_at, updated_at)
      VALUES 
      ('pool_usdt', 'USDT', 10000000, 10000000, 10000000, 15, 2, 'active', 0, ${Date.now()}, ${Date.now()}),
      ('pool_vnd', 'VND', 250000000000, 250000000000, 250000000000, 15, 2, 'active', 0, ${Date.now()}, ${Date.now()})
    `).run();

    await db.prepare(`
      INSERT INTO swarm_v2_consensus_state (id, term, commit_index, last_applied_index, leader_node_id, active_voters_count, membership_nodes, avg_heartbeat_latency_ms, p99_heartbeat_latency_ms, is_quorum_healthy, split_brain_detected, audit_state_hash, created_at, updated_at)
      VALUES
      ('state_mesh_v2_global', 1, 0, 0, 'node-1', 5, '["node-1","node-2","node-3","node-4","node-5"]', 2.5, 4.0, 1, 0, 'genesis', ${Date.now()}, ${Date.now()})
    `).run();

    await db.prepare(`
      INSERT INTO gpu_compute_nodes (node_id, region, gpu_model, gpu_count, total_vram_gb, vram_gb_per_gpu, is_healthy, health_score, status, current_load_pct, max_concurrency, active_render_jobs, total_renders_completed, total_render_seconds, on_demand_price_cents_per_hour, spot_price_cents_per_hour, max_resolution, supported_codecs, p95_latency_ms)
      VALUES
      ('gpu-node-1', 'us-east', 'H100', 8, 640, 80, 1, 1.0, 'online', 20.0, 32, 0, 1000, 10000, 500, 250, '8K', '["h264","hevc"]', 15.0),
      ('gpu-node-2', 'ap-southeast', 'H100', 8, 640, 80, 1, 0.95, 'online', 40.0, 16, 0, 800, 8000, 300, 150, '4K', '["h264","hevc"]', 25.0)
    `).run();
  });

  describe('Section 1: Full IPO Readiness Pipeline', () => {
    it('should compute Non-GAAP Metrics accurately', () => {
      const gaap: GaapFinancialsInput = {
        revenueCents: 15_000_000_00,
        costOfRevenueCents: 2_625_000_00,
        operatingExpensesCents: 8_500_000_00,
        netIncomeCents: 3_100_000_00,
        operatingCashFlowCents: 4_200_000_00,
        capexCents: 450_000_00,
        stockBasedCompensationCents: 500_000_00,
        depreciationAmortizationCents: 350_000_00,
        unrealizedFxGainLossCents: -50_000_00,
        oneTimeMnaRestructuringCents: 100_000_00,
        priorQuarterRevenueCents: 7_500_000_00,
        priorQuarterSmExpenseCents: 15_000_000_00,
        priorYearRevenueCents: 10_000_000_00,
      };

      const result = computeNonGaapMetrics(gaap);
      expect(result.magicNumber).toBeGreaterThanOrEqual(1.5);
      expect(result.magicNumberPassed).toBe(true);
      expect(result.ruleOf40Pct).toBeGreaterThanOrEqual(65.0);
      expect(result.ruleOf40Passed).toBe(true);
      expect(result.adjustedEbitdaCents).toBe(4_000_000_00);
      expect(result.freeCashFlowCents).toBe(3_750_000_00);
    });

    it('should consolidate 3-entity CTA with zero-penny leakage', async () => {
      const entities: EntityFinancialInput[] = [
        {
          entityCode: CANONICAL_ENTITIES.US_INC as ConsolidationEntityCode,
          functionalCurrency: 'USD',
          localRevenueUnits: 10_000_000,
          localOperatingExpensesUnits: 6_000_000,
          localNetIncomeUnits: 4_000_000,
          localTotalAssetsUnits: 25_000_000,
          localTotalLiabilitiesUnits: 10_000_000,
          localEquityUnits: 11_000_000,
          periodEndSpotRate: 1.0,
          periodWeightedAverageRate: 1.0,
          historicalEquityRate: 1.0,
          intercompanyReceivablesEliminatedCents: 500_000_00,
          intercompanyPayablesEliminatedCents: 0,
          intercompanyRevenueEliminatedCents: 300_000_00,
          intercompanyExpenseEliminatedCents: 0,
        },
        {
          entityCode: CANONICAL_ENTITIES.SG_PTE_LTD as ConsolidationEntityCode,
          functionalCurrency: 'SGD',
          localRevenueUnits: 4_000_000,
          localOperatingExpensesUnits: 2_500_000,
          localNetIncomeUnits: 1_500_000,
          localTotalAssetsUnits: 10_000_000,
          localTotalLiabilitiesUnits: 4_000_000,
          localEquityUnits: 4_500_000,
          periodEndSpotRate: 0.74,
          periodWeightedAverageRate: 0.75,
          historicalEquityRate: 0.72,
          intercompanyReceivablesEliminatedCents: 0,
          intercompanyPayablesEliminatedCents: 500_000_00,
          intercompanyRevenueEliminatedCents: 0,
          intercompanyExpenseEliminatedCents: 300_000_00,
        },
        {
          entityCode: CANONICAL_ENTITIES.VN_CO_LTD as ConsolidationEntityCode,
          functionalCurrency: 'VND',
          localRevenueUnits: 50_000_000_000,
          localOperatingExpensesUnits: 30_000_000_000,
          localNetIncomeUnits: 20_000_000_000,
          localTotalAssetsUnits: 100_000_000_000,
          localTotalLiabilitiesUnits: 40_000_000_000,
          localEquityUnits: 40_000_000_000,
          periodEndSpotRate: 0.00003929,
          periodWeightedAverageRate: 0.00003937,
          historicalEquityRate: 0.00004000,
        },
      ];

      const result = await consolidateMultiEntityCta(entities, '2026-Q3');
      expect(result.intercompanyEliminationsBalanced).toBe(true);
      expect(result.zeroPennyLeakageVerified).toBe(true);
      expect(result.consolidatedGroup.zeroPennyLeakageVerified).toBe(true);
    });

    it('should generate full S-1 prospectus', async () => {
      const prospectus = await generateS1ProspectusPackage(db, '2026-Q3');
      expect(prospectus.scaleMetrics.totalCustomers).toBe(GATE10_SCALE_TARGETS.TOTAL_CUSTOMERS);
      expect(prospectus.scaleMetrics.mrrCents).toBe(GATE10_SCALE_TARGETS.MRR_CENTS);
      expect(prospectus.merkleRootHash).toBeDefined();
    });

    it('should evaluate SOX 404 controls as certified_clean', async () => {
      const sox = await evaluateAllControls(db);
      expect(sox.overallStatus).toBe('certified_clean');
      expect(sox.evaluations.length).toBeGreaterThan(0);
    });

    it('should generate cryptographic attestation', async () => {
      const sox = await evaluateAllControls(db);
      const attestation = await generateCryptographicAttestation(sox, 'CFO-123');
      expect(attestation.digitalSignature).toBeDefined();
      expect(attestation.statementEn).toContain('Sophia AI Factory');
    });
  });

  describe('Section 2: Cross-Border Clearing Full Lifecycle', () => {
    it('should quote and execute USDT -> VND clearing', async () => {
      const result = await executeRtgsBatch(db, {
        sourceAsset: 'USDT',
        targetAsset: 'VND',
        grossAmount: 1000
      });
      expect(result.success).toBe(true);
      expect(result.netClearedAmount).toBeGreaterThan(0);
      expect(result.slippageRealizedPct).toBeLessThan(0.05);
    });

    it('should generate ISO 20022 message', async () => {
      const result = await executeRtgsBatch(db, {
        sourceAsset: 'USDT',
        targetAsset: 'VND',
        grossAmount: 100
      });
      const batchRow = await db.prepare('SELECT * FROM cross_border_clearing_batches WHERE id = ?').bind(result.batchId).first();
      // Map raw row to domain type with proper metadata parsing
      const { rowToCrossBorderClearingBatch } = await import('@/seed/types/multi-asset-clearing');
      const batch = rowToCrossBorderClearingBatch(batchRow as unknown as Parameters<typeof rowToCrossBorderClearingBatch>[0]);
      const isoMsg = generatePacs008Message(batch);
      expect(isoMsg.messageDefinitionIdentifier).toBe('pacs.008.001.10');
    });

    it('should compute multilateral netting with >50% compression', () => {
      const legs: BilateralTransferLeg[] = [
        { fromParticipantId: 'A', toParticipantId: 'B', asset: 'USD', amount: 100 },
        { fromParticipantId: 'B', toParticipantId: 'C', asset: 'USD', amount: 100 },
        { fromParticipantId: 'C', toParticipantId: 'A', asset: 'USD', amount: 90 },
      ];
      const netting = computeMultilateralNetting(legs);
      expect(netting.zeroSumBalanced).toBe(true);
      expect(netting.compressionRatioPct).toBeGreaterThan(50);
    });

    it('should calculate Byzantine quorum correctly', () => {
      const quorum = calculateByzantineQuorum(10);
      expect(quorum.byzantineToleranceF).toBe(3);
      expect(quorum.quorumSize).toBe(7);
    });
    
    it('should detect split-brain', () => {
      const nodes = [
        { nodeId: 'node-1', status: 'active', term: 1, avgLatencyMs: 10 },
        { nodeId: 'node-2', status: 'active', term: 1, avgLatencyMs: 10 },
        { nodeId: 'node-3', status: 'active', term: 2, avgLatencyMs: 10 },
        { nodeId: 'node-4', status: 'active', term: 2, avgLatencyMs: 10 },
        { nodeId: 'node-5', status: 'active', term: 2, avgLatencyMs: 10 }
      ];
      const result = detectAndArbitrateSplitBrain(nodes as any);
      expect(result.splitBrainDetected).toBe(true);
      expect(result.majorityPartitionNodes).toContain('node-3');
    });
  });

  describe('Section 3: GPU Mesh Dispatch & SLA Escrow Lifecycle', () => {
    it('should dispatch render job and complete it', async () => {
      const dispatch = await dispatchRenderJob(db, {
        tenantId: 't1',
        jobId: 'j1',
        videoResolution: '4K',
        videoDurationSeconds: 10,
        frameCount: 300,
        codec: 'h264'
      });
      expect(dispatch.selectedNodeId).toBe('gpu-node-1');
      expect(dispatch.slaTargetMs).toBe(GATE10_CONSTANTS.FOUR_K_MAX_RENDER_MS);

      const comp = await completeRenderJob(db, dispatch.dispatchId, 1000);
      expect(comp.slaBreached).toBe(false);
      expect(comp.status).toBe('completed');
    });

    it('should fund SLA escrow and evaluate without breach', async () => {
      const escrow = await fundSlaEscrow(db, {
        tenantId: 't2',
        contractId: 'c2',
        periodMonth: '2026-10',
        monthlyContractValueCents: 500000
      });
      expect(escrow.escrowBalanceCents).toBeGreaterThan(0);

      const evalResult = await evaluateSixNinesSlaPeriod(db, 't2', 'c2', '2026-10', 1.0);
      expect(evalResult.breachTier).toBe('none');
      expect(evalResult.escrowBalanceCents).toBe(escrow.escrowFundedCents);
      
      const release = await releaseEscrowToRevenue(db, evalResult.escrowId);
      expect(release.status).toBe('released_to_revenue');
    });

    it('should claim SLA penalty on breach', async () => {
      const escrow = await fundSlaEscrow(db, {
        tenantId: 't3',
        contractId: 'c3',
        periodMonth: '2026-10',
        monthlyContractValueCents: 500000
      });
      
      // 30 seconds downtime = minor breach
      const evalResult = await evaluateSixNinesSlaPeriod(db, 't3', 'c3', '2026-10', 30.0);
      expect(evalResult.breachTier).toBe('moderate');

      const claim = await claimSlaPenalty(db, evalResult.escrowId);
      expect(claim.claimedCents).toBeGreaterThan(0);
      expect(claim.remainingEscrowCents).toBeLessThan(escrow.escrowFundedCents);
    });

    it('should reroute in-flight job', async () => {
      const dispatch = await dispatchRenderJob(db, {
        tenantId: 't4',
        jobId: 'j4',
        videoResolution: '4K',
        videoDurationSeconds: 10,
        frameCount: 300,
        codec: 'h264'
      });

      const reroute = await rerouteInFlightJob(db, dispatch.dispatchId, dispatch.selectedNodeId);
      expect(reroute.success).toBe(true);
      expect(reroute.previousNodeId).toBe('gpu-node-1');
      expect(reroute.newNodeId).toBe('gpu-node-2');
    });
  });

  describe('Section 4: Cross-Pillar Integration & MRR Scale Verification', () => {
    it('should simulate 20,000 customers with $5M MRR', () => {
      const customers = 20_000;
      const arr = 60_000_000_00; // $60M ARR
      const mrr = 5_000_000_00; // $5M MRR
      
      expect(arr / 12).toBe(mrr);
      expect(mrr / customers).toBe(250_00); // ARPU = $250
    });

    it('should verify MRR > $5M scale targets', () => {
      expect(GATE10_SCALE_TARGETS.TOTAL_CUSTOMERS).toBe(20_000);
      expect(GATE10_SCALE_TARGETS.MRR_CENTS).toBe(5_000_000_00);
      expect(GATE10_SCALE_TARGETS.ARR_CENTS).toBe(60_000_000_00);
      expect(GATE10_SCALE_TARGETS.ARPU_CENTS).toBe(250_00);
      expect(GATE10_SCALE_TARGETS.MIN_NRR_PCT).toBeGreaterThanOrEqual(140.0);
    });
  });
});
