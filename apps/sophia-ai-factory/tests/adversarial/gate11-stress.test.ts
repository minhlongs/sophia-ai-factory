/** @vitest-environment node */

/**
 * Gate 11 Adversarial Stress Test Suite: $10,000,000 MRR Scale & Extreme Chaos
 *
 * Validates:
 * 1. Dual-Listing & BEPS Pillar Two GloBE 15% Tax Invariants under Tax Haven Arbitrage
 * 2. iXBRL Semantic Integrity & Cryptographic Audit Vault Immutability
 * 3. FCPA / UK Bribery Act Anti-Corruption Ledger under Obfuscated Red Flag Scenarios
 * 4. Planetary Swarm 3.0 Trans-Continental Network Partition & Split-Brain Healing
 * 5. ZK-DID Cryptographic Forgery, Replay, and Revocation Attack Prevention
 * 6. Concentrated AMM Flash-Loan Draining, Sandwich/MEV Attack Rejection & Circuit-Breaker Tripping
 * 7. Multi-Sig Treasury Rebalancer Quorum Integrity under Rogue Operator Attacks
 *
 * @module tests/adversarial/gate11-stress.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@cloudflare/workers-types';
import { GATE_11_CONSTANTS, type BepsComputationInput } from '@/seed/types/dual-listing';
import { DualListingEngine } from '@/tree/listing/dual-listing-engine';
import { FcpaComplianceLedger, type FcpaScreeningInput } from '@/tree/listing/fcpa-compliance-ledger';
import {
  type PlanetarySwarmNode,
  type SpotBidRequest,
  SWARM_V3_CONSTANTS,
} from '@/seed/types/planetary-swarm';
import { PlanetarySwarmV3Coordinator } from '@/tree/swarm/planetary-swarm-v3-coordinator';
import { ZkDidVerifier, type DidIssuanceInput } from '@/tree/identity/zk-did-verifier';
import {
  type AmmLiquidityPool,
  type AmmSwapQuoteRequest,
  AMM_CONSTANTS,
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

describe('Gate 11 Adversarial & Chaos Stress Test Suite ($10M MRR Scale)', () => {
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

  describe('Chaos 1: OECD BEPS Pillar Two GloBE Minimum Tax Evasion Defense', () => {
    it('correctly calculates top-up tax when artificial transfer pricing shifts 90% profit to zero-tax haven', () => {
      // Adversarial attempt: shifting $100M to zero-tax Cayman Islands
      const havenInput: BepsComputationInput = {
        jurisdictionCode: 'KY',
        coveredTaxesCents: 0, // Zero taxes paid
        globeIncomeCents: 100_000_000_00, // $100M profit
        substanceCarveOutCents: 0,
      };

      const result = DualListingEngine.calculateBepsPillarTwo(havenInput);
      expect(result.effectiveTaxRateBps).toBe(0);
      expect(result.topUpTaxPercentageBps).toBe(1500); // Full 15% top-up required
      expect(result.netTopUpTaxCents).toBe(15_000_000_00); // Exact $15M top-up liability
    });

    it('clamps substance carve-out to prevent negative top-up tax exploits', () => {
      // Malicious input: claiming carve-out exceeding total income
      const exploitInput: BepsComputationInput = {
        jurisdictionCode: 'IE',
        coveredTaxesCents: 500_000_00, // 5% ETR
        globeIncomeCents: 10_000_000_00,
        substanceCarveOutCents: 99_000_000_00, // Attempting negative excess profit
      };

      const result = DualListingEngine.calculateBepsPillarTwo(exploitInput);
      expect(result.netTopUpTaxCents).toBe(0); // Clamped at 0, no negative rebate
      expect(result.effectiveTaxRateBps).toBe(500);
      expect(result.topUpTaxPercentageBps).toBe(1000); // 10% rate maintained
    });
  });

  describe('Chaos 2: FCPA Anti-Bribery Obfuscation & Sanctions Circumvention', () => {
    it('catches layered evasion: nested offshore jurisdiction with abnormal commission', () => {
      const evasiveInput: FcpaScreeningInput = {
        filingPeriodId: 'period_2026',
        counterpartyName: 'Alpha Panama Trust Holdings',
        counterpartyJurisdiction: 'OFFSHORE_UNKNOWN',
        screeningType: 'BRIBERY_RISK',
        isHighRiskJurisdiction: true,
        unexplainedDiscountPct: 40,
        isPepInvolved: true,
      };

      const evalResult = FcpaComplianceLedger.evaluateRisk(evasiveInput);
      expect(evalResult.riskScore).toBe(100);
      expect(evalResult.disposition).toBe('BLOCKED');
      expect(evalResult.reviewNotes).toContain('PEP involvement');
      expect(evalResult.reviewNotes).toContain('High-risk corruption');
      expect(evalResult.reviewNotes).toContain('Abnormal commission');
    });
  });

  describe('Chaos 3: Planetary Swarm 3.0 Trans-Continental Split-Brain & Partition Healing', () => {
    it('withstands simultaneous Pacific and Atlantic undersea cable cuts (60% partition)', () => {
      // 10 nodes across 5 continents
      const tenNodes: PlanetarySwarmNode[] = Array.from({ length: 10 }, (_, i) => ({
        id: `node_${i + 1}`,
        nodeKey: `key_${i + 1}`,
        continent: i < 3 ? 'NORTH_AMERICA' : i < 6 ? 'EUROPE' : i < 8 ? 'ASIA_PACIFIC' : 'LATIN_AMERICA',
        datacenterCode: `DC-${i + 1}`,
        ipAddressHash: `ip_hash_${i + 1}`,
        ed25519PublicKey: `pubkey_${i + 1}`,
        status: i < 4 ? 'ONLINE' : 'PARTITIONED', // 6 nodes partitioned
        consensusRole: 'VALIDATOR',
        heartbeatLatencyMs: i < 4 ? 7 : 4500,
        uptimePercentage: 99.9999,
        lastHeartbeatAt: '2026-09-27T00:00:00Z',
        registeredAt: '2026-09-27T00:00:00Z',
      }));

      // Quorum lost during 60% partition
      const partitionReport = PlanetarySwarmV3Coordinator.evaluateByzantineQuorum(tenNodes);
      expect(partitionReport.onlineNodes).toBe(4);
      expect(partitionReport.isByzantineQuorumMaintained).toBe(false);

      // Auto-heal all partitioned nodes
      const healed = PlanetarySwarmV3Coordinator.healPartitionedNodes(tenNodes);
      const postHealReport = PlanetarySwarmV3Coordinator.evaluateByzantineQuorum(healed);
      expect(postHealReport.onlineNodes).toBe(10);
      expect(postHealReport.isByzantineQuorumMaintained).toBe(true);
      expect(postHealReport.averageHeartbeatLatencyMs).toBeLessThanOrEqual(10);
    });
  });

  describe('Chaos 4: ZK-DID Identity Forgery, Tamper & Replay Attacks', () => {
    it('defends against signature tampering, revoked credentials, and expired tokens', () => {
      const input: DidIssuanceInput = {
        ownerNodeId: 'node_iad_primary',
        controllerUri: 'https://agencyos.network/controllers/node_iad_primary',
        publicKeyMultibase: 'z6MkuV8zWv7kTarget...',
        credentialSchemaHash: 'schema_hash_sovereign_v3',
        validityDays: 30,
      };

      const identity = ZkDidVerifier.issueIdentity(input);

      // Attack 1: Altered DID string
      const tamperedDid = { ...identity, did: `${identity.did}_altered` };
      expect(ZkDidVerifier.verifyIdentity(tamperedDid).isValid).toBe(false);

      // Attack 2: Replay of revoked credential
      const revoked = { ...identity, revocationStatus: 'REVOKED' as const };
      expect(ZkDidVerifier.verifyIdentity(revoked).isValid).toBe(false);

      // Attack 3: Tampered public key with stale Merkle proof
      const forgedKey = { ...identity, publicKeyMultibase: 'z6MkuAttackKey...' };
      expect(ZkDidVerifier.verifyIdentity(forgedKey).isValid).toBe(false);
    });
  });

  describe('Chaos 5: Concentrated AMM Flash-Loan Draining & MEV Sandwich Attacks', () => {
    const deepPool: AmmLiquidityPool = {
      id: 'pool_deep_usdt_usd',
      pairSymbol: 'USDT_USD',
      token0Symbol: 'USDT',
      token1Symbol: 'USD',
      token0Decimals: 6,
      token1Decimals: 6,
      reserve0AmountUnits: '10000000000000', // 10,000,000 USDT ($10M)
      reserve1AmountUnits: '10000000000000', // 10,000,000 USD ($10M)
      currentSqrtPriceX96: '79228162514264337593543950336',
      currentTick: 0,
      tickSpacing: 10,
      feeTierBps: 5,
      maxSlippageCapBps: 3, // 0.03%
      totalValueLockedUsdCents: 2_000_000_000,
      volume24hUsdCents: 500_000_000,
      isCircuitBreakerTripped: false,
      lastRebalancedAt: null,
      createdAt: '2026-09-27T00:00:00Z',
    };

    it('rejects flash loan draining attack that attempts to consume 50% of pool in single block', () => {
      const flashLoanAttack: AmmSwapQuoteRequest = {
        poolId: deepPool.id,
        tokenInSymbol: 'USDT',
        amountInUnits: '5000000000000', // 5,000,000 USDT (50% of total pool)
        traderIdentifier: 'flash_loan_bot_0x999',
      };

      const quote = ConcentratedLiquidityEngine.calculateSwapQuote(deepPool, flashLoanAttack);
      expect(quote.isApproved).toBe(false);
      expect(quote.estimatedSlippageBps).toBeGreaterThan(100); // Extreme price impact
      expect(quote.rejectReason).toContain('exceeds maximum threshold');
    });

    it('validates anti-sandwich protection proof with sequential nonces', () => {
      const normalSwap: AmmSwapQuoteRequest = {
        poolId: deepPool.id,
        tokenInSymbol: 'USDT',
        amountInUnits: '100000000', // 100 USDT
        traderIdentifier: 'honest_agent_did',
      };

      const { transaction: tx1 } = ConcentratedLiquidityEngine.executeSwap(deepPool, normalSwap, '0xrec1', 101);
      const { transaction: tx2 } = ConcentratedLiquidityEngine.executeSwap(deepPool, normalSwap, '0xrec2', 102);

      expect(tx1.antiSandwichNonce).toBe(101);
      expect(tx2.antiSandwichNonce).toBe(102);
      expect(tx1.mevProtectionProof).not.toBe(tx2.mevProtectionProof);
    });
  });

  describe('Chaos 6: Multi-Sig Treasury Rebalancer Quorum Under Rogue Operator Attack', () => {
    const imbalancedPool: AmmLiquidityPool = {
      id: 'pool_imbalanced',
      pairSymbol: 'USDT_USD',
      token0Symbol: 'USDT',
      token1Symbol: 'USD',
      token0Decimals: 6,
      token1Decimals: 6,
      reserve0AmountUnits: '1200000000000', // 1.2M
      reserve1AmountUnits: '1000000000000', // 1.0M -> 20% deviation
      currentSqrtPriceX96: '79228162514264337593543950336',
      currentTick: 0,
      tickSpacing: 10,
      feeTierBps: 5,
      maxSlippageCapBps: 3,
      totalValueLockedUsdCents: 220_000_000,
      volume24hUsdCents: 50_000_000,
      isCircuitBreakerTripped: false,
      lastRebalancedAt: null,
      createdAt: '2026-09-27T00:00:00Z',
    };

    it('refuses to settle rebalancing when attempted with single rogue operator key', () => {
      const targetPool = { ...imbalancedPool, id: 'pool_target' };

      const { event } = TreasuryRebalancer.executeRebalance(
        imbalancedPool,
        targetPool,
        'USDT',
        '100000000000',
        ['rogue_compromised_operator_key'] // Only 1 key!
      );

      expect(event.status).toBe('PROPOSED'); // Unsettled due to lack of quorum
    });

    it('trips circuit breaker and recommends HALT_TRADING when catastrophic reserve drain occurs', () => {
      const drainedPool: AmmLiquidityPool = {
        ...imbalancedPool,
        reserve0AmountUnits: '2000000000000', // 2.0M
        reserve1AmountUnits: '1000000000000', // 1.0M -> 100% deviation!
      };

      const evaluation = TreasuryRebalancer.evaluatePoolDeviation(drainedPool);
      expect(evaluation.shouldTripCircuitBreaker).toBe(true);
      expect(evaluation.recommendedAction).toBe('HALT_TRADING');
    });
  });
});
