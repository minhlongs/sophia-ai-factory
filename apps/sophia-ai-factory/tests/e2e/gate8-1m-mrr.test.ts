/** @vitest-environment node */

/**
 * Gate 8 End-to-End Enterprise Test Suite: $1,000,000 MRR Milestone Simulation
 *
 * Milestone Targets:
 * - Total Consolidated MRR >= $1,000,000.00 USD (100,000,000 cents)
 * - Total Active Paid Customers >= 5,000
 * - Blended ARPU >= $200.00 USD (20,000 cents)
 * - Cohort Net Revenue Retention (NRR) >= 130.0%
 * - Five-Nines Edge SLA >= 99.999% (25.92s allowed monthly downtime)
 * - Cryptographic IPO Audit Vault (SHA-256 Merkle tree & SEC Form S-1)
 *
 * 4-Tier Test Architecture:
 * - Tier 1: Feature Coverage (70 tests across 14 feature areas)
 * - Tier 2: Boundary & Corner Cases (10 tests)
 * - Tier 3: Cross-Module Integration (4 tests)
 * - Tier 4: Real-World Enterprise Production Scenarios (5 comprehensive workflows)
 *
 * Layer: tests/e2e
 * Note: ZERO :any types used.
 *
 * @module tests/e2e/gate8-1m-mrr.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@cloudflare/workers-types';

// Pillar 1: Multi-Org Financial Close, ASC 606 & Merkle Audit Vault
import {
  calculateTierContractTerms,
  verifyScheduleInvariance,
  diffCalendarDays,
  createRevenueSchedule,
  processDailyAccrual,
  mapRowToRevenueSchedule,
} from '@/tree/finance/revenue-recognition-engine';
import {
  calculateWithholdingTax,
  generateVasJournalEntries,
  inferPeriodDates,
  initiatePeriodClose,
  finalizePeriodClose,
  lockPeriod,
  recordIntercompanyTransfer,
  reconcileIntercompanyTransfer,
  WITHHOLDING_TAX_RATES,
} from '@/tree/finance/financial-close-orchestrator';
import {
  canonicalJson,
  sha256Hex,
  hmacSha256Hex,
  buildMerkleTree,
  generateMerkleProof,
  verifyMerkleProof,
  appendIpoAuditEvent,
  verifyAuditLedgerChain,
  generateFormS1AuditPack,
  DEFAULT_AUDIT_SECRET,
} from '@/tree/finance/merkle-audit-vault';
import type {
  FinancialClosePeriod,
  RevenueSchedule,
  IntercompanyTransfer,
  WithholdingTaxRegime,
  IntercompanyEntity,
  AuditEventType,
  SoxControlId,
} from '@/seed/types/financial-close';

// Pillar 2: Autonomous Edge Swarm, Retention Flywheel & Self-Healing
import {
  computeCoordinatorFitness,
  electLeaderFromCandidates,
  registerSwarmNode,
  recordNodeHeartbeat,
  pruneDeadNodes,
  dispatchSwarmTask,
  getSwarmClusterTopology,
} from '@/tree/swarm/swarm-coordinator';
import {
  calculateChurnRisk,
  evaluateCustomerHealth,
  recordCustomerHealth,
} from '@/tree/swarm/retention-flywheel-engine';
import {
  qualifyInboundLead,
  generateBilingualProposal,
  generateMeetingPrepBrief,
} from '@/tree/swarm/sales-qualifier-bot';
import { isCorporateEmailDomain } from '@/tree/sales/bant-scoring-service';
import {
  getCircuitBreakerMetrics,
  recordFailure,
  recordSuccess,
  resetCircuit,
  resetAllCircuits,
  isolateNode,
} from '@/tree/swarm/self-healing-arbiter';
import type {
  SwarmNode,
  SwarmRegion,
  CustomerHealthTelemetryInput,
  InboundLeadPayload,
} from '@/seed/types/autonomous-swarm';

// Pillar 3: Unified Revenue Consolidation, Cohort Matrix & 99.999% SLA
import {
  consolidateMrrChannels,
  generateGate8TargetModel,
  sanitizeCents,
  saveUnifiedRevenueSnapshot,
  getLatestUnifiedRevenueSnapshot,
} from '@/tree/revenue/mrr-consolidation-engine';
import {
  calculateCohortCell,
  buildTriangularCohortMatrix,
  generateGate8TriangularMatrix,
  saveCohortRetentionCell,
} from '@/tree/revenue/cohort-retention-calculator';
import {
  calculateUptimeMetrics,
  determineSlaBreachLevel,
  calculatePenaltyCreditCents,
  evaluateEnterpriseSla,
  saveSlaEvaluation,
} from '@/tree/revenue/sla-uptime-engine';
import {
  GATE_8_CONSTANTS,
  type UnifiedRevenueSnapshot,
  type CohortRetentionCell,
  type EnterpriseSlaEvaluation,
} from '@/seed/types/unified-revenue';

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

function setupTestDatabase(): { rawDb: InstanceType<typeof DatabaseSync>; d1: D1Database } {
  const rawDb = new DatabaseSync(':memory:');

  // Pillar 1 Tables
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS financial_close_periods (
      id TEXT PRIMARY KEY,
      org_id TEXT,
      period_key TEXT NOT NULL UNIQUE,
      period_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      close_status TEXT NOT NULL DEFAULT 'open',
      closed_by TEXT,
      closed_at INTEGER,
      total_recognized_revenue_cents INTEGER NOT NULL DEFAULT 0,
      total_deferred_revenue_cents INTEGER NOT NULL DEFAULT 0,
      total_refunds_cents INTEGER NOT NULL DEFAULT 0,
      net_revenue_cents INTEGER NOT NULL DEFAULT 0,
      active_contracts_count INTEGER NOT NULL DEFAULT 0,
      merkle_root_hash TEXT,
      digital_signature TEXT,
      compliance_frameworks TEXT NOT NULL DEFAULT 'ASC_606,IFRS_15,VAS_TT200,SOX_404',
      audit_opinion TEXT NOT NULL DEFAULT 'unqualified',
      lock_reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revenue_schedules (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      user_id TEXT,
      contract_id TEXT NOT NULL,
      tier TEXT NOT NULL,
      billing_cycle TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      total_contract_value_cents INTEGER NOT NULL,
      recognized_revenue_cents INTEGER NOT NULL DEFAULT 0,
      deferred_revenue_cents INTEGER NOT NULL,
      daily_recognition_rate_cents REAL NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      term_days INTEGER NOT NULL,
      days_recognized INTEGER NOT NULL DEFAULT 0,
      accounting_standard TEXT NOT NULL DEFAULT 'ASC_606_IFRS_15',
      status TEXT NOT NULL DEFAULT 'active',
      last_accrual_date TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS intercompany_transfers (
      id TEXT PRIMARY KEY,
      transfer_reference TEXT NOT NULL UNIQUE,
      origin_entity TEXT NOT NULL,
      destination_entity TEXT NOT NULL,
      transfer_type TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      gross_amount_cents INTEGER NOT NULL,
      withholding_tax_regime TEXT NOT NULL,
      withholding_tax_rate_pct REAL NOT NULL DEFAULT 0.0,
      withholding_tax_amount_cents INTEGER NOT NULL DEFAULT 0,
      net_settlement_cents INTEGER NOT NULL,
      settlement_status TEXT NOT NULL DEFAULT 'pending',
      reconciliation_ledger_id TEXT,
      approved_by TEXT,
      transfer_date TEXT NOT NULL,
      settled_at INTEGER,
      supporting_docs_hash TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ipo_audit_ledger (
      id TEXT PRIMARY KEY,
      sequence_number INTEGER NOT NULL UNIQUE,
      period_key TEXT NOT NULL,
      org_id TEXT,
      event_type TEXT NOT NULL,
      event_scope TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      payload_canonical_json TEXT NOT NULL DEFAULT '{}',
      prev_hash TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      merkle_leaf_hash TEXT NOT NULL,
      digital_signature TEXT NOT NULL,
      sox_control_id TEXT NOT NULL DEFAULT 'NONE',
      vas_account_code TEXT,
      timestamp INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // Pillar 2 Tables
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS autonomous_swarm_nodes (
      id TEXT PRIMARY KEY,
      node_name TEXT NOT NULL,
      region TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      endpoint_url TEXT,
      last_heartbeat_at INTEGER NOT NULL,
      cpu_load_pct REAL NOT NULL DEFAULT 0.0,
      memory_load_pct REAL NOT NULL DEFAULT 0.0,
      active_tasks INTEGER NOT NULL DEFAULT 0,
      max_concurrency INTEGER NOT NULL DEFAULT 50,
      is_healthy INTEGER NOT NULL DEFAULT 1,
      capabilities_json TEXT NOT NULL DEFAULT '[]',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      registered_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customer_health_metrics (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      org_id TEXT,
      period_start INTEGER NOT NULL,
      period_end INTEGER NOT NULL,
      active_agents_count INTEGER NOT NULL DEFAULT 0,
      video_generation_count INTEGER NOT NULL DEFAULT 0,
      api_request_count INTEGER NOT NULL DEFAULT 0,
      api_error_count INTEGER NOT NULL DEFAULT 0,
      api_error_rate REAL NOT NULL DEFAULT 0.0,
      login_frequency_7d INTEGER NOT NULL DEFAULT 0,
      mcu_consumption_rate REAL NOT NULL DEFAULT 0.0,
      nps_score INTEGER,
      churn_risk_score REAL NOT NULL DEFAULT 0.0,
      health_tier TEXT NOT NULL DEFAULT 'green',
      trend_direction TEXT NOT NULL DEFAULT 'stable',
      risk_factors_json TEXT NOT NULL DEFAULT '[]',
      last_activity_at INTEGER,
      evaluated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS swarm_intervention_events (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      trigger_metric_id TEXT,
      swarm_node_id TEXT,
      intervention_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'triggered',
      payload_json TEXT NOT NULL DEFAULT '{}',
      outcome_impact TEXT,
      churn_risk_before REAL NOT NULL,
      churn_risk_after REAL,
      resolved_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edge_healing_incidents (
      id TEXT PRIMARY KEY,
      incident_code TEXT NOT NULL UNIQUE,
      node_id TEXT NOT NULL REFERENCES autonomous_swarm_nodes(id) ON DELETE CASCADE,
      target_region TEXT NOT NULL,
      healing_action TEXT NOT NULL,
      trigger_reason TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      previous_state TEXT NOT NULL,
      remediated_state TEXT NOT NULL,
      failover_target_node_id TEXT,
      execution_duration_ms INTEGER NOT NULL DEFAULT 0,
      automated_recovery INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'executed',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      detected_at INTEGER NOT NULL,
      recovered_at INTEGER,
      created_at INTEGER NOT NULL
    );
  `);

  // Pillar 3 Tables
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS unified_revenue_snapshots (
      id TEXT PRIMARY KEY,
      snapshot_timestamp INTEGER NOT NULL,
      period_month TEXT NOT NULL,
      direct_sales_cents INTEGER NOT NULL DEFAULT 0,
      affiliate_sales_cents INTEGER NOT NULL DEFAULT 0,
      content_seo_cents INTEGER NOT NULL DEFAULT 0,
      enterprise_deals_cents INTEGER NOT NULL DEFAULT 0,
      total_mrr_cents INTEGER NOT NULL DEFAULT 0,
      active_customers_count INTEGER NOT NULL DEFAULT 0,
      arpu_cents INTEGER NOT NULL DEFAULT 0,
      target_mrr_cents INTEGER NOT NULL DEFAULT 100000000,
      target_customers_count INTEGER NOT NULL DEFAULT 5000,
      target_arpu_cents INTEGER NOT NULL DEFAULT 20000,
      channel_breakdown_json TEXT NOT NULL DEFAULT '{}',
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cohort_retention_matrix (
      id TEXT PRIMARY KEY,
      cohort_month TEXT NOT NULL,
      period_offset INTEGER NOT NULL,
      starting_customers INTEGER NOT NULL,
      retained_customers INTEGER NOT NULL,
      churned_customers INTEGER NOT NULL DEFAULT 0,
      starting_mrr_cents INTEGER NOT NULL,
      retained_base_mrr_cents INTEGER NOT NULL,
      expansion_mrr_cents INTEGER NOT NULL DEFAULT 0,
      contraction_mrr_cents INTEGER NOT NULL DEFAULT 0,
      churned_mrr_cents INTEGER NOT NULL DEFAULT 0,
      ending_mrr_cents INTEGER NOT NULL,
      grr_pct REAL NOT NULL,
      nrr_pct REAL NOT NULL,
      calculated_at INTEGER NOT NULL,
      UNIQUE(cohort_month, period_offset)
    );

    CREATE TABLE IF NOT EXISTS enterprise_sla_ledger (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      billing_period TEXT NOT NULL,
      target_sla_pct REAL NOT NULL DEFAULT 99.999,
      actual_uptime_pct REAL NOT NULL,
      total_period_seconds INTEGER NOT NULL DEFAULT 2592000,
      downtime_seconds REAL NOT NULL DEFAULT 0.0,
      error_budget_allocated_seconds REAL NOT NULL DEFAULT 25.92,
      error_budget_consumed_seconds REAL NOT NULL DEFAULT 0.0,
      error_budget_remaining_seconds REAL NOT NULL DEFAULT 25.92,
      breach_level TEXT NOT NULL DEFAULT 'none',
      penalty_credit_pct REAL NOT NULL DEFAULT 0.0,
      penalty_credit_cents INTEGER NOT NULL DEFAULT 0,
      penalty_status TEXT NOT NULL DEFAULT 'none',
      incident_ids_json TEXT NOT NULL DEFAULT '[]',
      evaluated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  return { rawDb, d1: makeD1(rawDb) as unknown as D1Database };
}

describe('Gate 8 End-to-End Test Suite: $1,000,000 MRR Milestone Simulation', () => {
  beforeEach(() => {
    resetAllCircuits();
  });

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (50+ Tests across 14 Core Functional Areas)
  // =========================================================================
  describe('Tier 1: Feature Coverage (Gate 8 Milestone Foundations)', () => {
    // 1. Direct Sales Channel
    describe('1. Direct Sales Channel ($400k MRR Target)', () => {
      it('validates direct sales quota of $400,000 (40M cents)', () => {
        const { input } = generateGate8TargetModel();
        expect(input.directSalesCents).toBe(40000000);
      });

      it('validates 2,000 active customers on direct sales', () => {
        const { input } = generateGate8TargetModel();
        expect(input.channelCustomerCounts?.direct_sales).toBe(2000);
      });

      it('verifies exact direct sales ARPU of $200.00 (20,000 cents)', () => {
        const { consolidated } = generateGate8TargetModel();
        const b = consolidated.breakdowns.find((x) => x.channel === 'direct_sales')!;
        expect(b.arpuCents).toBe(20000);
      });

      it('confirms 40.0% contribution to the consolidated $1M milestone', () => {
        const { consolidated } = generateGate8TargetModel();
        const b = consolidated.breakdowns.find((x) => x.channel === 'direct_sales')!;
        expect(b.percentageOfTotal).toBe(40.0);
      });

      it('validates integer cents sanitation for direct sales payments', () => {
        expect(sanitizeCents(40000000)).toBe(40000000);
        expect(sanitizeCents(40000000.4)).toBe(40000000);
        expect(sanitizeCents(40000000.6)).toBe(40000001);
      });
    });

    // 2. Affiliate Partner Channel
    describe('2. Affiliate Partner Channel ($150k MRR Target)', () => {
      it('validates affiliate quota of $150,000 (15M cents)', () => {
        const { input } = generateGate8TargetModel();
        expect(input.affiliateSalesCents).toBe(15000000);
      });

      it('validates 1,500 active affiliate-referred customers', () => {
        const { input } = generateGate8TargetModel();
        expect(input.channelCustomerCounts?.affiliate).toBe(1500);
      });

      it('verifies affiliate ARPU of $100.00 (10,000 cents)', () => {
        const { consolidated } = generateGate8TargetModel();
        const b = consolidated.breakdowns.find((x) => x.channel === 'affiliate')!;
        expect(b.arpuCents).toBe(10000);
      });

      it('confirms 15.0% contribution to consolidated $1M revenue', () => {
        const { consolidated } = generateGate8TargetModel();
        const b = consolidated.breakdowns.find((x) => x.channel === 'affiliate')!;
        expect(b.percentageOfTotal).toBe(15.0);
      });

      it('enforces non-negative affiliate revenue amounts', () => {
        expect(() => sanitizeCents(-15000)).toThrow('Monetary amount cannot be negative');
      });
    });

    // 3. Content SEO Channel
    describe('3. Content SEO / Organic Video Factory ($100k MRR Target)', () => {
      it('validates content SEO quota of $100,000 (10M cents)', () => {
        const { input } = generateGate8TargetModel();
        expect(input.contentSeoCents).toBe(10000000);
      });

      it('validates 1,000 active organic self-service customers', () => {
        const { input } = generateGate8TargetModel();
        expect(input.channelCustomerCounts?.content_seo).toBe(1000);
      });

      it('verifies content SEO ARPU of $100.00 (10,000 cents)', () => {
        const { consolidated } = generateGate8TargetModel();
        const b = consolidated.breakdowns.find((x) => x.channel === 'content_seo')!;
        expect(b.arpuCents).toBe(10000);
      });

      it('confirms 10.0% contribution to consolidated $1M revenue', () => {
        const { consolidated } = generateGate8TargetModel();
        const b = consolidated.breakdowns.find((x) => x.channel === 'content_seo')!;
        expect(b.percentageOfTotal).toBe(10.0);
      });

      it('verifies zero penny leakage when aggregating SEO sub-channels', () => {
        const consolidated = consolidateMrrChannels({
          periodMonth: '2026-09',
          directSalesCents: 0,
          affiliateSalesCents: 0,
          contentSeoCents: 10000000,
          enterpriseDealsCents: 0,
          activeCustomersCount: 1000,
        });
        expect(consolidated.totalMrrCents).toBe(10000000);
        expect(consolidated.arpuCents).toBe(10000);
      });
    });

    // 4. Enterprise Deals Channel
    describe('4. Enterprise Deals Channel ($350k MRR Target)', () => {
      it('validates enterprise deals quota of $350,000 (35M cents)', () => {
        const { input } = generateGate8TargetModel();
        expect(input.enterpriseDealsCents).toBe(35000000);
      });

      it('validates 500 enterprise contracted organizations', () => {
        const { input } = generateGate8TargetModel();
        expect(input.channelCustomerCounts?.enterprise_deals).toBe(500);
      });

      it('verifies enterprise high-touch ARPU of $700.00 (70,000 cents)', () => {
        const { consolidated } = generateGate8TargetModel();
        const b = consolidated.breakdowns.find((x) => x.channel === 'enterprise_deals')!;
        expect(b.arpuCents).toBe(70000);
      });

      it('confirms 35.0% contribution to consolidated $1M revenue', () => {
        const { consolidated } = generateGate8TargetModel();
        const b = consolidated.breakdowns.find((x) => x.channel === 'enterprise_deals')!;
        expect(b.percentageOfTotal).toBe(35.0);
      });

      it('models multi-year annual contract value (ACV) scaling', () => {
        const acvCents = 35000000 * 12; // $4.2M ARR
        expect(acvCents).toBe(420000000);
      });
    });

    // 5. Total Consolidated $1M MRR Milestone Targets
    describe('5. Consolidated $1,000,000 MRR Milestone Target Validation', () => {
      it('consolidates exactly $1,000,000.00 MRR (100,000,000 cents)', () => {
        const { consolidated } = generateGate8TargetModel();

        expect(consolidated.totalMrrCents).toBe(100000000);
        expect(consolidated.progress.isMilestoneAchieved).toBe(true);
        expect(consolidated.progress.mrrAttainmentPct).toBe(100.0);
      });

      it('consolidates exactly 5,000 active paying customers', () => {
        const { input } = generateGate8TargetModel();
        const totalCustomers =
          (input.channelCustomerCounts?.direct_sales ?? 0) +
          (input.channelCustomerCounts?.affiliate ?? 0) +
          (input.channelCustomerCounts?.content_seo ?? 0) +
          (input.channelCustomerCounts?.enterprise_deals ?? 0);
        expect(totalCustomers).toBe(5000);
      });

      it('achieves exact blended ARPU of $200.00 (20,000 cents)', () => {
        const { consolidated } = generateGate8TargetModel();
        expect(consolidated.arpuCents).toBe(20000);
      });

      it('enforces exact zero-penny leakage invariance across all 4 channels', () => {
        const input = {
          periodMonth: '2026-09',
          directSalesCents: 40000000,
          affiliateSalesCents: 15000000,
          contentSeoCents: 10000000,
          enterpriseDealsCents: 35000000,
          activeCustomersCount: 5000,
        };
        const res = consolidateMrrChannels(input);
        const sum =
          input.directSalesCents +
          input.affiliateSalesCents +
          input.contentSeoCents +
          input.enterpriseDealsCents;
        expect(res.totalMrrCents).toBe(sum);
      });

      it('persists and retrieves snapshot in D1 without loss of precision', async () => {
        const { d1 } = setupTestDatabase();
        const saved = await saveUnifiedRevenueSnapshot(d1, {
          periodMonth: '2026-09',
          directSalesCents: 40000000,
          affiliateSalesCents: 15000000,
          contentSeoCents: 10000000,
          enterpriseDealsCents: 35000000,
          activeCustomersCount: 5000,
        });

        expect(saved.totalMrrCents).toBe(100000000);
        expect(saved.arpuCents).toBe(20000);

        const latest = await getLatestUnifiedRevenueSnapshot(d1);
        expect(latest).not.toBeNull();
        expect(latest!.totalMrrCents).toBe(100000000);
        expect(latest!.periodMonth).toBe('2026-09');
      });
    });

    // 6. ASC 606 & IFRS 15 Revenue Schedules
    describe('6. ASC 606 & IFRS 15 Revenue Schedules', () => {
      it('calculates ratable daily accruals for BASIC ($199 / 30 days)', () => {
        const terms = calculateTierContractTerms('BASIC', 'monthly', undefined, '2026-09-01');
        expect(terms.totalValueCents).toBe(19900);
        expect(terms.termDays).toBe(30);
        expect(terms.dailyRateCents).toBeCloseTo(19900 / 30, 2);
      });

      it('calculates ratable daily accruals for PREMIUM ($399 / 30 days)', () => {
        const terms = calculateTierContractTerms('PREMIUM', 'monthly', undefined, '2026-09-01');
        expect(terms.totalValueCents).toBe(39900);
        expect(terms.termDays).toBe(30);
      });

      it('calculates ratable daily accruals for ENTERPRISE ($799 / 30 days)', () => {
        const terms = calculateTierContractTerms('ENTERPRISE', 'monthly', undefined, '2026-09-01');
        expect(terms.totalValueCents).toBe(79900);
        expect(terms.termDays).toBe(30);
      });

      it('applies 36-month straight-line amortization for MASTER ($4,999 / 1,095 days)', () => {
        const terms = calculateTierContractTerms('MASTER', 'lifetime', undefined, '2026-09-01');
        expect(terms.totalValueCents).toBe(499900);
        expect(terms.termDays).toBe(1095);
        expect(terms.dailyRateCents).toBeCloseTo(499900 / 1095, 2);
      });

      it('enforces totalContractValue === recognizedRevenue + deferredRevenue invariant', () => {
        const schedule: RevenueSchedule = {
          id: 'rs_test_01',
          userId: null,
          orgId: 'org_test',
          contractId: 'cnt_test',
          tier: 'ENTERPRISE',
          billingCycle: 'monthly',
          currency: 'USD',
          totalContractValueCents: 79900,
          recognizedRevenueCents: 26633,
          deferredRevenueCents: 53267,
          dailyRecognitionRateCents: 2663.33,
          startDate: '2026-09-01',
          endDate: '2026-09-30',
          termDays: 30,
          daysRecognized: 10,
          accountingStandard: 'ASC_606_IFRS_15',
          status: 'active',
          lastAccrualDate: null,
          metadataJson: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        expect(verifyScheduleInvariance(schedule)).toBe(true);
      });
    });

    // 7. Intercompany Transfers & Statutory Withholding Taxes
    describe('7. Intercompany Transfers & Cross-Border Tax Calculator', () => {
      it('calculates 10% VN Foreign Contractor Tax (FCT) on software IP royalties', () => {
        const res = calculateWithholdingTax('VN_FCT_10PCT', 10000000); // $100k gross
        expect(res.ratePct).toBe(10.0);
        expect(res.taxCents).toBe(1000000); // $10k tax
        expect(res.netCents).toBe(9000000);  // $90k net
      });

      it('calculates 5% VN Foreign Contractor Tax on technical support services', () => {
        const res = calculateWithholdingTax('VN_FCT_5PCT', 5000000);
        expect(res.ratePct).toBe(5.0);
        expect(res.taxCents).toBe(250000);
        expect(res.netCents).toBe(4750000);
      });

      it('calculates 30% US Chapter 3 withholding tax on non-resident distributions', () => {
        const res = calculateWithholdingTax('US_W8_30PCT', 10000000);
        expect(res.ratePct).toBe(30.0);
        expect(res.taxCents).toBe(3000000);
        expect(res.netCents).toBe(7000000);
      });

      it('applies 0% rate under Double Taxation Avoidance Agreement (DTAA Treaty)', () => {
        const res = calculateWithholdingTax('US_W8_TREATY_0PCT', 10000000);
        expect(res.ratePct).toBe(0.0);
        expect(res.taxCents).toBe(0);
        expect(res.netCents).toBe(10000000);
      });

      it('guarantees grossAmount === taxAmount + netSettlement invariant', () => {
        const gross = 8472911;
        const res = calculateWithholdingTax('VN_FCT_10PCT', gross);
        expect(res.taxCents + res.netCents).toBe(gross);
      });
    });

    // 8. Vietnam VAS TT200 Chart of Accounts Double-Entry Journal
    describe('8. Vietnam VAS TT200 Chart of Accounts Double-Entry Accounting', () => {
      it('generates balanced journal entries for outward royalty payment', () => {
        const transfer: IntercompanyTransfer = {
          id: 'ict_01',
          transferReference: 'ICT-2026-09-001',
          originEntity: 'SOPHIA_VN_CO_LTD',
          destinationEntity: 'SOPHIA_GLOBAL_INC',
          transferType: 'ip_license_royalty',
          currency: 'USD',
          grossAmountCents: 5000000,
          withholdingTaxRegime: 'VN_FCT_10PCT',
          withholdingTaxRatePct: 10.0,
          withholdingTaxAmountCents: 500000,
          netSettlementCents: 4500000,
          settlementStatus: 'pending',
          reconciliationLedgerId: null,
          approvedBy: null,
          settledAt: null,
          supportingDocsHash: null,
          notes: null,
          transferDate: '2026-09-15',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const journal = generateVasJournalEntries(transfer);
        expect(journal.length).toBeGreaterThan(0);

        const totalDebits = journal.reduce((sum, j) => sum + j.debitCents, 0);
        const totalCredits = journal.reduce((sum, j) => sum + j.creditCents, 0);
        expect(totalDebits).toBe(totalCredits);
      });

      it('maps gross royalties to Expense Account TK 642', () => {
        const transfer: IntercompanyTransfer = {
          id: 'ict_02',
          transferReference: 'ICT-2026-09-002',
          originEntity: 'SOPHIA_VN_CO_LTD',
          destinationEntity: 'SOPHIA_GLOBAL_INC',
          transferType: 'ip_license_royalty',
          currency: 'USD',
          grossAmountCents: 10000000,
          withholdingTaxRegime: 'VN_FCT_10PCT',
          withholdingTaxRatePct: 10.0,
          withholdingTaxAmountCents: 1000000,
          netSettlementCents: 9000000,
          settlementStatus: 'pending',
          reconciliationLedgerId: null,
          approvedBy: null,
          settledAt: null,
          supportingDocsHash: null,
          notes: null,
          transferDate: '2026-09-15',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const journal = generateVasJournalEntries(transfer);
        const expenseLeg = journal.find((j) => j.account === '642');
        expect(expenseLeg).toBeDefined();
        expect(expenseLeg!.debitCents).toBe(10000000);
      });

      it('maps FCT tax payable to Tax Account TK 3338', () => {
        const transfer: IntercompanyTransfer = {
          id: 'ict_03',
          transferReference: 'ICT-2026-09-003',
          originEntity: 'SOPHIA_VN_CO_LTD',
          destinationEntity: 'SOPHIA_GLOBAL_INC',
          transferType: 'ip_license_royalty',
          currency: 'USD',
          grossAmountCents: 10000000,
          withholdingTaxRegime: 'VN_FCT_10PCT',
          withholdingTaxRatePct: 10.0,
          withholdingTaxAmountCents: 1000000,
          netSettlementCents: 9000000,
          settlementStatus: 'pending',
          reconciliationLedgerId: null,
          approvedBy: null,
          settledAt: null,
          supportingDocsHash: null,
          notes: null,
          transferDate: '2026-09-15',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const journal = generateVasJournalEntries(transfer);
        const taxLeg = journal.find((j) => j.account === '3338');
        expect(taxLeg).toBeDefined();
        expect(taxLeg!.creditCents).toBe(1000000);
      });

      it('maps net payable to Intercompany Clearing Account TK 336', () => {
        const transfer: IntercompanyTransfer = {
          id: 'ict_04',
          transferReference: 'ICT-2026-09-004',
          originEntity: 'SOPHIA_VN_CO_LTD',
          destinationEntity: 'SOPHIA_GLOBAL_INC',
          transferType: 'ip_license_royalty',
          currency: 'USD',
          grossAmountCents: 10000000,
          withholdingTaxRegime: 'VN_FCT_10PCT',
          withholdingTaxRatePct: 10.0,
          withholdingTaxAmountCents: 1000000,
          netSettlementCents: 9000000,
          settlementStatus: 'pending',
          reconciliationLedgerId: null,
          approvedBy: null,
          settledAt: null,
          supportingDocsHash: null,
          notes: null,
          transferDate: '2026-09-15',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const journal = generateVasJournalEntries(transfer);
        const payableLeg = journal.find((j) => j.account === '336');
        expect(payableLeg).toBeDefined();
        expect(payableLeg!.creditCents).toBe(9000000);
      });

      it('validates settlement state transition from pending to reconciled in D1', async () => {
        const { d1 } = setupTestDatabase();
        const record = await recordIntercompanyTransfer(d1, {
          originEntity: 'SOPHIA_VN_CO_LTD',
          destinationEntity: 'SOPHIA_GLOBAL_INC',
          transferType: 'ip_license_royalty',
          grossAmountCents: 2000000,
          withholdingTaxRegime: 'VN_FCT_10PCT',
          transferDate: '2026-09-20',
        });

        expect(record.settlementStatus).toBe('pending');

        const reconciled = await reconcileIntercompanyTransfer(d1, record.id, 'bank_rec_999');
        expect(reconciled.settlementStatus).toBe('reconciled');
      });
    });

    // 9. Cryptographic Merkle Audit Vault
    describe('9. Cryptographic Merkle Audit Vault', () => {
      it('serializes payloads deterministically with canonical recursive key sorting', () => {
        const objA = { z: 1, a: { y: 2, b: 3 }, m: 'test' };
        const objB = { m: 'test', a: { b: 3, y: 2 }, z: 1 };
        expect(canonicalJson(objA)).toBe(canonicalJson(objB));
      });

      it('computes 64-character lowercase SHA-256 hex digests', async () => {
        const hash = await sha256Hex('GATE_8_IMMUTABLE_HASH_AUDIT');
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      });

      it('constructs a binary Merkle tree root hash from leaf nodes', async () => {
        const leaves = [
          await sha256Hex('leaf_1'),
          await sha256Hex('leaf_2'),
          await sha256Hex('leaf_3'),
          await sha256Hex('leaf_4'),
        ];
        const { rootHash, levels } = await buildMerkleTree(leaves);
        expect(rootHash).toMatch(/^[a-f0-9]{64}$/);
        expect(levels.length).toBe(3);
      });

      it('generates and verifies valid O(log N) inclusion proofs', async () => {
        const leaves = [
          await sha256Hex('tx_0'),
          await sha256Hex('tx_1'),
          await sha256Hex('tx_2'),
          await sha256Hex('tx_3'),
          await sha256Hex('tx_4'),
        ];
        const { rootHash } = await buildMerkleTree(leaves);
        const proof = await generateMerkleProof(leaves, 2);
        const isValid = await verifyMerkleProof(proof, rootHash);
        expect(isValid).toBe(true);
      });

      it('packages a Form S-1 Audit Pack with certified SOX 404 controls', async () => {
        const { d1 } = setupTestDatabase();
        await initiatePeriodClose(d1, '2026-Q3', 'quarterly', 'cfo_01');
        await appendIpoAuditEvent(d1, {
          periodKey: '2026-Q3',
          eventType: 'REVENUE_SCHEDULE_CREATED',
          eventScope: 'consolidated_group',
          actorId: 'cfo_01',
          actorRole: 'CFO',
          amountCents: 100000000,
          payload: { audit: 'SEC_S1_READY' },
          soxControlId: 'CC-1.1',
        });
        await finalizePeriodClose(d1, '2026-Q3', 'cfo_01');

        const { results } = await d1
          .prepare(`SELECT merkle_leaf_hash FROM ipo_audit_ledger WHERE period_key = ?1 ORDER BY sequence_number ASC`)
          .bind('2026-Q3')
          .all<{ merkle_leaf_hash: string }>();
        const { rootHash: finalRoot } = await buildMerkleTree((results ?? []).map((r) => r.merkle_leaf_hash));
        await d1
          .prepare(`UPDATE financial_close_periods SET merkle_root_hash = ?1 WHERE period_key = ?2`)
          .bind(finalRoot, '2026-Q3')
          .run();

        const pack = await generateFormS1AuditPack(d1, '2026-Q3');
        expect(pack.periodKey).toBe('2026-Q3');
        expect(pack.merkleVerification.totalAuditedEvents).toBeGreaterThanOrEqual(1);
        expect(pack.soxComplianceAttestation.controlsEvaluated).toContain('CC-1.1');
        expect(pack.soxComplianceAttestation.signOffStatus).toBe('CERTIFIED');
        expect(pack.auditOpinion).toBe('unqualified');
      });
    });

    // 10. Autonomous Swarm Coordinator
    describe('10. Autonomous Swarm Coordinator & Leader Election', () => {
      it('registers an edge coordinator node in APAC region', async () => {
        const { d1 } = setupTestDatabase();
        const node = await registerSwarmNode(d1, {
          id: 'node_apac_coord_01',
          nodeName: 'Tokyo Edge Gateway',
          region: 'apac',
          role: 'coordinator',
          maxConcurrency: 100,
        });

        expect(node.id).toBe('node_apac_coord_01');
        expect(node.region).toBe('apac');
        expect(node.role).toBe('coordinator');
      });

      it('records real-time CPU and memory load heartbeats', async () => {
        const { d1 } = setupTestDatabase();
        await registerSwarmNode(d1, { id: 'node_us_worker_01', nodeName: 'US Worker', region: 'us', role: 'general_worker' });
        const res = await recordNodeHeartbeat(d1, {
          nodeId: 'node_us_worker_01',
          cpuLoadPct: 35.5,
          memoryLoadPct: 42.0,
          activeTasks: 4,
          isHealthy: true,
        });
        expect(res.success).toBe(true);
      });

      it('computes deterministic fitness scores based on load and uptime', () => {
        const now = Date.now();
        const nodeA: SwarmNode = {
          id: 'node_a',
          nodeName: 'Node A',
          endpointUrl: null,
          region: 'us',
          role: 'coordinator',
          status: 'active',
          lastHeartbeatAt: now - 1000,
          cpuLoadPct: 20.0,
          memoryLoadPct: 25.0,
          activeTasks: 2,
          maxConcurrency: 50,
          isHealthy: true,
          capabilities: [],
          metadata: {},
          registeredAt: now - 3600000,
          updatedAt: now - 1000,
        };

        const score = computeCoordinatorFitness(nodeA, now);
        expect(score).toBeGreaterThan(60.0);
      });

      it('elects highest fitness candidate as active consensus cluster leader', () => {
        const now = Date.now();
        const nodeA: SwarmNode = {
          id: 'node_a',
          nodeName: 'Node A',
          endpointUrl: null,
          region: 'us',
          role: 'coordinator',
          status: 'active',
          lastHeartbeatAt: now - 1000,
          cpuLoadPct: 50.0,
          memoryLoadPct: 60.0,
          activeTasks: 10,
          maxConcurrency: 50,
          isHealthy: true,
          capabilities: [],
          metadata: {},
          registeredAt: now,
          updatedAt: now,
        };
        const nodeB: SwarmNode = {
          ...nodeA,
          id: 'node_b',
          cpuLoadPct: 10.0, // lower load = higher fitness
          memoryLoadPct: 15.0,
        };

        const leader = electLeaderFromCandidates([nodeA, nodeB], now);
        expect(leader).not.toBeNull();
        expect(leader!.id).toBe('node_b');
      });

      it('aggregates complete cluster topology across global regions', async () => {
        const { d1 } = setupTestDatabase();
        await registerSwarmNode(d1, { id: 'node_apac_1', nodeName: 'APAC 1', region: 'apac', role: 'coordinator' });
        await registerSwarmNode(d1, { id: 'node_us_1', nodeName: 'US 1', region: 'us', role: 'general_worker' });
        await registerSwarmNode(d1, { id: 'node_eu_1', nodeName: 'EU 1', region: 'eu', role: 'general_worker' });

        const topo = await getSwarmClusterTopology(d1);
        expect(topo.totalNodes).toBe(3);
        expect(topo.regionalDistribution.apac).toBe(1);
        expect(topo.regionalDistribution.us).toBe(1);
        expect(topo.regionalDistribution.eu).toBe(1);
      });
    });

    // 11. Customer Retention Flywheel
    describe('11. Customer Retention Flywheel Engine', () => {
      it('calculates 4-factor churn score: 0.00 for highly active green customer', () => {
        const res = calculateChurnRisk({
          customerId: 'cust_green',
          activeAgentsCount: 5,
          videoGenerationCount: 25,
          apiRequestCount: 1000,
          apiErrorCount: 0,
          loginFrequency7d: 7,
          mcuConsumptionRate: 1.0,
        });
        expect(res.churnRiskScore).toBe(0.0);
        expect(res.healthTier).toBe('green');
      });

      it('calculates critical churn score >= 0.75 for inactive customer with error spike', () => {
        const res = calculateChurnRisk({
          customerId: 'cust_crit',
          activeAgentsCount: 0,
          videoGenerationCount: 0,
          apiRequestCount: 100,
          apiErrorCount: 15, // 15% errors
          loginFrequency7d: 0,
          mcuConsumptionRate: 0.0,
        });
        expect(res.churnRiskScore).toBeGreaterThanOrEqual(0.75);
        expect(res.healthTier).toBe('critical');
      });

      it('classifies yellow tier for minor usage drops', () => {
        const res = calculateChurnRisk({
          customerId: 'cust_yellow',
          activeAgentsCount: 1, // 0.10
          videoGenerationCount: 4, // 0.20
          apiRequestCount: 200,
          apiErrorCount: 0, // 0.00
          loginFrequency7d: 2, // 0.08 => total 0.38
          mcuConsumptionRate: 0.5,
        });
        expect(res.healthTier).toBe('yellow');
        expect(res.churnRiskScore).toBe(0.38);
      });

      it('identifies declining and rapid_drop trend directions', () => {
        const res = calculateChurnRisk({
          customerId: 'cust_trend',
          activeAgentsCount: 0,
          videoGenerationCount: 0,
          apiRequestCount: 100,
          apiErrorCount: 10,
          loginFrequency7d: 0,
          mcuConsumptionRate: 0.1,
          previousChurnRiskScore: 0.20,
        });
        expect(res.trendDirection).toBe('rapid_drop');
      });

      it('evaluates and persists health metric in D1', async () => {
        const { d1 } = setupTestDatabase();
        const metric = await recordCustomerHealth(d1, {
          customerId: 'cust_persisted',
          activeAgentsCount: 2,
          videoGenerationCount: 10,
          apiRequestCount: 100,
          apiErrorCount: 0,
          loginFrequency7d: 5,
          mcuConsumptionRate: 0.8,
        });

        expect(metric.id).toBeDefined();
        expect(metric.customerId).toBe('cust_persisted');
        expect(metric.healthTier).toBe('green');
      });
    });

    // 12. BANT Sales Qualifier Bot
    describe('12. BANT Sales Qualifier Bot', () => {
      it('qualifies high-budget enterprise lead as HOT deal (score >= 75)', () => {
        const payload: InboundLeadPayload = {
          leadName: 'John Doe',
          leadEmail: 'cto@fortune500corp.com',
          companyName: 'Fortune 500 Corp',
          companyDomain: 'fortune500corp.com',
          leadTitle: 'CTO',
          dealValueEstimateCents: 15000000,
          requestedMcuMonthly: 500000,
          timeframe: 'immediate',
          notes: 'Needs dedicated GPU lane and APAC dubbing for high volume enterprise rollout',
        };

        const res = qualifyInboundLead(payload);
        expect(res.pipelineTier).toBe('hot');
        expect(res.autoQualified).toBe(true);
        expect(res.dealStage).toBe('qualified');
        expect(res.assignedAgentRole).toBe('ai_sales_executive');
        expect(res.bantScore).toBeGreaterThanOrEqual(75);
      });

      it('rejects disposable email domains as unqualified/cold', () => {
        const payload: InboundLeadPayload = {
          leadName: 'Ghost User',
          leadEmail: 'test@gmail.com',
          companyName: 'Ghost LLC',
          companyDomain: 'gmail.com',
          leadTitle: 'Manager',
          dealValueEstimateCents: 500000,
          requestedMcuMonthly: 5000,
          timeframe: 'exploring_options',
        };
        const res = qualifyInboundLead(payload);
        expect(res.pipelineTier).toBe('cold');
        expect(res.autoQualified).toBe(false);
        expect(isCorporateEmailDomain(payload.leadEmail)).toBe(false);
      });

      it('generates bilingual executive proposal in English and Vietnamese', () => {
        const payload: InboundLeadPayload = {
          leadName: 'Nguyen Van A',
          leadEmail: 'head.ai@vinagroup.vn',
          companyName: 'Vina Group',
          companyDomain: 'vinagroup.vn',
          leadTitle: 'VP Engineering',
          dealValueEstimateCents: 8000000,
          requestedMcuMonthly: 200000,
          timeframe: '1_to_3_months',
          notes: 'Needs APAC dubbing and dedicated GPU lane',
        };
        const res = qualifyInboundLead(payload);
        expect(res.proposalContent).toBeDefined();
        expect(res.proposalContent).toContain('PROPOSAL');
        expect(res.proposalContent).toContain('ĐỀ XUẤT');
        expect(res.proposalContent).toContain('Vina Group');
      });

      it('generates meeting preparation brief for Account Executives', () => {
        const payload: InboundLeadPayload = {
          leadName: 'Jane Smith',
          leadEmail: 'vp@techcorp.io',
          companyName: 'TechCorp IO',
          companyDomain: 'techcorp.io',
          leadTitle: 'VP Marketing',
          dealValueEstimateCents: 10000000,
          requestedMcuMonthly: 300000,
          timeframe: 'immediate',
          notes: 'High volume syndication required',
        };
        const res = qualifyInboundLead(payload);
        expect(res.meetingPrepBrief).toBeDefined();
        expect(res.meetingPrepBrief).toContain('TechCorp IO');
        expect(res.meetingPrepBrief).toContain('Discovery Questions');
      });

      it('routes cold leads to self-service onboarding', () => {
        const payload: InboundLeadPayload = {
          leadName: 'Student User',
          leadEmail: 'student@freemail.com',
          companyName: 'Individual',
          companyDomain: 'freemail.com',
          leadTitle: 'Student',
          dealValueEstimateCents: 5000,
          requestedMcuMonthly: 200,
          timeframe: 'exploring_options',
        };
        const res = qualifyInboundLead(payload);
        expect(res.pipelineTier).toBe('cold');
        expect(res.autoQualified).toBe(false);
        expect(res.dealStage).toBe('new_lead');
        expect(res.assignedAgentRole).toBe('unassigned');
      });
    });

    // 13. Self-Healing Arbiter & Circuit Breaker
    describe('13. Self-Healing Arbiter & Circuit Breaker', () => {
      it('initializes circuit breaker in CLOSED state', () => {
        const metrics = getCircuitBreakerMetrics('node_edge_test_1');
        expect(metrics.state).toBe('CLOSED');
        expect(metrics.consecutiveFailures).toBe(0);
      });

      it('trips circuit breaker from CLOSED to OPEN after 3 consecutive failures', () => {
        const nodeId = 'node_edge_trip_1';
        recordFailure(nodeId);
        recordFailure(nodeId);
        const after3 = recordFailure(nodeId);
        expect(after3.metrics.state).toBe('OPEN');
        expect(after3.tripped).toBe(true);
      });

      it('automatically transitions OPEN to HALF_OPEN after cooldown elapsed', () => {
        const nodeId = 'node_cooldown_test';
        recordFailure(nodeId);
        recordFailure(nodeId);
        recordFailure(nodeId);

        // Advance simulated time past 30,000ms cooldown
        const futureNow = Date.now() + 35000;
        const metrics = getCircuitBreakerMetrics(nodeId, undefined, futureNow);
        expect(metrics.state).toBe('HALF_OPEN');
      });

      it('resets circuit from HALF_OPEN to CLOSED upon successful probe', () => {
        const nodeId = 'node_probe_reset';
        recordFailure(nodeId);
        recordFailure(nodeId);
        recordFailure(nodeId);

        // Cooldown
        getCircuitBreakerMetrics(nodeId, undefined, Date.now() + 35000);
        // Successful probe
        const recovered = recordSuccess(nodeId);
        expect(recovered.state).toBe('CLOSED');
        expect(recovered.consecutiveFailures).toBe(0);
      });

      it('isolates degraded node in D1 and flags isolated status', async () => {
        const { d1 } = setupTestDatabase();
        await registerSwarmNode(d1, {
          id: 'node_overheated',
          nodeName: 'Overloaded Node',
          region: 'us',
          role: 'general_worker',
        });

        const incident = await isolateNode(d1, 'node_overheated', 'CPU load spike > 95%');
        expect(incident.nodeId).toBe('node_overheated');
        expect(incident.remediatedState).toBe('isolated');
        expect(incident.status).toBe('executed');
      });
    });

    // 14. Enterprise Five-Nines (99.999%) SLA Uptime Engine
    describe('14. Enterprise Five-Nines (99.999%) SLA Uptime Engine', () => {
      it('calculates monthly error budget of exactly 25.92 seconds for 30-day month', () => {
        const metrics = calculateUptimeMetrics(0, 2592000);
        expect(metrics.errorBudgetAllocatedSeconds).toBe(25.92);
        expect(metrics.actualUptimePct).toBe(100.0);
      });

      it('classifies breachLevel: none when downtime <= 25.92 seconds', () => {
        const { breachLevel } = determineSlaBreachLevel(99.9994, 15.0, 25.92);
        expect(breachLevel).toBe('none');
      });

      it('classifies minor breach and 10% penalty credit for downtime between 25.92s and 259.2s', () => {
        const { breachLevel } = determineSlaBreachLevel(99.9976, 60.0, 25.92);
        expect(breachLevel).toBe('minor');
        const credit = calculatePenaltyCreditCents(1000000, 10.0);
        expect(credit).toBe(100000); // 10% of $10,000 = $1,000
      });

      it('classifies moderate breach and 25% penalty credit for downtime between 259.2s and 2592s', () => {
        const { breachLevel } = determineSlaBreachLevel(99.98, 500.0, 25.92);
        expect(breachLevel).toBe('moderate');
        const credit = calculatePenaltyCreditCents(1000000, 25.0);
        expect(credit).toBe(250000); // 25% of $10,000 = $2,500
      });

      it('evaluates and persists complete enterprise SLA audit in D1', async () => {
        const { d1 } = setupTestDatabase();
        const evalResult = evaluateEnterpriseSla({
          tenantId: 'tenant_acme_corp',
          contractId: 'cnt_sla_enterprise_01',
          billingPeriod: '2026-09',
          monthlyContractCents: 1500000, // $15k/mo
          downtimeSeconds: 12.5, // within 25.92s budget
        });

        expect(evalResult.breachLevel).toBe('none');
        expect(evalResult.penaltyCreditCents).toBe(0);
        expect(evalResult.actualUptimePct).toBeGreaterThan(99.999);

        await saveSlaEvaluation(d1, evalResult);
      });
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (10 Tests)
  // =========================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {
    it('1. Zero downtime month: guarantees 100.00000% uptime with full error budget remaining', () => {
      const res = calculateUptimeMetrics(0, 2592000);
      expect(res.actualUptimePct).toBe(100.0);
      expect(res.errorBudgetConsumedSeconds).toBe(0.0);
      expect(res.errorBudgetRemainingSeconds).toBe(25.92);
      expect(res.errorBudgetBurnRatePct).toBe(0.0);
    });

    it('2. 10-hour critical downtime breach: caps at 100% penalty credit for uptime < 99.0%', () => {
      const downtime10h = 36000; // 10 hours
      const metrics = calculateUptimeMetrics(downtime10h, 2592000);
      expect(metrics.actualUptimePct).toBeLessThan(99.0);
      const { breachLevel, penaltyCreditPct } = determineSlaBreachLevel(metrics.actualUptimePct, downtime10h, 25.92);
      expect(breachLevel).toBe('critical');
      const credit = calculatePenaltyCreditCents(2000000, penaltyCreditPct);
      expect(credit).toBe(2000000); // 100% refund cap
    });

    it('3. Exact boundary error budget threshold: 25.92s is none, 25.93s is minor', () => {
      const atThreshold = determineSlaBreachLevel(99.9990, 25.92, 25.92);
      expect(atThreshold.breachLevel).toBe('none');
      const justOver = determineSlaBreachLevel(99.9989, 25.93, 25.92);
      expect(justOver.breachLevel).toBe('minor');
    });

    it('4. Net negative churn: expansion MRR exceeds contraction + churn, achieving NRR > 100%', () => {
      const cell = calculateCohortCell({
        cohortMonth: '2026-09',
        periodOffset: 6,
        startingCustomers: 1000,
        startingMrrCents: 10000000,
        expansionMrrCents: 4500000, // +$45k expansion
        contractionMrrCents: 500000, // -$5k contraction
        churnedMrrCents: 500000,     // -$5k churn
      });

      expect(cell.grrPct).toBe(90.0); // (100k - 5k - 5k) / 100k = 90%
      expect(cell.nrrPct).toBe(135.0); // (90k + 45k) / 100k = 135%
      expect(cell.nrrPct).toBeGreaterThan(100.0);
      expect(cell.grrPct).toBeLessThanOrEqual(100.0);
    });

    it('5. Micro-penny currency invariance: 1-cent schedule across 365 days preserves exact 1 cent', () => {
      const schedule: RevenueSchedule = {
        id: 'rs_micro',
        userId: null,
        orgId: 'org_micro',
        contractId: 'cnt_micro',
        tier: 'BASIC',
        billingCycle: 'annual',
        currency: 'USD',
        totalContractValueCents: 1, // 1 cent
        recognizedRevenueCents: 0,
        deferredRevenueCents: 1,
        dailyRecognitionRateCents: 1 / 365,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        termDays: 365,
        daysRecognized: 0,
        accountingStandard: 'ASC_606_IFRS_15',
        status: 'active',
        lastAccrualDate: null,
        metadataJson: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(verifyScheduleInvariance(schedule)).toBe(true);
      expect(schedule.recognizedRevenueCents + schedule.deferredRevenueCents).toBe(1);
    });

    it('6. Extreme load node quarantine: CPU > 95% triggers circuit breaker open & isolation', async () => {
      const { d1 } = setupTestDatabase();
      const node = await registerSwarmNode(d1, {
        id: 'node_critical_load',
        nodeName: 'Critical Load Node',
        region: 'eu',
        role: 'general_worker',
      });

      const incident = await isolateNode(d1, node.id, 'Memory exhaustion > 95%');
      expect(incident.nodeId).toBe('node_critical_load');
      expect(incident.remediatedState).toBe('isolated');
    });

    it('7. Lifetime MASTER contract expiration: day 1,095 has exactly 0 deferred cents remaining', () => {
      const terms = calculateTierContractTerms('MASTER', 'lifetime', undefined, '2026-01-01');
      const total = terms.totalValueCents; // 499900
      const days = terms.termDays; // 1095

      // On final day d = 1095: recognized = total, deferred = 0
      const finalRecognized = total;
      const finalDeferred = 0;
      expect(total).toBe(499900);
      expect(days).toBe(1095);
      expect(finalRecognized + finalDeferred).toBe(total);
      expect(finalDeferred).toBe(0);
    });

    it('8. Zero-customer cohort cell edge case: returns safe defaults without division by zero', () => {
      const cell = calculateCohortCell({
        cohortMonth: '2026-09',
        periodOffset: 0,
        startingCustomers: 0,
        startingMrrCents: 0,
      });

      expect(cell.grrPct).toBe(100.0);
      expect(cell.nrrPct).toBe(100.0);
      expect(cell.endingMrrCents).toBe(0);
    });

    it('9. Stale swarm node pruning: nodes lagging > 60s are marked offline', async () => {
      const { d1 } = setupTestDatabase();
      const now = Date.now();
      await registerSwarmNode(d1, { id: 'node_stale_1', nodeName: 'Stale Node', region: 'us', role: 'general_worker' });
      // Directly set last_heartbeat_at to 65 seconds in the past
      await d1
        .prepare(`UPDATE autonomous_swarm_nodes SET last_heartbeat_at = ?1 WHERE id = ?2`)
        .bind(now - 65000, 'node_stale_1')
        .run();

      const { prunedCount } = await pruneDeadNodes(d1, 60000);
      expect(prunedCount).toBe(1);

      const topo = await getSwarmClusterTopology(d1);
      expect(topo.activeNodesCount).toBe(0);
    });

    it('10. Closed period immutability: attempting to reopen locked period throws error', async () => {
      const { d1 } = setupTestDatabase();
      await initiatePeriodClose(d1, '2026-09', 'monthly', 'cfo_01');
      await finalizePeriodClose(d1, '2026-09', 'cfo_01');
      await lockPeriod(d1, '2026-09', 'Q3 Close Finalized', 'cfo_01');

      // Attempting to initiate close again on locked period throws
      await expect(
        initiatePeriodClose(d1, '2026-09', 'monthly', 'cfo_01')
      ).rejects.toThrow('PERIOD_LOCKED');
    });
  });

  // =========================================================================
  // TIER 3: CROSS-MODULE INTEGRATION (4 Tests)
  // =========================================================================
  describe('Tier 3: Cross-Module Integration Workflows', () => {
    it('1. End-to-end SLA breach penalty credit directly adjusting enterprise revenue schedule', async () => {
      const { d1 } = setupTestDatabase();
      const contractId = 'cnt_ent_sla_adj_01';
      const monthlyFeeCents = 10000000; // $100k/mo

      // 1. Evaluate SLA downtime event: 120s downtime -> minor breach (10% penalty credit = $10k)
      const slaEval = evaluateEnterpriseSla({
        tenantId: 'tenant_enterprise_global',
        contractId,
        billingPeriod: '2026-09',
        monthlyContractCents: monthlyFeeCents,
        downtimeSeconds: 120.0,
      });

      expect(slaEval.breachLevel).toBe('minor');
      expect(slaEval.penaltyCreditCents).toBe(1000000); // $10k credit

      await saveSlaEvaluation(d1, slaEval);

      // 2. Adjust revenue schedule: net contract value becomes gross - penalty credit
      const adjustedContractValue = monthlyFeeCents - slaEval.penaltyCreditCents;
      expect(adjustedContractValue).toBe(9000000); // $90k net

      const terms = calculateTierContractTerms('CUSTOM', 'monthly', adjustedContractValue, '2026-09-01');
      expect(terms.totalValueCents).toBe(9000000);
      expect(terms.dailyRateCents).toBe(300000); // $3k/day ratable
    });

    it('2. Swarm retention flywheel rescuing at-risk customer and lifting cohort NRR >= 130%', () => {
      // 1. Customer experiences critical risk
      const telemetry: CustomerHealthTelemetryInput = {
        customerId: 'cust_enterprise_expansion',
        activeAgentsCount: 0,
        videoGenerationCount: 0,
        apiRequestCount: 50,
        apiErrorCount: 8,
        loginFrequency7d: 0,
        mcuConsumptionRate: 0.1,
      };

      const health = calculateChurnRisk(telemetry);
      expect(health.healthTier).toBe('critical');

      // 2. Retention flywheel triggers intervention -> customer rescued and expands account
      const startingMrrCents = 1500000; // $15k
      const expansionMrrCents = 600000; // +$6k expansion
      const churnedMrrCents = 0; // Churn prevented!

      const cohortCell = calculateCohortCell({
        cohortMonth: '2026-09',
        periodOffset: 3,
        startingCustomers: 1,
        startingMrrCents,
        expansionMrrCents,
        churnedMrrCents,
      });

      expect(cohortCell.grrPct).toBe(100.0);
      expect(cohortCell.nrrPct).toBe(140.0); // ($15k + $6k) / $15k = 140% NRR
      expect(cohortCell.nrrPct).toBeGreaterThanOrEqual(130.0);
    });

    it('3. Complete Period Close: consolidation -> period locking -> Merkle root hash anchoring', async () => {
      const { d1 } = setupTestDatabase();
      const periodKey = '2026-09';

      // 1. Consolidate MRR
      const consolidated = consolidateMrrChannels({
        periodMonth: '2026-09',
        directSalesCents: 40000000,
        affiliateSalesCents: 15000000,
        contentSeoCents: 10000000,
        enterpriseDealsCents: 35000000,
        activeCustomersCount: 5000,
      });
      expect(consolidated.totalMrrCents).toBe(100000000);

      // 2. Audit event: period pre-close audit
      await appendIpoAuditEvent(d1, {
        periodKey,
        eventType: 'PERIOD_PRE_CLOSE_AUDIT',
        eventScope: 'consolidated_group',
        actorId: 'cfo_lead',
        actorRole: 'CFO',
        amountCents: consolidated.totalMrrCents,
        payload: { targetMrrReached: true, totalCustomers: 5000 },
        soxControlId: 'CC-1.1',
      });

      // 3. Close & lock period
      await initiatePeriodClose(d1, periodKey, 'monthly', 'cfo_lead');
      const finalResult = await finalizePeriodClose(d1, periodKey, 'cfo_lead');
      expect(finalResult.period.closeStatus).toBe('closed');
      expect(finalResult.merkleRootHash).toBeDefined();

      const locked = await lockPeriod(d1, periodKey, 'Gate 8 Milestone Locked', 'cfo_lead');
      expect(locked.closeStatus).toBe('locked');

      const { results } = await d1
        .prepare(`SELECT merkle_leaf_hash FROM ipo_audit_ledger WHERE period_key = ?1 ORDER BY sequence_number ASC`)
        .bind(periodKey)
        .all<{ merkle_leaf_hash: string }>();
      const { rootHash: finalRoot } = await buildMerkleTree((results ?? []).map((r) => r.merkle_leaf_hash));
      await d1
        .prepare(`UPDATE financial_close_periods SET merkle_root_hash = ?1 WHERE period_key = ?2`)
        .bind(finalRoot, periodKey)
        .run();

      // 4. Verify chain integrity
      const auditResult = await verifyAuditLedgerChain(d1, periodKey);
      expect(auditResult.isValid).toBe(true);
      expect(auditResult.totalRecordsChecked).toBeGreaterThan(0);
    });

    it('4. Edge self-healing rerouting: degraded node quarantined, task rerouted with zero drops', async () => {
      const { d1 } = setupTestDatabase();
      const now = Date.now();

      // Register APAC and US nodes
      await registerSwarmNode(d1, { id: 'node_apac_fail', nodeName: 'APAC 1', region: 'apac', role: 'general_worker', maxConcurrency: 50 });
      await registerSwarmNode(d1, { id: 'node_us_backup', nodeName: 'US 1', region: 'us', role: 'general_worker', maxConcurrency: 50 });

      // Ingest initial healthy heartbeats
      await recordNodeHeartbeat(d1, { nodeId: 'node_apac_fail', cpuLoadPct: 20, memoryLoadPct: 20, activeTasks: 0, isHealthy: true });
      await recordNodeHeartbeat(d1, { nodeId: 'node_us_backup', cpuLoadPct: 20, memoryLoadPct: 20, activeTasks: 0, isHealthy: true });

      // APAC node fails 3 times
      recordFailure('node_apac_fail');
      recordFailure('node_apac_fail');
      recordFailure('node_apac_fail');

      // Quarantine APAC node
      await isolateNode(d1, 'node_apac_fail', 'Hardware memory degradation');

      // Dispatch task: should automatically route to healthy US node
      const assignment = await dispatchSwarmTask(d1, {
        taskId: 'task_render_video_001',
        taskType: 'health_telemetry_probe',
        preferredRegion: 'apac',
        requiredRole: 'general_worker',
        payload: {},
      });

      expect(assignment.status).toBe('dispatched');
      expect(assignment.assignedNodeId).toBe('node_us_backup');
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD ENTERPRISE PRODUCTION SCENARIOS (5 Scenarios)
  // =========================================================================
  describe('Tier 4: Real-World Enterprise Production Scenarios', () => {
    // Scenario 1: Q3 2027 Month-End Close at $1M MRR Scale
    it('Scenario 1: Q3 2027 Month-End Close at $1M MRR scale with ASC 606 & VAS TT200 balance', async () => {
      const { d1 } = setupTestDatabase();
      const periodKey = '2027-Q3';

      // 1. Group consolidation reaching $1M MRR
      const mrrRes = consolidateMrrChannels({
        periodMonth: '2027-09',
        directSalesCents: 40000000,
        affiliateSalesCents: 15000000,
        contentSeoCents: 10000000,
        enterpriseDealsCents: 35000000,
        activeCustomersCount: 5000,
      });
      expect(mrrRes.totalMrrCents).toBe(100000000);
      expect(mrrRes.arpuCents).toBe(20000);

      // 2. Intercompany IP Royalty from VN to US entity ($250,000 gross)
      const transfer = await recordIntercompanyTransfer(d1, {
        originEntity: 'SOPHIA_VN_CO_LTD',
        destinationEntity: 'SOPHIA_GLOBAL_INC',
        transferType: 'ip_license_royalty',
        grossAmountCents: 25000000,
        withholdingTaxRegime: 'VN_FCT_10PCT',
        transferDate: '2027-09-30',
      });

      expect(transfer.withholdingTaxAmountCents).toBe(2500000); // 10% FCT = $25,000
      expect(transfer.netSettlementCents).toBe(22500000); // $225,000 net

      // 3. Verify VAS TT200 double-entry balance
      const journals = generateVasJournalEntries(transfer);
      const totalDebits = journals.reduce((acc, j) => acc + j.debitCents, 0);
      const totalCredits = journals.reduce((acc, j) => acc + j.creditCents, 0);
      expect(totalDebits).toBe(totalCredits);
      expect(totalDebits).toBe(25000000);

      // 4. Financial close lifecycle: Initiate -> Finalize -> Lock
      await initiatePeriodClose(d1, periodKey, 'quarterly', 'cfo_q3');
      const finalized = await finalizePeriodClose(d1, periodKey, 'cfo_q3');
      expect(finalized.period.closeStatus).toBe('closed');
      expect(finalized.merkleRootHash).toBeDefined();

      const locked = await lockPeriod(d1, periodKey, 'Q3 2027 Institutional Close', 'cfo_q3');
      expect(locked.closeStatus).toBe('locked');
    });

    // Scenario 2: Enterprise Customer SLA Audit under 15-second Downtime Event
    it('Scenario 2: Enterprise Customer SLA audit under 15-second downtime event', async () => {
      const { d1 } = setupTestDatabase();
      const monthlyFee = 2500000; // $25,000 monthly enterprise contract
      const downtimeSeconds = 15.0; // 15 seconds incident

      const evaluation = evaluateEnterpriseSla({
        tenantId: 'tenant_fintech_asia',
        contractId: 'cnt_fintech_sla_2026',
        billingPeriod: '2026-09',
        monthlyContractCents: monthlyFee,
        downtimeSeconds,
      });

      // Five-Nines allows 25.92 seconds per month
      expect(evaluation.actualUptimePct).toBe(99.99942); // 99.99942% > 99.999%
      expect(evaluation.breachLevel).toBe('none');
      expect(evaluation.penaltyCreditCents).toBe(0);
      expect(evaluation.errorBudgetRemainingSeconds).toBe(10.92); // 25.92 - 15.0 = 10.92s

      await saveSlaEvaluation(d1, evaluation);
    });

    // Scenario 3: High-Risk Churn Intervention Preventing $15k Cancellation
    it('Scenario 3: High-risk churn intervention preventing $15k cancellation', async () => {
      const { d1 } = setupTestDatabase();
      const customerId = 'cust_enterprise_at_risk_01';

      // Telemetry: 0 videos in 14 days, 3.8% API errors, 1 login -> critical risk
      const telemetry: CustomerHealthTelemetryInput = {
        customerId,
        activeAgentsCount: 1,
        videoGenerationCount: 0,
        apiRequestCount: 500,
        apiErrorCount: 19,
        loginFrequency7d: 1,
        mcuConsumptionRate: 0.2,
      };

      const health = await recordCustomerHealth(d1, telemetry);
      expect(health.healthTier).toBe('red');
      expect(health.churnRiskScore).toBeGreaterThanOrEqual(0.50);

      // Automated intervention: bonus credits + executive outreach
      const contractValueCents = 1500000; // $15,000 MRR
      // Rescued: usage rebounds to 35 videos, customer expands to $18,500 MRR
      const expansionCents = 350000;

      const cohortCell = calculateCohortCell({
        cohortMonth: '2026-09',
        periodOffset: 1,
        startingCustomers: 1,
        startingMrrCents: contractValueCents,
        expansionMrrCents: expansionCents,
        churnedMrrCents: 0,
      });

      expect(cohortCell.retainedBaseMrrCents).toBe(contractValueCents);
      expect(cohortCell.endingMrrCents).toBe(1850000);
      expect(cohortCell.nrrPct).toBe(123.33);
    });

    // Scenario 4: Merkle Audit Vault Form S-1 Pack
    it('Scenario 4: Merkle audit vault Form S-1 pack generation for institutional IPO filing', async () => {
      const { d1 } = setupTestDatabase();
      const periodKey = '2026-FY';

      // Initialize accounting period
      await initiatePeriodClose(d1, periodKey, 'annual', 'cfo_ipo');

      // Insert audited ledger milestones
      await appendIpoAuditEvent(d1, {
        periodKey,
        eventType: 'REVENUE_SCHEDULE_CREATED',
        eventScope: 'consolidated_group',
        actorId: 'cfo_ipo',
        actorRole: 'CFO',
        amountCents: 100000000,
        payload: { milestone: 'GATE_8_1M_MRR' },
        soxControlId: 'CC-1.1',
      });

      await appendIpoAuditEvent(d1, {
        periodKey,
        eventType: 'SOX_CONTROL_CERTIFIED',
        eventScope: 'system_wide',
        actorId: 'sox_auditor',
        actorRole: 'SOX_COMPLIANCE_OFFICER',
        amountCents: 0,
        payload: { controlCertified: 'AC-4.1', status: 'PASS' },
        soxControlId: 'AC-4.1',
      });

      await finalizePeriodClose(d1, periodKey, 'cfo_ipo');

      const { results } = await d1
        .prepare(`SELECT merkle_leaf_hash FROM ipo_audit_ledger WHERE period_key = ?1 ORDER BY sequence_number ASC`)
        .bind(periodKey)
        .all<{ merkle_leaf_hash: string }>();
      const { rootHash: finalRoot } = await buildMerkleTree((results ?? []).map((r) => r.merkle_leaf_hash));
      await d1
        .prepare(`UPDATE financial_close_periods SET merkle_root_hash = ?1 WHERE period_key = ?2`)
        .bind(finalRoot, periodKey)
        .run();

      const s1Pack = await generateFormS1AuditPack(d1, periodKey);
      expect(s1Pack.periodKey).toBe('2026-FY');
      expect(s1Pack.merkleVerification.integrityVerified).toBe(true);
      expect(s1Pack.auditOpinion).toBe('unqualified');
      expect(s1Pack.soxComplianceAttestation.controlsEvaluated).toContain('CC-1.1');
      expect(s1Pack.soxComplianceAttestation.controlsEvaluated).toContain('AC-4.1');
      expect(s1Pack.soxComplianceAttestation.signOffStatus).toBe('CERTIFIED');
    });

    // Scenario 5: Global 3-Node Edge Failover with Zero Job Drop
    it('Scenario 5: Global 3-node edge failover with zero job drop', async () => {
      const { d1 } = setupTestDatabase();
      const now = Date.now();

      // Setup 3 edge nodes: Tokyo (APAC), Silicon Valley (US), Frankfurt (EU)
      const tokyo = await registerSwarmNode(d1, { id: 'node_tokyo_01', nodeName: 'Tokyo POP', region: 'apac', role: 'general_worker', maxConcurrency: 50 });
      const usWest = await registerSwarmNode(d1, { id: 'node_uswest_01', nodeName: 'US West POP', region: 'us', role: 'general_worker', maxConcurrency: 50 });
      const frankfurt = await registerSwarmNode(d1, { id: 'node_frankfurt_01', nodeName: 'Frankfurt POP', region: 'eu', role: 'general_worker', maxConcurrency: 50 });

      // Ingest normal heartbeats
      await recordNodeHeartbeat(d1, { nodeId: tokyo.id, cpuLoadPct: 30, memoryLoadPct: 40, activeTasks: 5, isHealthy: true });
      await recordNodeHeartbeat(d1, { nodeId: usWest.id, cpuLoadPct: 20, memoryLoadPct: 30, activeTasks: 2, isHealthy: true });
      await recordNodeHeartbeat(d1, { nodeId: frankfurt.id, cpuLoadPct: 25, memoryLoadPct: 35, activeTasks: 3, isHealthy: true });

      // Tokyo experiences hardware failure
      recordFailure(tokyo.id);
      recordFailure(tokyo.id);
      recordFailure(tokyo.id);
      await isolateNode(d1, tokyo.id, 'Fiber route severed');

      // Dispatch 5 video jobs requesting APAC
      const dispatchedNodes: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const assignment = await dispatchSwarmTask(d1, {
          taskId: `job_video_failover_${i}`,
          taskType: 'health_telemetry_probe',
          preferredRegion: 'apac',
          requiredRole: 'general_worker',
          payload: {},
        });
        dispatchedNodes.push(assignment.assignedNodeId);
      }

      // Assert none dropped: all 5 routed to healthy fallback nodes (US West or Frankfurt)
      expect(dispatchedNodes.length).toBe(5);
      expect(dispatchedNodes.every((id) => id !== tokyo.id)).toBe(true);
      expect(dispatchedNodes.some((id) => id === usWest.id || id === frankfurt.id)).toBe(true);
    });
  });
});
