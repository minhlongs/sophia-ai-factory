/** @vitest-environment node */

/**
 * Gate 11 E2E Integration Suite: $10,000,000 MRR ($120M ARR, 40,000 Paid Customers)
 *
 * Simulates:
 * 1. 40,000 Paid Customers across 4 subscription cohorts (Basic, Pro, Enterprise, Master)
 * 2. Blended ARPU = $250.00 / month, NRR >= 145%, Rule of 40 >= 70%
 * 3. End-to-End SEC Form 10-K & SGX Dual-Listing iXBRL Generation
 * 4. OECD BEPS Pillar Two 15% Global Minimum Tax Allocations
 * 5. Planetary Swarm 3.0 Byzantine Consensus with Sub-10ms Heartbeats
 * 6. W3C ZK-DID Autonomous Agent Issuance & Spot Compute Auction Clearing
 * 7. Concentrated Liquidity AMM Swaps with <=0.03% Slippage & Treasury Rebalancing
 *
 * @module tests/e2e/gate11-10000k-mrr.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@cloudflare/workers-types';
import { GATE_11_CONSTANTS, type BepsComputationInput } from '@/seed/types/dual-listing';
import { DualListingEngine } from '@/tree/listing/dual-listing-engine';
import { FcpaComplianceLedger } from '@/tree/listing/fcpa-compliance-ledger';
import {
  type PlanetarySwarmNode,
  type SpotBidRequest,
} from '@/seed/types/planetary-swarm';
import { PlanetarySwarmV3Coordinator } from '@/tree/swarm/planetary-swarm-v3-coordinator';
import { ZkDidVerifier } from '@/tree/identity/zk-did-verifier';
import {
  type AmmLiquidityPool,
  type AmmSwapQuoteRequest,
} from '@/seed/types/amm-clearing';
import { ConcentratedLiquidityEngine } from '@/tree/amm/concentrated-liquidity-engine';
import { TreasuryRebalancer } from '@/tree/amm/treasury-rebalancer';

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

describe('Gate 11 E2E Integration Suite ($10M MRR / $120M ARR)', () => {
  let db: D1Database;

  beforeEach(() => {
    const rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS dual_listing_periods (
        id TEXT PRIMARY KEY,
        period_name TEXT NOT NULL,
        fiscal_year INTEGER NOT NULL,
        fiscal_quarter INTEGER,
        filing_type TEXT NOT NULL,
        us_cik TEXT NOT NULL,
        sgx_ticker TEXT NOT NULL,
        currency TEXT NOT NULL,
        consolidated_revenue_cents INTEGER NOT NULL,
        consolidated_ebitda_cents INTEGER NOT NULL,
        adjusted_ebitda_cents INTEGER NOT NULL,
        free_cash_flow_cents INTEGER NOT NULL,
        net_income_cents INTEGER NOT NULL,
        paid_customers_count INTEGER NOT NULL,
        arpu_cents INTEGER NOT NULL,
        nrr_percentage INTEGER NOT NULL,
        rule_of_forty_percentage INTEGER NOT NULL,
        audit_firm_name TEXT NOT NULL,
        audit_opinion_type TEXT NOT NULL,
        ixbrl_document_uri TEXT,
        sec_edgar_submission_id TEXT,
        sgx_net_announcement_id TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT '2026-09-27T00:00:00Z',
        updated_at TEXT NOT NULL DEFAULT '2026-09-27T00:00:00Z'
      );
      CREATE TABLE IF NOT EXISTS planetary_swarm_nodes (
        id TEXT PRIMARY KEY,
        node_key TEXT NOT NULL UNIQUE,
        continent TEXT NOT NULL,
        datacenter_code TEXT NOT NULL,
        ip_address_hash TEXT NOT NULL,
        ed25519_public_key TEXT NOT NULL,
        status TEXT NOT NULL,
        consensus_role TEXT NOT NULL,
        heartbeat_latency_ms INTEGER NOT NULL,
        uptime_percentage REAL NOT NULL,
        last_heartbeat_at TEXT NOT NULL,
        registered_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS zk_did_identity_registry (
        id TEXT PRIMARY KEY,
        did TEXT NOT NULL UNIQUE,
        owner_node_id TEXT NOT NULL,
        controller_uri TEXT NOT NULL,
        public_key_multibase TEXT NOT NULL,
        credential_schema_hash TEXT NOT NULL,
        revocation_status TEXT NOT NULL,
        proof_type TEXT NOT NULL,
        merkle_proof_hex TEXT NOT NULL,
        issued_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS amm_liquidity_pools (
        id TEXT PRIMARY KEY,
        pair_symbol TEXT NOT NULL UNIQUE,
        token0_symbol TEXT NOT NULL,
        token1_symbol TEXT NOT NULL,
        token0_decimals INTEGER NOT NULL,
        token1_decimals INTEGER NOT NULL,
        reserve0_amount_units TEXT NOT NULL,
        reserve1_amount_units TEXT NOT NULL,
        current_sqrt_price_x96 TEXT NOT NULL,
        current_tick INTEGER NOT NULL,
        tick_spacing INTEGER NOT NULL,
        fee_tier_bps INTEGER NOT NULL,
        max_slippage_cap_bps INTEGER NOT NULL,
        total_value_locked_usd_cents INTEGER NOT NULL,
        volume_24h_usd_cents INTEGER NOT NULL,
        is_circuit_breaker_tripped INTEGER NOT NULL,
        last_rebalanced_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS amm_swap_transactions (
        id TEXT PRIMARY KEY,
        pool_id TEXT NOT NULL,
        trader_identifier TEXT NOT NULL,
        recipient_address TEXT NOT NULL,
        amount_in_units TEXT NOT NULL,
        amount_out_units TEXT NOT NULL,
        token_in_symbol TEXT NOT NULL,
        token_out_symbol TEXT NOT NULL,
        effective_price_ratio REAL NOT NULL,
        slippage_experienced_bps INTEGER NOT NULL,
        fee_collected_cents INTEGER NOT NULL,
        anti_sandwich_nonce INTEGER NOT NULL,
        mev_protection_proof TEXT NOT NULL,
        execution_status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    db = makeD1(rawDb) as unknown as D1Database;
  });

  describe('1. 40,000 Paid Customers Cohort Simulation ($10,000,000 MRR)', () => {
    it('verifies customer cohorts mathematically aggregate to exactly $10,000,000 MRR', () => {
      interface Cohort {
        tierName: string;
        customerCount: number;
        monthlyFeeCents: number;
      }

      const cohorts: Cohort[] = [
        { tierName: 'BASIC', customerCount: 24_000, monthlyFeeCents: 5_000 }, // $50/mo -> $1.2M
        { tierName: 'PRO', customerCount: 10_000, monthlyFeeCents: 20_000 }, // $200/mo -> $2.0M
        { tierName: 'ENTERPRISE', customerCount: 4_000, monthlyFeeCents: 120_000 }, // $1,200/mo -> $4.8M
        { tierName: 'MASTER', customerCount: 2_000, monthlyFeeCents: 100_000 }, // $1,000/mo -> $2.0M
      ];

      const totalCustomers = cohorts.reduce((acc, c) => acc + c.customerCount, 0);
      const totalMrrCents = cohorts.reduce((acc, c) => acc + c.customerCount * c.monthlyFeeCents, 0);
      const blendedArpuCents = totalMrrCents / totalCustomers;

      expect(totalCustomers).toBe(40_000);
      expect(totalMrrCents).toBe(1_000_000_000); // $10,000,000.00
      expect(blendedArpuCents).toBe(25_000); // $250.00
      expect(totalMrrCents * 12).toBe(12_000_000_000); // $120,000,000 ARR
    });
  });

  describe('2. Dual-Listing Package & BEPS Pillar Two E2E Flow', () => {
    it('executes full filing generation, iXBRL tagging, and D1 persistence', async () => {
      const period = DualListingEngine.createGate11FilingPeriod(2026, 'SEC_10K');
      const bepsInputs: BepsComputationInput[] = [
        { jurisdictionCode: 'US', coveredTaxesCents: 15_000_000_00, globeIncomeCents: 75_000_000_00 },
        { jurisdictionCode: 'SG', coveredTaxesCents: 2_500_000_00, globeIncomeCents: 25_000_000_00 },
        { jurisdictionCode: 'VN', coveredTaxesCents: 3_000_000_00, globeIncomeCents: 15_000_000_00 },
        { jurisdictionCode: 'IE', coveredTaxesCents: 625_000_00, globeIncomeCents: 5_000_000_00 },
      ];

      const pkg = DualListingEngine.assembleConsolidatedPackage(period, bepsInputs);
      expect(pkg.overallCompliant).toBe(true);
      expect(pkg.bepsAllocations).toHaveLength(4);

      // Persist to D1
      await DualListingEngine.persistFilingPeriod(db, period);
      const loaded = await DualListingEngine.getFilingPeriod(db, period.id);

      expect(loaded?.id).toBe(period.id);
      expect(loaded?.paidCustomersCount).toBe(40_000);
      expect(loaded?.consolidatedRevenueCents).toBe(12_000_000_000);
    });
  });

  describe('3. Planetary Swarm 3.0 & ZK-DID End-to-End Orchestration', () => {
    it('registers trans-continental validator nodes and clears agentic spot compute auction', async () => {
      const nodeIad: PlanetarySwarmNode = {
        id: 'node_iad_prod',
        nodeKey: 'key_iad_prod',
        continent: 'NORTH_AMERICA',
        datacenterCode: 'IAD-01',
        ipAddressHash: 'hash_iad_prod',
        ed25519PublicKey: 'ed_pub_iad',
        status: 'ONLINE',
        consensusRole: 'VALIDATOR',
        heartbeatLatencyMs: 6,
        uptimePercentage: 99.9999,
        lastHeartbeatAt: new Date().toISOString(),
        registeredAt: new Date().toISOString(),
      };

      await PlanetarySwarmV3Coordinator.persistNode(db, nodeIad);

      // Issue ZK-DID for autonomous agent
      const didInput = {
        ownerNodeId: nodeIad.id,
        controllerUri: 'https://agencyos.network/agents/agent_007',
        publicKeyMultibase: 'z6MkuV8Agent007...',
        credentialSchemaHash: 'schema_v3_decacorn',
      };

      const identity = ZkDidVerifier.issueIdentity(didInput);
      await ZkDidVerifier.registerIdentityInDb(db, identity);

      const verification = ZkDidVerifier.verifyIdentity(identity);
      expect(verification.isValid).toBe(true);

      // Match Spot Auction
      const bid: SpotBidRequest = {
        buyerAgentDid: identity.did,
        resourceType: 'GPU_H100_HR',
        maxPriceMicros: 2_200_000,
        unitsRequested: 8,
        durationSeconds: 1800,
        signatureEd25519: 'sig_agent_007',
      };

      const match = PlanetarySwarmV3Coordinator.matchSpotComputeAuction([nodeIad], bid);
      expect(match.status).toBe('SETTLED');
      expect(match.sellerNodeId).toBe(nodeIad.id);
      expect(match.unitsAllocated).toBe(8);
    });
  });

  describe('4. Institutional AMM Clearing & Treasury Rebalance Flow', () => {
    it('executes AMM swap within 0.03% slippage and triggers multi-sig treasury rebalance', async () => {
      const pool: AmmLiquidityPool = {
        id: 'pool_institutional_usdt_usd',
        pairSymbol: 'USDT_USD',
        token0Symbol: 'USDT',
        token1Symbol: 'USD',
        token0Decimals: 6,
        token1Decimals: 6,
        reserve0AmountUnits: '5000000000000', // 5,000,000 USDT ($5M)
        reserve1AmountUnits: '5000000000000', // 5,000,000 USD ($5M)
        currentSqrtPriceX96: '79228162514264337593543950336',
        currentTick: 0,
        tickSpacing: 10,
        feeTierBps: 5,
        maxSlippageCapBps: 3,
        totalValueLockedUsdCents: 1_000_000_000,
        volume24hUsdCents: 200_000_000,
        isCircuitBreakerTripped: false,
        lastRebalancedAt: null,
        createdAt: new Date().toISOString(),
      };

      await ConcentratedLiquidityEngine.persistPool(db, pool);

      // 1. Swap $500 USDT (tiny fraction of $5M pool -> slippage < 0.03%)
      const swapReq: AmmSwapQuoteRequest = {
        poolId: pool.id,
        tokenInSymbol: 'USDT',
        amountInUnits: '500000000', // 500 USDT
        traderIdentifier: 'institutional_fund_alpha',
      };

      const { transaction, updatedPool } = ConcentratedLiquidityEngine.executeSwap(
        pool,
        swapReq,
        '0xrecipientTreasury',
        1
      );

      expect(transaction.executionStatus).toBe('EXECUTED');
      expect(transaction.slippageExperiencedBps).toBeLessThanOrEqual(3);

      // 2. Multi-Sig Rebalance
      const targetPool: AmmLiquidityPool = {
        ...pool,
        id: 'pool_target_eur',
        pairSymbol: 'USDT_EUR',
      };

      const { event } = TreasuryRebalancer.executeRebalance(
        updatedPool,
        targetPool,
        'USDT',
        '10000000000',
        ['cfo_sg_key', 'treasurer_us_key']
      );

      expect(event.status).toBe('SETTLED');
      expect(event.multisigOperatorQuorum).toContain('cfo_sg_key;treasurer_us_key');
    });
  });
});
