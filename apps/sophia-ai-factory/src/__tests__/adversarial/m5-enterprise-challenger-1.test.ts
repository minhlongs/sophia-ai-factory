/**
 * M5 Enterprise Challenger 1: Empirical Adversarial Stress Test Suite
 *
 * Scope:
 * 1. BANT 4-Factor Scoring Boundaries & Edge Cases:
 *    - Strict [0, 25] bounds per factor, strict [0, 100] total score.
 *    - Deterministic Hot (>= 75) / Warm (50–74) / Cold (< 50) funnel thresholds.
 *    - 500-iteration random fuzzing with extreme negative, zero, overflow, and malformed inputs.
 *    - Corporate vs free webmail domain discrimination, malformed email edge cases.
 * 2. Volume Discount Calculator Boundary Conditions:
 *    - Strict capacity rejection below 50,000 MCU (49,999 MCU, 0, negative, NaN).
 *    - Exact bracket threshold transitions: 50K (20%), 100K (30%), 250K (45%), 500K (60%), >500K (60%).
 *    - Integer cent precision for 17% annual savings without penny leakage across all tiers.
 * 3. Contract Digital Signature Tamper Testing:
 *    - RFC-8785 JSON canonicalization scheme invariance under key reordering.
 *    - 1-byte tamper sensitivity across all 12 canonical contract payload fields.
 *    - Cryptographic HMAC forgery, altered signature hashes, and mismatched signing secrets.
 * 4. GPU Mesh Concurrency Quotas & Capacity Enforcement:
 *    - Saturation of 20 concurrent workers: job 21 must be rejected with CONCURRENCY_LIMIT_EXCEEDED.
 *    - Dynamic lane release upon completion freeing slot for subsequent jobs.
 *    - Monthly MCU allocation boundary and capacity exhaustion rejection.
 *    - Priority score elevation to 300 and reservation lifecycle status validation.
 *
 * @vitest-environment node
 * @module __tests__/adversarial/m5-enterprise-challenger-1.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@/seed/db/client';

// Target 1: BANT Scoring
import {
  calculateBantScore,
  scoreBudget,
  scoreAuthority,
  scoreNeed,
  scoreTimeline,
  classifyFunnelTier,
  isCorporateEmailDomain,
} from '@/tree/sales/bant-scoring-service';
import type { BantScoreInput } from '@/seed/types/enterprise-deal';

// Target 2: Volume Discount Calculator
import {
  calculateEnterpriseVolumeDiscount,
  getVolumeDiscountBracket,
  calculateOverageUnitPriceCents,
} from '@/tree/contracts/volume-discount-calculator';
import {
  MIN_ENTERPRISE_MCU,
  MAX_ENTERPRISE_MCU,
  BASE_ENTERPRISE_MCU_PRICE_CENTS,
  ANNUAL_COMMITMENT_DISCOUNT_PERCENT,
  type EnterpriseContract,
  type ContractSignablePayload,
} from '@/seed/types/enterprise-contracts';

// Target 3: Contract Digital Signatures
import {
  canonicalizeJson,
  computeContractHash,
  generateCustomerSignature,
  verifyCustomerSignature,
  generatePlatformSignature,
  verifyPlatformSignature,
  extractSignablePayload,
  verifyContractIntegrity,
} from '@/tree/contracts/contract-signature-verifier';

// Target 4: GPU Mesh Dedicated Lane Allocator
import {
  allocateDedicatedLane,
  releaseDedicatedLane,
  validateReservationCapacity,
  getReservationActiveJobCount,
  getReservationById,
} from '@/tree/gpu-mesh/dedicated-lane-allocator';
import type { EnterpriseGpuReservation } from '@/seed/types/gpu-mesh';

// ── In-Memory SQLite D1 Test Helper ──────────────────────────────────────────

function createTestD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enterprise_gpu_reservations (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      deal_id TEXT,
      contract_id TEXT,
      lane_id TEXT NOT NULL UNIQUE,
      primary_region TEXT NOT NULL DEFAULT 'apac',
      fallback_regions TEXT NOT NULL DEFAULT '["us", "eu"]',
      reserved_units INTEGER NOT NULL DEFAULT 5,
      concurrency_limit INTEGER NOT NULL DEFAULT 20,
      mcu_monthly_allocation INTEGER NOT NULL DEFAULT 100000,
      mcu_consumed INTEGER NOT NULL DEFAULT 0,
      priority_score INTEGER NOT NULL DEFAULT 300,
      status TEXT NOT NULL DEFAULT 'active',
      sla_uptime_target REAL NOT NULL DEFAULT 0.999,
      sla_p95_latency_ms INTEGER NOT NULL DEFAULT 1500,
      sla_degradation_window_secs INTEGER NOT NULL DEFAULT 900,
      sla_refund_pct REAL NOT NULL DEFAULT 10.0,
      allocated_providers TEXT NOT NULL DEFAULT '["fal", "runpod", "mekong"]',
      active_from INTEGER NOT NULL,
      active_until INTEGER NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS video_render_jobs (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      subaccount_id TEXT,
      lane TEXT NOT NULL DEFAULT 'standard',
      priority_score INTEGER NOT NULL DEFAULT 10,
      status TEXT NOT NULL DEFAULT 'queued',
      tier TEXT NOT NULL,
      payload TEXT NOT NULL,
      result_url TEXT,
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      leased_by TEXT,
      leased_until INTEGER,
      provider TEXT,
      dlq_reason TEXT,
      reservation_id TEXT,
      target_region TEXT DEFAULT 'apac',
      executed_region TEXT,
      failover_hops INTEGER DEFAULT 0,
      execution_latency_ms INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      return {
        bind(...vals: unknown[]) {
          bound = vals;
          return this;
        },
        async run(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const res = stmt.run(...params);
          return {
            success: true,
            meta: { changes: res.changes, duration: 1 },
            changes: res.changes,
            lastInsertRowid: res.lastInsertRowid,
          };
        },
        async all(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const results = stmt.all(...params);
          return {
            results,
            meta: { changes: 0, duration: 1 },
          };
        },
        async first(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...params);
          return row ?? null;
        },
      };
    },
  } as unknown as D1Database;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. BANT SCORING & ENRICHMENT BOUNDARIES
// ─────────────────────────────────────────────────────────────────────────────

describe('Challenger 1: BANT Scoring & Funnel Thresholds Stress Testing', () => {
  describe('Funnel Classification Determinism (Hot >= 75, Warm 50-74, Cold < 50)', () => {
    it('accurately classifies the exact boundary points 0, 49, 50, 74, 75, 100', () => {
      expect(classifyFunnelTier(0)).toBe('cold');
      expect(classifyFunnelTier(49)).toBe('cold');
      expect(classifyFunnelTier(49.9)).toBe('cold');
      expect(classifyFunnelTier(50)).toBe('warm');
      expect(classifyFunnelTier(50.1)).toBe('warm');
      expect(classifyFunnelTier(74)).toBe('warm');
      expect(classifyFunnelTier(74.9)).toBe('warm');
      expect(classifyFunnelTier(75)).toBe('hot');
      expect(classifyFunnelTier(75.1)).toBe('hot');
      expect(classifyFunnelTier(100)).toBe('hot');
    });

    it('determines the 74 vs 75 threshold through realistic compound score inputs', () => {
      // Warm score setup: Budget 20 + Authority 22 + Need 20 + Timeline 12 = 74
      const warmInput: BantScoreInput = {
        statedBudgetArr: 60_000, // -> 20
        jobTitle: 'Founder', // -> 22
        isCorporateEmail: false, // -> no +3 bonus
        needsHighVolumeSyndication: true, // +7
        needsApacDubbing: true, // +6
        needsDedicatedGpuLane: true, // +5
        statedBottleneckOrPainPoint: 'Expensive video production', // +3 -> Need = 21, wait: 7+6+5+3=21
        timeframe: '3_to_6_months', // -> 12
      };
      // Let's adjust need so sum is exactly 74
      const warmRes = calculateBantScore({
        ...warmInput,
        needsDedicatedGpuLane: false, // Need: 7+6+3 = 16. Total: 20 + 22 + 16 + 12 = 70 (warm)
      });
      expect(warmRes.pipelineTier).toBe('warm');

      // Now construct exact 74
      // Budget: 20 (stated 50K), Authority: 22 (CEO free webmail), Need: 20 (7+6+5+0+2 tag), Timeline: 12 (3_to_6)
      const exact74 = calculateBantScore({
        statedBudgetArr: 50_000, // 20
        jobTitle: 'CEO', // 22 (free email)
        isCorporateEmail: false,
        needsHighVolumeSyndication: true, // 7
        needsApacDubbing: true, // 6
        needsDedicatedGpuLane: true, // 5
        needTags: ['video'], // score=18 < 15 is false, so tag boost not applied -> Need = 18.
        // Need: 7 + 6 + 5 = 18. Total: 20 + 22 + 18 + 12 = 72
        timeframe: '1_to_3_months', // 20. Total: 20 + 22 + 18 + 20 = 80 (hot)
      });
      expect(exact74.totalScore).toBe(80);
      expect(exact74.pipelineTier).toBe('hot');

      // Test exactly 74 by crafting factor scores:
      // Budget: 16 (arr: 25_000)
      // Authority: 22 (jobTitle: 'CEO', free email)
      // Need: 16 (7 syndication + 6 apac + 3 bottleneck)
      // Timeline: 20 (1_to_3_months)
      // 16 + 22 + 16 + 20 = 74!
      const lead74 = calculateBantScore({
        statedBudgetArr: 25_000,
        jobTitle: 'CEO',
        isCorporateEmail: false,
        needsHighVolumeSyndication: true,
        needsApacDubbing: true,
        statedBottleneckOrPainPoint: 'We spend too much time on manual editing',
        timeframe: '1_to_3_months',
      });
      expect(lead74.totalScore).toBe(74);
      expect(lead74.pipelineTier).toBe('warm');

      // Now add corporate domain (+3 to authority, 22->25 => total 77 => hot)
      const lead77 = calculateBantScore({
        statedBudgetArr: 25_000,
        jobTitle: 'CEO',
        isCorporateEmail: true,
        needsHighVolumeSyndication: true,
        needsApacDubbing: true,
        statedBottleneckOrPainPoint: 'We spend too much time on manual editing',
        timeframe: '1_to_3_months',
      });
      expect(lead77.totalScore).toBe(77);
      expect(lead77.pipelineTier).toBe('hot');

      // Test exactly 75:
      // Budget: 20 (stated 50_000)
      // Authority: 10 (jobTitle: 'Manager', free email)
      // Need: 25 (all 4 flags + bottleneck = 7+6+5+4+3=25)
      // Timeline: 20 (1_to_3_months)
      // 20 + 10 + 25 + 20 = 75!
      const lead75 = calculateBantScore({
        statedBudgetArr: 50_000,
        jobTitle: 'Manager',
        isCorporateEmail: false,
        needsHighVolumeSyndication: true,
        needsApacDubbing: true,
        needsDedicatedGpuLane: true,
        needsCustomApiOrWhiteLabel: true,
        statedBottleneckOrPainPoint: 'Scaling video across multiple languages is too slow',
        timeframe: '1_to_3_months',
      });
      expect(lead75.totalScore).toBe(75);
      expect(lead75.pipelineTier).toBe('hot');
    });

    it('determines the 49 vs 50 threshold through compound inputs', () => {
      // Exactly 49:
      // Budget: 12 (stated 10_000)
      // Authority: 10 (Manager, free email)
      // Need: 7 (high volume syndication only)
      // Timeline: 20 (1_to_3_months)
      // 12 + 10 + 7 + 20 = 49!
      const lead49 = calculateBantScore({
        statedBudgetArr: 10_000,
        jobTitle: 'Manager',
        isCorporateEmail: false,
        needsHighVolumeSyndication: true,
        timeframe: '1_to_3_months',
      });
      expect(lead49.totalScore).toBe(49);
      expect(lead49.pipelineTier).toBe('cold');

      // Exactly 50: add corporate email bonus (+3 to authority => 10->13, total 52)
      // Or change jobTitle to Director (15) without corporate email: 12 + 15 + 7 + 20 = 54
      // Let's craft exactly 50:
      // Budget: 16 (25_000)
      // Authority: 10 (Manager)
      // Need: 4 (white label only: 4)
      // Timeline: 20 (1_to_3_months)
      // 16 + 10 + 4 + 20 = 50!
      const lead50 = calculateBantScore({
        statedBudgetArr: 25_000,
        jobTitle: 'Manager',
        isCorporateEmail: false,
        needsCustomApiOrWhiteLabel: true,
        timeframe: '1_to_3_months',
      });
      expect(lead50.totalScore).toBe(50);
      expect(lead50.pipelineTier).toBe('warm');
    });
  });

  describe('Factor Bounds Invariance & Random Fuzzing (0-25 per factor, 0-100 total)', () => {
    it('strictly satisfies 0 <= factor <= 25 and 0 <= total <= 100 on 500 fuzzed inputs', () => {
      const budgetOptions = [-100000, -1, 0, 1, 9999, 10000, 24999, 25000, 49999, 50000, 99999, 100000, 5000000];
      const mcuOptions = [-50000, 0, 1, 49999, 50000, 99999, 100000, 249999, 250000, 1000000];
      const revOptions = ['', '<1M', '1M-10M', '10M-50M', '>50M', 'UNKNOWN_GARBAGE', 'null'];
      const emailOptions = [
        '',
        'user@gmail.com',
        'director@agency.co',
        'malformed',
        '@no-local.com',
        'trailing@',
        'foo.bar@custom-domain.enterprise.io',
      ];
      const titleOptions = [
        '',
        'CEO',
        'Chief Technology Officer',
        'Vice President of Growth',
        'Director of Marketing',
        'Team Lead',
        'Video Editor Specialist',
        'Intern',
        '???!!###',
      ];
      const timelineOptions = [
        '',
        'immediate',
        'asap',
        '1_to_3_months',
        '3_to_6_months',
        '6_to_12_months',
        'exploring',
        'someday in 2030',
      ];

      for (let i = 0; i < 500; i++) {
        const input: BantScoreInput = {
          statedBudgetArr: budgetOptions[i % budgetOptions.length],
          statedMonthlyMcu: mcuOptions[(i * 3) % mcuOptions.length],
          companyRevenueRange: revOptions[(i * 7) % revOptions.length],
          leadEmail: emailOptions[(i * 2) % emailOptions.length],
          jobTitle: titleOptions[(i * 5) % titleOptions.length],
          timeframe: timelineOptions[(i * 11) % timelineOptions.length],
          needsHighVolumeSyndication: i % 2 === 0,
          needsApacDubbing: i % 3 === 0,
          needsDedicatedGpuLane: i % 5 === 0,
          needsCustomApiOrWhiteLabel: i % 7 === 0,
          statedBottleneckOrPainPoint: i % 4 === 0 ? 'Extremely long bottleneck description detailing high rendering costs' : '',
          needTags: i % 3 === 0 ? ['tag1', 'tag2', 'tag3'] : [],
        };

        const result = calculateBantScore(input);

        // Invariant 1: Individual factor bounds
        expect(result.budgetScore).toBeGreaterThanOrEqual(0);
        expect(result.budgetScore).toBeLessThanOrEqual(25);

        expect(result.authorityScore).toBeGreaterThanOrEqual(0);
        expect(result.authorityScore).toBeLessThanOrEqual(25);

        expect(result.needScore).toBeGreaterThanOrEqual(0);
        expect(result.needScore).toBeLessThanOrEqual(25);

        expect(result.timelineScore).toBeGreaterThanOrEqual(0);
        expect(result.timelineScore).toBeLessThanOrEqual(25);

        // Invariant 2: Total score equals sum of parts
        const sum = result.budgetScore + result.authorityScore + result.needScore + result.timelineScore;
        expect(result.totalScore).toBe(sum);

        // Invariant 3: Total score bounded in [0, 100]
        expect(result.totalScore).toBeGreaterThanOrEqual(0);
        expect(result.totalScore).toBeLessThanOrEqual(100);

        // Invariant 4: Classification matches threshold
        if (result.totalScore >= 75) {
          expect(result.pipelineTier).toBe('hot');
        } else if (result.totalScore >= 50) {
          expect(result.pipelineTier).toBe('warm');
        } else {
          expect(result.pipelineTier).toBe('cold');
        }
      }
    });
  });

  describe('Corporate Email Domain Validation & Adversarial Inputs', () => {
    it('correctly filters all known consumer webmail domains', () => {
      const freeProviders = [
        'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
        'live.com', 'icloud.com', 'proton.me', 'protonmail.com',
        'zoho.com', 'aol.com', 'mail.com', 'gmx.com', 'yandex.com',
      ];

      for (const domain of freeProviders) {
        expect(isCorporateEmailDomain(`test@${domain}`)).toBe(false);
        expect(isCorporateEmailDomain(`TEST@${domain.toUpperCase()}`)).toBe(false);
      }
    });

    it('correctly identifies valid corporate and government domains', () => {
      const corporate = [
        'enterprise.com',
        'agency.vn',
        'tokyo-media.co.jp',
        'subdomain.corp.global.net',
        'ai-factory.network',
      ];

      for (const domain of corporate) {
        expect(isCorporateEmailDomain(`founder@${domain}`)).toBe(true);
      }
    });

    it('handles malformed, empty, and adversarial email strings without throwing', () => {
      expect(isCorporateEmailDomain('')).toBe(false);
      expect(isCorporateEmailDomain(undefined)).toBe(false);
      expect(isCorporateEmailDomain('no-at-symbol.com')).toBe(false);
      expect(isCorporateEmailDomain('@')).toBe(false);
      expect(isCorporateEmailDomain('user@')).toBe(false);
      expect(isCorporateEmailDomain('   ')).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. VOLUME DISCOUNT CALCULATOR BOUNDARY CONDITIONS
// ─────────────────────────────────────────────────────────────────────────────

describe('Challenger 1: Volume Discount Calculator Boundary Conditions', () => {
  describe('Capacity Rejection Below 50,000 MCU', () => {
    it('throws explicit error for capacity 49,999 MCU', () => {
      expect(() => getVolumeDiscountBracket(49_999)).toThrow(
        /Invalid enterprise MCU capacity: 49999.*Minimum enterprise commitment is 50,000/
      );
      expect(() => calculateEnterpriseVolumeDiscount(49_999)).toThrow(
        /Invalid enterprise MCU capacity: 49999/
      );
    });

    it('throws explicit error for 0, negative values, and non-finite inputs', () => {
      expect(() => getVolumeDiscountBracket(0)).toThrow();
      expect(() => getVolumeDiscountBracket(-1)).toThrow();
      expect(() => getVolumeDiscountBracket(-50_000)).toThrow();
      expect(() => getVolumeDiscountBracket(NaN)).toThrow();
      expect(() => getVolumeDiscountBracket(Infinity)).toThrow();
      expect(() => getVolumeDiscountBracket(-Infinity)).toThrow();
    });

    it('throws error for 49,999.99 (even if rounded up float)', () => {
      expect(() => getVolumeDiscountBracket(49_999.99)).toThrow();
    });
  });

  describe('Capacity Bracket Boundaries & Effective Unit Pricing', () => {
    it('assigns SCALE_50K (20% discount, 4.0 cents) at exact boundary 50,000 to 99,999 MCU', () => {
      const bMin = getVolumeDiscountBracket(50_000);
      expect(bMin.code).toBe('SCALE_50K');
      expect(bMin.discountPercent).toBe(0.20);
      expect(bMin.effectivePricePerMcuCents).toBe(4.0);

      const bMax = getVolumeDiscountBracket(99_999);
      expect(bMax.code).toBe('SCALE_50K');
      expect(bMax.discountPercent).toBe(0.20);
      expect(bMax.effectivePricePerMcuCents).toBe(4.0);
    });

    it('assigns SCALE_100K (30% discount, 3.5 cents) at exact boundary 100,000 to 249,999 MCU', () => {
      const bMin = getVolumeDiscountBracket(100_000);
      expect(bMin.code).toBe('SCALE_100K');
      expect(bMin.discountPercent).toBe(0.30);
      expect(bMin.effectivePricePerMcuCents).toBe(3.5);

      const bMax = getVolumeDiscountBracket(249_999);
      expect(bMax.code).toBe('SCALE_100K');
      expect(bMax.discountPercent).toBe(0.30);
      expect(bMax.effectivePricePerMcuCents).toBe(3.5);
    });

    it('assigns SCALE_250K (45% discount, 2.75 cents) at exact boundary 250,000 to 499,999 MCU', () => {
      const bMin = getVolumeDiscountBracket(250_000);
      expect(bMin.code).toBe('SCALE_250K');
      expect(bMin.discountPercent).toBe(0.45);
      expect(bMin.effectivePricePerMcuCents).toBe(2.75);

      const bMax = getVolumeDiscountBracket(499_999);
      expect(bMax.code).toBe('SCALE_250K');
      expect(bMax.discountPercent).toBe(0.45);
      expect(bMax.effectivePricePerMcuCents).toBe(2.75);
    });

    it('assigns SCALE_500K (60% discount, 2.0 cents) at exact boundary 500,000 and above', () => {
      const bMin = getVolumeDiscountBracket(500_000);
      expect(bMin.code).toBe('SCALE_500K');
      expect(bMin.discountPercent).toBe(0.60);
      expect(bMin.effectivePricePerMcuCents).toBe(2.0);

      const bNext = getVolumeDiscountBracket(500_001);
      expect(bNext.code).toBe('SCALE_500K');
      expect(bNext.discountPercent).toBe(0.60);
      expect(bNext.effectivePricePerMcuCents).toBe(2.0);

      const bMega = getVolumeDiscountBracket(5_000_000);
      expect(bMega.code).toBe('SCALE_500K');
      expect(bMega.discountPercent).toBe(0.60);
      expect(bMega.effectivePricePerMcuCents).toBe(2.0);
    });
  });

  describe('17% Annual Savings Math & Zero-Leakage Integer Cent Accuracy', () => {
    it('verifies exact integer cent calculations and zero penny leakage across all volume tiers', () => {
      const testVolumes = [
        50_000, 75_000, 99_999,
        100_000, 150_000, 249_999,
        250_000, 350_000, 499_999,
        500_000, 500_001, 1_000_000,
      ];

      for (const mcu of testVolumes) {
        const annual = calculateEnterpriseVolumeDiscount(mcu, 'annual');
        const monthly = calculateEnterpriseVolumeDiscount(mcu, 'monthly');

        // Integer cents invariants
        expect(Number.isInteger(annual.monthlyCommitmentCents)).toBe(true);
        expect(Number.isInteger(annual.annualCommitmentCents)).toBe(true);
        expect(Number.isInteger(annual.annualSavingsCents)).toBe(true);

        // Monthly commitment matches unit price times capacity
        const expectedMonthlyCents = Math.round(Math.floor(mcu) * annual.unitPricePerMcuCents);
        expect(annual.monthlyCommitmentCents).toBe(expectedMonthlyCents);
        expect(monthly.monthlyCommitmentCents).toBe(expectedMonthlyCents);

        // Full annualized value
        const annualizedFullCents = expectedMonthlyCents * 12;

        // Invariant: Annual commitment + savings must EXACTLY equal full annualized value (zero cent drift)
        expect(annual.annualCommitmentCents + annual.annualSavingsCents).toBe(annualizedFullCents);

        // Savings percentage verification: savings must match Math.round(full * 0.17)
        const expectedSavings = Math.round(annualizedFullCents * 0.17);
        expect(annual.annualSavingsCents).toBe(expectedSavings);

        // For monthly cycle, annualSavingsCents is 0 and commitment is annualizedFull
        expect(monthly.annualSavingsCents).toBe(0);
        expect(monthly.annualCommitmentCents).toBe(annualizedFullCents);
      }
    });

    it('verifies concrete benchmark values for canonical enterprise tiers', () => {
      // 1. Tier 50K (SCALE_50K: 4.0c)
      // Monthly: 50,000 * $0.04 = $2,000 (200,000 cents)
      // Annual Full: $2,000 * 12 = $24,000 (2,400,000 cents)
      // 17% savings: $24,000 * 0.17 = $4,080 (408,000 cents)
      // Annual Net: $24,000 - $4,080 = $19,920 (1,992,000 cents)
      const res50k = calculateEnterpriseVolumeDiscount(50_000, 'annual');
      expect(res50k.monthlyCommitmentCents).toBe(200_000);
      expect(res50k.monthlyCommitmentUsd).toBe(2000.0);
      expect(res50k.annualSavingsCents).toBe(408_000);
      expect(res50k.annualCommitmentCents).toBe(1_992_000);
      expect(res50k.annualCommitmentUsd).toBe(19920.0);
      expect(res50k.effectiveRateDisplayUsd).toBe('$0.0400');

      // 2. Tier 100K (SCALE_100K: 3.5c)
      // Monthly: 100,000 * $0.035 = $3,500 (350,000 cents)
      // Annual Full: $3,500 * 12 = $42,000 (4,200,000 cents)
      // 17% savings: $42,000 * 0.17 = $7,140 (714,000 cents)
      // Annual Net: $42,000 - $7,140 = $34,860 (3,486,000 cents)
      const res100k = calculateEnterpriseVolumeDiscount(100_000, 'annual');
      expect(res100k.monthlyCommitmentCents).toBe(350_000);
      expect(res100k.annualSavingsCents).toBe(714_000);
      expect(res100k.annualCommitmentCents).toBe(3_486_000);
      expect(res100k.effectiveRateDisplayUsd).toBe('$0.0350');

      // 3. Tier 500K (SCALE_500K: 2.0c)
      // Monthly: 500,000 * $0.02 = $10,000 (1,000,000 cents)
      // Annual Full: $10,000 * 12 = $120,000 (12,000,000 cents)
      // 17% savings: $120,000 * 0.17 = $20,400 (2,040,000 cents)
      // Annual Net: $120,000 - $20,400 = $99,600 (9,960,000 cents)
      const res500k = calculateEnterpriseVolumeDiscount(500_000, 'annual');
      expect(res500k.monthlyCommitmentCents).toBe(1_000_000);
      expect(res500k.annualSavingsCents).toBe(2_040_000);
      expect(res500k.annualCommitmentCents).toBe(9_960_000);
      expect(res500k.effectiveRateDisplayUsd).toBe('$0.0200');
    });

    it('guarantees burst overage unit price matches contracted tier', () => {
      expect(calculateOverageUnitPriceCents(50_000)).toBe(4.0);
      expect(calculateOverageUnitPriceCents(100_000)).toBe(3.5);
      expect(calculateOverageUnitPriceCents(250_000)).toBe(2.75);
      expect(calculateOverageUnitPriceCents(500_000)).toBe(2.0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. CONTRACT DIGITAL SIGNATURE TAMPER TEST
// ─────────────────────────────────────────────────────────────────────────────

describe('Challenger 1: Contract Digital Signature Tamper Adversarial Verification', () => {
  const CUSTOMER_SECRET = 'customer-enterprise-secret-key-salt-987';
  const PLATFORM_SECRET = 'platform-signing-authority-key-salt-456';

  async function createValidSignedContract(): Promise<EnterpriseContract> {
    const payload: ContractSignablePayload = {
      contractNumber: 'CNT-2026-ENT-001',
      orgId: 'org_enterprise_corp',
      mcuCapacityMonthly: 100_000,
      slaUptimePercent: 99.9,
      billingCycle: 'annual',
      unitPricePerMcuCents: 3.5,
      monthlyCommitmentCents: 350_000,
      annualCommitmentCents: 3_486_000,
      currency: 'USD',
      effectiveDate: '2026-10-01',
      expirationDate: '2027-10-01',
      termsVersion: '2026.1-ENTERPRISE-SLA',
    };

    const contractSha256 = await computeContractHash(payload);
    const signerEmail = 'authorized.signatory@enterprisecorp.com';
    const signerTimestamp = 1760000000;

    const customerSignatureHash = await generateCustomerSignature(
      contractSha256,
      { email: signerEmail, timestamp: signerTimestamp },
      CUSTOMER_SECRET,
    );

    const platformSignatureHash = await generatePlatformSignature(
      contractSha256,
      customerSignatureHash,
      PLATFORM_SECRET,
    );

    return {
      id: 'contract_test_1',
      orgId: payload.orgId,
      contractNumber: payload.contractNumber,
      status: 'signed',
      slaUptimePercent: payload.slaUptimePercent,
      mcuCapacityMonthly: payload.mcuCapacityMonthly,
      billingCycle: payload.billingCycle,
      unitPricePerMcuCents: payload.unitPricePerMcuCents,
      volumeDiscountPercent: 0.30,
      monthlyCommitmentCents: payload.monthlyCommitmentCents,
      annualCommitmentCents: payload.annualCommitmentCents,
      currency: payload.currency,
      contractSha256,
      termsVersion: payload.termsVersion,
      customerSignerName: 'Jane Doe',
      customerSignerEmail: signerEmail,
      customerSignerTitle: 'Chief Technology Officer',
      customerSignedAt: signerTimestamp,
      customerSignatureHash,
      platformSignatureHash,
      platformSignedAt: signerTimestamp + 5,
      effectiveDate: payload.effectiveDate,
      expirationDate: payload.expirationDate,
      createdAt: signerTimestamp - 100,
      updatedAt: signerTimestamp + 5,
    };
  }

  it('validates a completely untampered contract successfully', async () => {
    const contract = await createValidSignedContract();
    const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);

    expect(result.isValid).toBe(true);
    expect(result.customerSignatureValid).toBe(true);
    expect(result.platformSignatureValid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  describe('Single-Byte Tampering across Every Canonical Terms Field', () => {
    it('detects 1-byte tamper in contractNumber', async () => {
      const contract = await createValidSignedContract();
      contract.contractNumber = 'CNT-2026-ENT-002'; // changed 1 to 2
      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Contract terms hash mismatch');
    });

    it('detects 1-byte tamper in orgId', async () => {
      const contract = await createValidSignedContract();
      contract.orgId = 'org_enterprise_corq'; // changed p to q
      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Contract terms hash mismatch');
    });

    it('detects 1-byte tamper in mcuCapacityMonthly', async () => {
      const contract = await createValidSignedContract();
      contract.mcuCapacityMonthly = 100_001; // changed by 1 MCU
      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Contract terms hash mismatch');
    });

    it('detects 1-byte tamper in slaUptimePercent', async () => {
      const contract = await createValidSignedContract();
      contract.slaUptimePercent = 99.8; // changed from 99.9
      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Contract terms hash mismatch');
    });

    it('detects 1-byte tamper in billingCycle', async () => {
      const contract = await createValidSignedContract();
      contract.billingCycle = 'monthly'; // changed from annual
      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Contract terms hash mismatch');
    });

    it('detects 1-byte tamper in unitPricePerMcuCents', async () => {
      const contract = await createValidSignedContract();
      contract.unitPricePerMcuCents = 3.4; // changed from 3.5
      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Contract terms hash mismatch');
    });

    it('detects 1-byte tamper in monthlyCommitmentCents', async () => {
      const contract = await createValidSignedContract();
      contract.monthlyCommitmentCents = 350_001; // 1 penny difference
      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Contract terms hash mismatch');
    });

    it('detects 1-byte tamper in annualCommitmentCents', async () => {
      const contract = await createValidSignedContract();
      contract.annualCommitmentCents = 3_486_001; // 1 penny difference
      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Contract terms hash mismatch');
    });

    it('detects 1-byte tamper in currency', async () => {
      const contract = await createValidSignedContract();
      contract.currency = 'VND'; // changed USD to VND
      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Contract terms hash mismatch');
    });

    it('detects 1-byte tamper in effectiveDate', async () => {
      const contract = await createValidSignedContract();
      contract.effectiveDate = '2026-10-02'; // changed 01 to 02
      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Contract terms hash mismatch');
    });

    it('detects 1-byte tamper in expirationDate', async () => {
      const contract = await createValidSignedContract();
      contract.expirationDate = '2027-10-02'; // changed 01 to 02
      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Contract terms hash mismatch');
    });

    it('detects 1-byte tamper in termsVersion', async () => {
      const contract = await createValidSignedContract();
      contract.termsVersion = '2026.1-ENTERPRISE-SLB'; // changed A to B
      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Contract terms hash mismatch');
    });
  });

  describe('Signatures, Forgery, and Cryptographic Secret Mismatch', () => {
    it('detects 1-byte alteration in contractSha256 digest', async () => {
      const contract = await createValidSignedContract();
      // Alter first char of sha256
      const firstChar = contract.contractSha256[0];
      const alteredFirst = firstChar === 'a' ? 'b' : 'a';
      contract.contractSha256 = alteredFirst + contract.contractSha256.slice(1);

      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Contract terms hash mismatch');
    });

    it('detects 1-byte alteration in customerSignatureHash', async () => {
      const contract = await createValidSignedContract();
      const firstChar = contract.customerSignatureHash![0];
      const alteredFirst = firstChar === '0' ? '1' : '0';
      contract.customerSignatureHash = alteredFirst + contract.customerSignatureHash!.slice(1);

      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.customerSignatureValid).toBe(false);
      expect(result.reason).toContain('Customer cryptographic signature verification failed');
    });

    it('detects 1-byte alteration in platformSignatureHash', async () => {
      const contract = await createValidSignedContract();
      const firstChar = contract.platformSignatureHash![0];
      const alteredFirst = firstChar === '0' ? '1' : '0';
      contract.platformSignatureHash = alteredFirst + contract.platformSignatureHash!.slice(1);

      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.customerSignatureValid).toBe(true);
      expect(result.platformSignatureValid).toBe(false);
      expect(result.reason).toContain('Platform counter-signature verification failed');
    });

    it('rejects verification if wrong customer signing secret is supplied', async () => {
      const contract = await createValidSignedContract();
      const result = await verifyContractIntegrity(contract, 'WRONG-SECRET', PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.customerSignatureValid).toBe(false);
    });

    it('rejects verification if wrong platform signing secret is supplied', async () => {
      const contract = await createValidSignedContract();
      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, 'WRONG-PLATFORM-SECRET');
      expect(result.isValid).toBe(false);
      expect(result.platformSignatureValid).toBe(false);
    });

    it('detects attacker spoofing customer email without changing signature', async () => {
      const contract = await createValidSignedContract();
      contract.customerSignerEmail = 'attacker@evil.com';
      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.customerSignatureValid).toBe(false);
    });

    it('detects timestamp tampering by even 1 second', async () => {
      const contract = await createValidSignedContract();
      contract.customerSignedAt = (contract.customerSignedAt ?? 0) + 1;
      const result = await verifyContractIntegrity(contract, CUSTOMER_SECRET, PLATFORM_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.customerSignatureValid).toBe(false);
    });
  });

  describe('RFC-8785 JSON Canonicalization Scheme Invariance', () => {
    it('produces identical SHA-256 hashes regardless of object key order', async () => {
      const payloadA: ContractSignablePayload = {
        contractNumber: 'CNT-01',
        orgId: 'org_1',
        mcuCapacityMonthly: 50_000,
        slaUptimePercent: 99.9,
        billingCycle: 'monthly',
        unitPricePerMcuCents: 4.0,
        monthlyCommitmentCents: 200_000,
        annualCommitmentCents: 2_400_000,
        currency: 'USD',
        effectiveDate: '2026-01-01',
        expirationDate: '2027-01-01',
        termsVersion: '2026.1-ENTERPRISE-SLA',
      };

      // Construct identical payload with reversed key insertion
      const payloadB: Record<string, unknown> = {};
      const keys = Object.keys(payloadA).reverse();
      for (const k of keys) {
        payloadB[k] = (payloadA as unknown as Record<string, unknown>)[k];
      }

      const hashA = await computeContractHash(payloadA);
      const hashB = await computeContractHash(payloadB as unknown as ContractSignablePayload);

      expect(hashA).toBe(hashB);
      expect(canonicalizeJson(payloadA)).toBe(canonicalizeJson(payloadB));
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GPU MESH CONCURRENCY QUOTA (20 WORKERS) & CAPACITY ENFORCEMENT
// ─────────────────────────────────────────────────────────────────────────────

describe('Challenger 1: GPU Lane Concurrency Quota & Capacity Enforcement', () => {
  let db: D1Database;
  const NOW = 1760000000;
  const ORG_ID = 'org_challenge_corp';
  const RESERVATION_ID = 'res_mesh_concurrency_test';
  const LANE_ID = 'lane_dedicated_ent_mesh_01';

  beforeEach(async () => {
    db = createTestD1();

    // 1. Seed enterprise organization
    await db
      .prepare('INSERT INTO organizations (id, name) VALUES (?, ?)')
      .bind(ORG_ID, 'Adversarial Challenge Enterprise')
      .run();

    // 2. Seed active reservation with 20 worker concurrency limit & 100K MCU allocation
    await db
      .prepare(
        `INSERT INTO enterprise_gpu_reservations (
          id, org_id, lane_id, primary_region, fallback_regions,
          reserved_units, concurrency_limit, mcu_monthly_allocation, mcu_consumed,
          priority_score, status, sla_uptime_target, sla_p95_latency_ms,
          sla_degradation_window_secs, sla_refund_pct, allocated_providers,
          active_from, active_until, metadata, created_at, updated_at
        ) VALUES (
          ?, ?, ?, 'apac', '["us", "eu"]',
          5, 20, 100000, 10000,
          300, 'active', 0.999, 1500,
          900, 10.0, '["fal", "runpod", "mekong"]',
          ?, ?, '{"tier": "enterprise"}', ?, ?
        )`,
      )
      .bind(
        RESERVATION_ID,
        ORG_ID,
        LANE_ID,
        NOW - 3600, // active since 1 hr ago
        NOW + 86400 * 30, // active for 30 more days
        NOW - 3600,
        NOW - 3600,
      )
      .run();
  });

  describe('Concurrency Saturation & 21st Job Rejection', () => {
    it('enforces exact concurrency ceiling of 20 workers and rejects job 21', async () => {
      // Seed 20 active jobs directly tied to this reservation
      // 15 rendering + 5 leased with valid future lease time
      for (let i = 1; i <= 15; i++) {
        await db
          .prepare(
            `INSERT INTO video_render_jobs (
              id, org_id, lane, priority_score, status, tier, payload, reservation_id, created_at, updated_at
            ) VALUES (?, ?, 'priority', 300, 'rendering', 'ENTERPRISE', '{}', ?, ?, ?)`,
          )
          .bind(`job_rendering_${i}`, ORG_ID, RESERVATION_ID, NOW, NOW)
          .run();
      }

      for (let i = 16; i <= 20; i++) {
        await db
          .prepare(
            `INSERT INTO video_render_jobs (
              id, org_id, lane, priority_score, status, tier, payload, reservation_id, leased_until, created_at, updated_at
            ) VALUES (?, ?, 'priority', 300, 'leased', 'ENTERPRISE', '{}', ?, ?, ?, ?)`,
          )
          .bind(`job_leased_${i}`, ORG_ID, RESERVATION_ID, NOW + 600, NOW, NOW)
          .run();
      }

      // Verify active count is exactly 20
      const activeCount = await getReservationActiveJobCount(db, RESERVATION_ID, NOW);
      expect(activeCount).toBe(20);

      // Create a queued job awaiting lane allocation
      const job21Id = 'job_overflow_21';
      await db
        .prepare(
          `INSERT INTO video_render_jobs (
            id, org_id, lane, priority_score, status, tier, payload, created_at, updated_at
          ) VALUES (?, ?, 'standard', 10, 'queued', 'ENTERPRISE', '{}', ?, ?)`,
        )
        .bind(job21Id, ORG_ID, NOW, NOW)
        .run();

      // Attempt to allocate the 21st concurrent job
      const result = await allocateDedicatedLane(db, job21Id, RESERVATION_ID, {
        nowSeconds: NOW,
      });

      // Must be rejected
      expect(result.success).toBe(false);
      expect(result.reason).toBe('CONCURRENCY_LIMIT_EXCEEDED');
      expect(result.activeJobs).toBe(20);
      expect(result.concurrencyLimit).toBe(20);

      // Verify the job was NOT elevated in the database
      const job21Row = await db
        .prepare('SELECT lane, priority_score, reservation_id FROM video_render_jobs WHERE id = ?')
        .bind(job21Id)
        .first<{ lane: string; priority_score: number; reservation_id: string | null }>();

      expect(job21Row?.lane).toBe('standard');
      expect(job21Row?.priority_score).toBe(10);
      expect(job21Row?.reservation_id).toBeNull();
    });

    it('dynamically allows job 21 allocation once an active job is released', async () => {
      // Seed 20 rendering jobs
      for (let i = 1; i <= 20; i++) {
        await db
          .prepare(
            `INSERT INTO video_render_jobs (
              id, org_id, lane, priority_score, status, tier, payload, reservation_id, created_at, updated_at
            ) VALUES (?, ?, 'priority', 300, 'rendering', 'ENTERPRISE', '{}', ?, ?, ?)`,
          )
          .bind(`job_slot_${i}`, ORG_ID, RESERVATION_ID, NOW, NOW)
          .run();
      }

      // Pre-seed 21st job
      const job21Id = 'job_waiting_21';
      await db
        .prepare(
          `INSERT INTO video_render_jobs (
            id, org_id, lane, priority_score, status, tier, payload, created_at, updated_at
          ) VALUES (?, ?, 'standard', 10, 'queued', 'ENTERPRISE', '{}', ?, ?)`,
        )
        .bind(job21Id, ORG_ID, NOW, NOW)
        .run();

      // Attempt 1: Rejected
      const attempt1 = await allocateDedicatedLane(db, job21Id, RESERVATION_ID, { nowSeconds: NOW });
      expect(attempt1.success).toBe(false);
      expect(attempt1.reason).toBe('CONCURRENCY_LIMIT_EXCEEDED');

      // Release job_slot_5
      const releaseSuccess = await releaseDedicatedLane(db, 'job_slot_5', {
        status: 'completed',
        executionLatencyMs: 750,
        executedRegion: 'apac',
      });
      expect(releaseSuccess).toBe(true);

      // Verify active count dropped to 19
      const activeAfterRelease = await getReservationActiveJobCount(db, RESERVATION_ID, NOW);
      expect(activeAfterRelease).toBe(19);

      // Attempt 2: Now succeeds!
      const attempt2 = await allocateDedicatedLane(db, job21Id, RESERVATION_ID, { nowSeconds: NOW });
      expect(attempt2.success).toBe(true);
      expect(attempt2.lane).toBe('priority');
      expect(attempt2.priorityScore).toBe(300);
      expect(attempt2.activeJobs).toBe(20);

      // Verify DB update
      const updatedJob = await db
        .prepare('SELECT lane, priority_score, reservation_id, target_region FROM video_render_jobs WHERE id = ?')
        .bind(job21Id)
        .first<{ lane: string; priority_score: number; reservation_id: string; target_region: string }>();

      expect(updatedJob?.lane).toBe('priority');
      expect(updatedJob?.priority_score).toBe(300);
      expect(updatedJob?.reservation_id).toBe(RESERVATION_ID);
      expect(updatedJob?.target_region).toBe('apac');
    });

    it('ignores expired leases when calculating active job count', async () => {
      // Seed 20 jobs where 5 have EXPIRED leased_until
      for (let i = 1; i <= 15; i++) {
        await db
          .prepare(
            `INSERT INTO video_render_jobs (
              id, org_id, lane, priority_score, status, tier, payload, reservation_id, created_at, updated_at
            ) VALUES (?, ?, 'priority', 300, 'rendering', 'ENTERPRISE', '{}', ?, ?, ?)`,
          )
          .bind(`job_live_${i}`, ORG_ID, RESERVATION_ID, NOW, NOW)
          .run();
      }

      for (let i = 16; i <= 20; i++) {
        await db
          .prepare(
            `INSERT INTO video_render_jobs (
              id, org_id, lane, priority_score, status, tier, payload, reservation_id, leased_until, created_at, updated_at
            ) VALUES (?, ?, 'priority', 300, 'leased', 'ENTERPRISE', '{}', ?, ?, ?, ?)`,
          )
          .bind(`job_expired_${i}`, ORG_ID, RESERVATION_ID, NOW - 100, NOW - 200, NOW - 200) // expired!
          .run();
      }

      // Active count should be only 15 (expired leases ignored)
      const count = await getReservationActiveJobCount(db, RESERVATION_ID, NOW);
      expect(count).toBe(15);

      // New allocation must succeed
      const newJobId = 'job_fresh_16';
      await db
        .prepare(
          `INSERT INTO video_render_jobs (
            id, org_id, lane, priority_score, status, tier, payload, created_at, updated_at
          ) VALUES (?, ?, 'standard', 10, 'queued', 'ENTERPRISE', '{}', ?, ?)`,
        )
        .bind(newJobId, ORG_ID, NOW, NOW)
        .run();

      const res = await allocateDedicatedLane(db, newJobId, RESERVATION_ID, { nowSeconds: NOW });
      expect(res.success).toBe(true);
      expect(res.activeJobs).toBe(16);
    });
  });

  describe('Capacity Reservation & Monthly Allocation Enforcement', () => {
    it('enforces exact MCU capacity limits and rejects requests exceeding monthly quota', async () => {
      // Reservation currently has: allocation = 100,000, consumed = 10,000
      // Available = 90,000 MCU
      const jobId = 'job_mcu_limit_test';
      await db
        .prepare(
          `INSERT INTO video_render_jobs (
            id, org_id, lane, priority_score, status, tier, payload, created_at, updated_at
          ) VALUES (?, ?, 'standard', 10, 'queued', 'ENTERPRISE', '{}', ?, ?)`,
        )
        .bind(jobId, ORG_ID, NOW, NOW)
        .run();

      // Requesting 90,001 MCU must be rejected (10,000 + 90,001 > 100,000)
      const overLimitRes = await allocateDedicatedLane(db, jobId, RESERVATION_ID, {
        nowSeconds: NOW,
        requestedMcu: 90_001,
      });
      expect(overLimitRes.success).toBe(false);
      expect(overLimitRes.reason).toBe('CAPACITY_EXHAUSTED');

      // Requesting exactly 90,000 MCU must succeed
      const exactLimitRes = await allocateDedicatedLane(db, jobId, RESERVATION_ID, {
        nowSeconds: NOW,
        requestedMcu: 90_000,
      });
      expect(exactLimitRes.success).toBe(true);

      // Verify reservation row updated consumed = 100,000
      const reservation = await getReservationById(db, RESERVATION_ID);
      expect(reservation?.mcuConsumed).toBe(100_000);

      // Now even 1 MCU request must be rejected
      const jobId2 = 'job_mcu_exhausted_2';
      await db
        .prepare(
          `INSERT INTO video_render_jobs (
            id, org_id, lane, priority_score, status, tier, payload, created_at, updated_at
          ) VALUES (?, ?, 'standard', 10, 'queued', 'ENTERPRISE', '{}', ?, ?)`,
        )
        .bind(jobId2, ORG_ID, NOW, NOW)
        .run();

      const exhaustedRes = await allocateDedicatedLane(db, jobId2, RESERVATION_ID, {
        nowSeconds: NOW,
        requestedMcu: 1,
      });
      expect(exhaustedRes.success).toBe(false);
      expect(exhaustedRes.reason).toBe('CAPACITY_EXHAUSTED');
    });

    it('rejects allocation when reservation is expired, suspended, or terminated', async () => {
      const mockRes: EnterpriseGpuReservation = {
        id: 'res_status_test',
        orgId: ORG_ID,
        laneId: 'lane_test',
        primaryRegion: 'apac',
        fallbackRegions: ['us'],
        reservedUnits: 5,
        concurrencyLimit: 20,
        mcuMonthlyAllocation: 100_000,
        mcuConsumed: 0,
        priorityScore: 300,
        status: 'active',
        slaUptimeTarget: 0.999,
        slaP95LatencyMs: 1500,
        slaDegradationWindowSecs: 900,
        slaRefundPct: 10,
        allocatedProviders: ['fal'],
        activeFrom: NOW - 1000,
        activeUntil: NOW + 10000,
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      };

      // 1. Suspended
      expect(validateReservationCapacity({ ...mockRes, status: 'suspended' }, 0, NOW).reason)
        .toBe('RESERVATION_SUSPENDED');

      // 2. Terminated
      expect(validateReservationCapacity({ ...mockRes, status: 'terminated' }, 0, NOW).reason)
        .toBe('RESERVATION_TERMINATED');

      // 3. Expired
      expect(validateReservationCapacity({ ...mockRes, activeUntil: NOW - 1 }, 0, NOW).reason)
        .toBe('RESERVATION_EXPIRED');
      expect(validateReservationCapacity({ ...mockRes, activeUntil: NOW }, 0, NOW).reason)
        .toBe('RESERVATION_EXPIRED');

      // 4. Not yet active
      expect(validateReservationCapacity({ ...mockRes, activeFrom: NOW + 100 }, 0, NOW).reason)
        .toBe('RESERVATION_NOT_YET_ACTIVE');

      // 5. Valid active
      expect(validateReservationCapacity(mockRes, 0, NOW).valid).toBe(true);
    });

    it('defensively ignores negative requested MCU increments', async () => {
      const jobId = 'job_neg_mcu';
      await db
        .prepare(
          `INSERT INTO video_render_jobs (
            id, org_id, lane, priority_score, status, tier, payload, created_at, updated_at
          ) VALUES (?, ?, 'standard', 10, 'queued', 'ENTERPRISE', '{}', ?, ?)`,
        )
        .bind(jobId, ORG_ID, NOW, NOW)
        .run();

      const initialRes = await getReservationById(db, RESERVATION_ID);
      const initialConsumed = initialRes!.mcuConsumed;

      const res = await allocateDedicatedLane(db, jobId, RESERVATION_ID, {
        nowSeconds: NOW,
        requestedMcu: -5000,
      });

      expect(res.success).toBe(true);
      const afterRes = await getReservationById(db, RESERVATION_ID);
      // Consumed MCU must not be decremented by negative requested MCU
      expect(afterRes!.mcuConsumed).toBe(initialConsumed);
    });
  });

  describe('Partially Signed Contract Integrity Transitions', () => {
    it('returns isValid: false when contract is missing platform counter-signature', async () => {
      const payload: ContractSignablePayload = {
        contractNumber: 'CNT-PARTIAL-01',
        orgId: 'org_partial',
        mcuCapacityMonthly: 50_000,
        slaUptimePercent: 99.9,
        billingCycle: 'monthly',
        unitPricePerMcuCents: 4.0,
        monthlyCommitmentCents: 200_000,
        annualCommitmentCents: 2_400_000,
        currency: 'USD',
        effectiveDate: '2026-01-01',
        expirationDate: '2027-01-01',
        termsVersion: '2026.1-ENTERPRISE-SLA',
      };
      const hash = await computeContractHash(payload);
      const customerSig = await generateCustomerSignature(
        hash,
        { email: 'user@corp.com', timestamp: 1760000000 },
        'secret',
      );

      const contract: EnterpriseContract = {
        id: 'c1',
        orgId: 'org_partial',
        contractNumber: 'CNT-PARTIAL-01',
        status: 'pending_signature',
        slaUptimePercent: 99.9,
        mcuCapacityMonthly: 50_000,
        billingCycle: 'monthly',
        unitPricePerMcuCents: 4.0,
        volumeDiscountPercent: 0.20,
        monthlyCommitmentCents: 200_000,
        annualCommitmentCents: 2_400_000,
        currency: 'USD',
        contractSha256: hash,
        termsVersion: '2026.1-ENTERPRISE-SLA',
        customerSignerEmail: 'user@corp.com',
        customerSignedAt: 1760000000,
        customerSignatureHash: customerSig,
        platformSignatureHash: null, // Pending platform counter-signature
        effectiveDate: '2026-01-01',
        expirationDate: '2027-01-01',
        createdAt: 1760000000,
        updatedAt: 1760000000,
      };

      const result = await verifyContractIntegrity(contract, 'secret');
      expect(result.isValid).toBe(false);
      expect(result.customerSignatureValid).toBe(true);
      expect(result.platformSignatureValid).toBe(false);
      expect(result.reason).toContain('partially signed or pending signature');
    });

    it('returns isValid: false when contract is in draft without any signatures', async () => {
      const payload: ContractSignablePayload = {
        contractNumber: 'CNT-DRAFT-01',
        orgId: 'org_draft',
        mcuCapacityMonthly: 50_000,
        slaUptimePercent: 99.9,
        billingCycle: 'monthly',
        unitPricePerMcuCents: 4.0,
        monthlyCommitmentCents: 200_000,
        annualCommitmentCents: 2_400_000,
        currency: 'USD',
        effectiveDate: '2026-01-01',
        expirationDate: '2027-01-01',
        termsVersion: '2026.1-ENTERPRISE-SLA',
      };
      const hash = await computeContractHash(payload);

      const contract: EnterpriseContract = {
        id: 'c_draft',
        orgId: 'org_draft',
        contractNumber: 'CNT-DRAFT-01',
        status: 'draft',
        slaUptimePercent: 99.9,
        mcuCapacityMonthly: 50_000,
        billingCycle: 'monthly',
        unitPricePerMcuCents: 4.0,
        volumeDiscountPercent: 0.20,
        monthlyCommitmentCents: 200_000,
        annualCommitmentCents: 2_400_000,
        currency: 'USD',
        contractSha256: hash,
        termsVersion: '2026.1-ENTERPRISE-SLA',
        customerSignatureHash: null,
        platformSignatureHash: null,
        effectiveDate: '2026-01-01',
        expirationDate: '2027-01-01',
        createdAt: 1760000000,
        updatedAt: 1760000000,
      };

      const result = await verifyContractIntegrity(contract, 'any-secret');
      expect(result.isValid).toBe(false);
      expect(result.customerSignatureValid).toBe(false);
      expect(result.platformSignatureValid).toBe(false);
    });
  });

  describe('Adversarial BANT Input Handling (XSS, Unicode, Boundary Values)', () => {
    it('handles unicode, vietnamese diacritics, and HTML/script injection gracefully', () => {
      const result = calculateBantScore({
        statedBudgetArr: 120_000,
        jobTitle: '<script>alert("xss")</script> Giám đốc Công nghệ & Founder 🚀',
        companyRevenueRange: '50M+ USD / năm',
        leadEmail: '  giám_đốc@công-ty-sản-xuất.vn  ',
        timeframe: '<img src=x onerror=alert(1)> immediate ASAP',
        statedBottleneckOrPainPoint: 'Chi phí sản xuất video quá cao và cần lồng tiếng 5 thứ tiếng tự động 🇻🇳 🇯🇵 🇰🇷',
        needsApacDubbing: true,
        needsHighVolumeSyndication: true,
      });

      expect(result.budgetScore).toBe(25);
      expect(result.authorityScore).toBe(25); // Founder regex match + corporate domain
      expect(result.timelineScore).toBe(25); // immediate / ASAP match
      expect(result.pipelineTier).toBe('hot');
      expect(result.totalScore).toBeGreaterThanOrEqual(75);
    });

    it('handles Number.MAX_SAFE_INTEGER without arithmetic overflow and proves 74 (warm) vs 77 (hot) balance', () => {
      // Case A: Without corporate email or articulated needs, score is strictly 25 + 22 + 2 + 25 = 74 (warm)
      const unverifiedLead = calculateBantScore({
        statedBudgetArr: Number.MAX_SAFE_INTEGER,
        statedMonthlyMcu: Number.MAX_SAFE_INTEGER,
        jobTitle: 'Chief Executive Officer',
        timeframe: 'immediate',
      });

      expect(unverifiedLead.budgetScore).toBe(25);
      expect(unverifiedLead.authorityScore).toBe(22);
      expect(unverifiedLead.needScore).toBe(2);
      expect(unverifiedLead.timelineScore).toBe(25);
      expect(unverifiedLead.totalScore).toBe(74);
      expect(unverifiedLead.pipelineTier).toBe('warm');

      // Case B: With verified corporate email (+3 authority bonus), total reaches 77 (hot)
      const verifiedLead = calculateBantScore({
        statedBudgetArr: Number.MAX_SAFE_INTEGER,
        statedMonthlyMcu: Number.MAX_SAFE_INTEGER,
        leadEmail: 'ceo@fortune1.com',
        jobTitle: 'Chief Executive Officer',
        timeframe: 'immediate',
      });

      expect(verifiedLead.budgetScore).toBe(25);
      expect(verifiedLead.authorityScore).toBe(25);
      expect(verifiedLead.needScore).toBe(2);
      expect(verifiedLead.timelineScore).toBe(25);
      expect(verifiedLead.totalScore).toBe(77);
      expect(verifiedLead.pipelineTier).toBe('hot');
    });
  });
});


