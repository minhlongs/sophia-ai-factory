/**
 * @module tests/adversarial/m4-economics-challenger-stress.test
 *
 * Empirical Adversarial Challenger Test Suite — Milestone M4:
 * Multi-Model Cost Arbitrage & Hybrid Edge Fallback Engine (Unit Economics Math)
 *
 * Stress Vectors & Threat Models:
 * 1. Division-by-Zero Invariants:
 *    - calculateGrossMarginPct: (0, 0), (0, 500), (-100, 200), (0.0001, 0)
 *    - calculateCogsPerVideo: (0, 0), (500, 0), (-100, -5), (500, -1)
 *    - calculateLtvCac: churn = 0%, churn = -5%, acquiredCustomers = 0, spend = 0, arpu = 0, margin <= 0
 * 2. Extreme Values & Boundary Invariants:
 *    - Negative gross margins (COGS > Revenue) clamped to [-100, 100]
 *    - Massive numbers: $1T revenue, 10B videos, $10M ARPU, 5M customers
 *    - Micro-transactions and sub-cent rounding precision
 * 3. Cloudflare D1 Mock Permutations & Empty State Resilience:
 *    - D1 is null / undefined -> returns BENCHMARK_UNIT_ECONOMICS
 *    - All D1 tables empty -> returns BENCHMARK_UNIT_ECONOMICS
 *    - Database connection / prepare throws -> catches and fails safe to BENCHMARK
 *    - Partial empty states:
 *      * Only media_jobs has rows, zero revenue / licenses
 *      * Only payment_events has revenue, zero media jobs
 *      * Only raas_licenses has rows, zero media jobs / payments
 *      * Failed media jobs (completed = 0, cost > 0)
 *      * Corrupted JSON in payment_events
 *      * Null totals in commission_ledger and edge_nodes
 * 4. Multimodal Router Math Boundaries:
 *    - Target duration = 0, negative duration, extreme 1M seconds duration
 *    - Savings vs cloud baseline: 100% on unmetered edge, 0% on pure cloud
 * 5. Monte Carlo Randomized Fuzzing Oracle (500 iterations):
 *    - Asserts 100% finite numbers, 0% NaN, 0% Infinity across all formulas
 */

import { describe, it, expect, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
  calculateGrossMarginPct,
  calculateCogsPerVideo,
  calculateLtvCac,
  getUnitEconomicsSummary,
  BENCHMARK_UNIT_ECONOMICS,
} from '@/land/economics/unit-economics-service';
import {
  routeMultimodalCostArbitrage,
  calculateCloudBaselineCost,
  estimateStageCost,
  SCRIPT_PROVIDER_OPTIONS,
  VISUALS_PROVIDER_OPTIONS,
  AUDIO_PROVIDER_OPTIONS,
  RENDER_PROVIDER_OPTIONS,
} from '@/tree/ai/multimodal-cost-router';

describe('Milestone M4 Unit Economics Empirical Adversarial Challenger Suite', () => {
  // ─── 1. Division-by-Zero Boundary Tests ────────────────────────────────────

  describe('1. Division-by-Zero Invariants', () => {
    it('Oracle: calculateGrossMarginPct with 0 revenue and 0 COGS returns exactly 0 (no NaN, no Infinity)', () => {
      const margin = calculateGrossMarginPct(0, 0);
      expect(margin).toBe(0);
      expect(Number.isNaN(margin)).toBe(false);
      expect(Number.isFinite(margin)).toBe(true);
    });

    it('Oracle: calculateGrossMarginPct with 0 revenue and positive COGS returns 0 (never -Infinity)', () => {
      const margin = calculateGrossMarginPct(0, 500);
      expect(margin).toBe(0);
      expect(Number.isNaN(margin)).toBe(false);
      expect(Number.isFinite(margin)).toBe(true);
    });

    it('Oracle: calculateGrossMarginPct with negative revenue returns 0 (fails safe)', () => {
      expect(calculateGrossMarginPct(-100, 200)).toBe(0);
      expect(calculateGrossMarginPct(-500, 0)).toBe(0);
      expect(calculateGrossMarginPct(-100, -200)).toBe(0);
    });

    it('Oracle: calculateCogsPerVideo with 0 completed videos returns exactly 0 (never NaN or Infinity)', () => {
      expect(calculateCogsPerVideo(0, 0)).toBe(0);
      expect(calculateCogsPerVideo(500, 0)).toBe(0);
      expect(calculateCogsPerVideo(0.0001, 0)).toBe(0);
    });

    it('Oracle: calculateCogsPerVideo with negative completed videos returns 0 (guards against invalid counts)', () => {
      expect(calculateCogsPerVideo(500, -1)).toBe(0);
      expect(calculateCogsPerVideo(500, -999)).toBe(0);
    });

    it('Oracle: calculateLtvCac with 0% churn rate clamps to 1% minimum and prevents division by zero', () => {
      const result = calculateLtvCac({
        arpuUsd: 100,
        grossMarginPct: 80,
        monthlyChurnPct: 0, // Divisor would be 0 without guard
        totalAcquisitionSpendUsd: 1000,
        acquiredCustomersCount: 10,
      });

      expect(Number.isFinite(result.ltvUsd)).toBe(true);
      expect(Number.isNaN(result.ltvUsd)).toBe(false);
      // LTV = (100 * 0.8) / 0.01 = 8000
      expect(result.ltvUsd).toBe(8000);
      expect(result.cacUsd).toBe(100);
      expect(result.ltvCacRatio).toBe(80);
      expect(result.paybackMonths).toBe(1.3);
    });

    it('Oracle: calculateLtvCac with negative churn rate clamps to 1% minimum', () => {
      const result = calculateLtvCac({
        arpuUsd: 200,
        grossMarginPct: 90,
        monthlyChurnPct: -15, // Negative churn
        totalAcquisitionSpendUsd: 500,
        acquiredCustomersCount: 5,
      });

      expect(Number.isFinite(result.ltvUsd)).toBe(true);
      // LTV = (200 * 0.9) / 0.01 = 18000
      expect(result.ltvUsd).toBe(18000);
    });

    it('Oracle: calculateLtvCac with 0 acquired customers guards divisor to 1 and avoids NaN/Infinity', () => {
      const result = calculateLtvCac({
        arpuUsd: 150,
        grossMarginPct: 85,
        monthlyChurnPct: 5,
        totalAcquisitionSpendUsd: 300,
        acquiredCustomersCount: 0, // Divisor would be 0
      });

      expect(Number.isFinite(result.cacUsd)).toBe(true);
      expect(Number.isNaN(result.cacUsd)).toBe(false);
      // CAC = 300 / Math.max(1, 0) = 300
      expect(result.cacUsd).toBe(300);
      expect(Number.isFinite(result.ltvCacRatio)).toBe(true);
    });

    it('Oracle: calculateLtvCac with 0 acquisition spend and 0 customers guards LTV:CAC against division by zero', () => {
      const result = calculateLtvCac({
        arpuUsd: 100,
        grossMarginPct: 50,
        monthlyChurnPct: 5,
        totalAcquisitionSpendUsd: 0, // CAC = 0
        acquiredCustomersCount: 0,
      });

      expect(result.cacUsd).toBe(0);
      // LTV:CAC = ltvUsd / Math.max(1, 0) = 1000 / 1 = 1000
      expect(Number.isFinite(result.ltvCacRatio)).toBe(true);
      expect(Number.isNaN(result.ltvCacRatio)).toBe(false);
      expect(result.ltvCacRatio).toBe(result.ltvUsd);
    });

    it('Oracle: calculateLtvCac with 0 ARPU or 0% margin yields 0 payback months without division-by-zero', () => {
      const resultZeroArpu = calculateLtvCac({
        arpuUsd: 0,
        grossMarginPct: 80,
        monthlyChurnPct: 5,
        totalAcquisitionSpendUsd: 500,
        acquiredCustomersCount: 2,
      });
      expect(resultZeroArpu.paybackMonths).toBe(0);
      expect(resultZeroArpu.ltvUsd).toBe(0);

      const resultZeroMargin = calculateLtvCac({
        arpuUsd: 200,
        grossMarginPct: 0,
        monthlyChurnPct: 5,
        totalAcquisitionSpendUsd: 500,
        acquiredCustomersCount: 2,
      });
      expect(resultZeroMargin.paybackMonths).toBe(0);
      expect(resultZeroMargin.ltvUsd).toBe(0);
    });

    it('Oracle: calculateLtvCac with all zeroes returns all zero finite numbers', () => {
      const result = calculateLtvCac({
        arpuUsd: 0,
        grossMarginPct: 0,
        monthlyChurnPct: 0,
        totalAcquisitionSpendUsd: 0,
        acquiredCustomersCount: 0,
      });

      expect(result.ltvUsd).toBe(0);
      expect(result.cacUsd).toBe(0);
      expect(result.ltvCacRatio).toBe(0);
      expect(result.paybackMonths).toBe(0);
      expect(Object.values(result).every((v) => Number.isFinite(v) && !Number.isNaN(v))).toBe(true);
    });
  });

  // ─── 2. Extreme Values & Negative Margins ─────────────────────────────────

  describe('2. Extreme Values & Negative Margins', () => {
    it('Oracle: calculateGrossMarginPct handles negative margin when COGS exceed Revenue', () => {
      // ($100 revenue - $250 COGS) / $100 = -150.0%, clamped to -100.0%
      expect(calculateGrossMarginPct(100, 250)).toBe(-100);
      // ($1,000 revenue - $1,200 COGS) / $1,000 = -20.0%
      expect(calculateGrossMarginPct(1000, 1200)).toBe(-20.0);
    });

    it('Oracle: calculateGrossMarginPct clamps extreme bounds to [-100.0, 100.0]', () => {
      // Massive loss: $100 revenue vs $10,000,000 COGS -> clamped to -100
      expect(calculateGrossMarginPct(100, 10_000_000)).toBe(-100);
      // Negative COGS (supplier credit / subsidy): $100 revenue vs -$500 COGS -> clamped to 100
      expect(calculateGrossMarginPct(100, -500)).toBe(100);
    });

    it('Oracle: calculateGrossMarginPct maintains precision at massive $1 Trillion scale', () => {
      const revenue = 1_000_000_000_000; // $1 Trillion
      const cogs = 120_000_000_000; // $120 Billion
      const margin = calculateGrossMarginPct(revenue, cogs);
      expect(margin).toBe(88.0);
      expect(Number.isFinite(margin)).toBe(true);
    });

    it('Oracle: calculateCogsPerVideo handles massive volume (10 Billion videos)', () => {
      const totalCogs = 500_000_000; // $500M
      const totalVideos = 10_000_000_000; // 10B videos
      const cogsPerVid = calculateCogsPerVideo(totalCogs, totalVideos);
      expect(cogsPerVid).toBe(0.05);
      expect(Number.isFinite(cogsPerVid)).toBe(true);
    });

    it('Oracle: calculateLtvCac handles negative gross margin gracefully (ltv = 0, payback = 0)', () => {
      const result = calculateLtvCac({
        arpuUsd: 500,
        grossMarginPct: -45.0, // Operating at loss
        monthlyChurnPct: 5.0,
        totalAcquisitionSpendUsd: 1000,
        acquiredCustomersCount: 2,
      });

      expect(result.ltvUsd).toBe(0); // marginDecimal clamped to 0 via Math.max(0, -0.45)
      expect(result.paybackMonths).toBe(0);
      expect(result.cacUsd).toBe(500);
      expect(result.ltvCacRatio).toBe(0);
    });

    it('Oracle: calculateLtvCac handles enterprise scale numbers without overflow', () => {
      const result = calculateLtvCac({
        arpuUsd: 10_000_000, // $10M ARPU
        grossMarginPct: 90.0,
        monthlyChurnPct: 2.0,
        totalAcquisitionSpendUsd: 500_000_000, // $500M
        acquiredCustomersCount: 1_000_000, // 1M customers
      });

      expect(result.cacUsd).toBe(500);
      expect(result.ltvUsd).toBe(450_000_000);
      expect(result.ltvCacRatio).toBe(900_000);
      // At $10M ARPU and $500 CAC, payback period is 0.000055 months, rounding to 0.0
      expect(result.paybackMonths).toBe(0);
      expect(Object.values(result).every((v) => Number.isFinite(v))).toBe(true);
    });
  });

  // ─── 3. Cloudflare D1 Mock Permutations & Empty State Resilience ──────────

  describe('3. Cloudflare D1 Mock Permutations & Empty State Resilience', () => {
    it('Oracle: returns benchmark summary when db is null or undefined', async () => {
      const summaryNull = await getUnitEconomicsSummary(30, null as unknown as D1Database);
      expect(summaryNull.metrics.grossMarginPct).toBe(BENCHMARK_UNIT_ECONOMICS.metrics.grossMarginPct);
      expect(summaryNull.totalVideosCompleted).toBe(BENCHMARK_UNIT_ECONOMICS.totalVideosCompleted);
      expect(summaryNull.timeframeDays).toBe(30);

      const summaryUndefined = await getUnitEconomicsSummary(14, undefined as unknown as D1Database);
      expect(summaryUndefined.timeframeDays).toBe(14);
      expect(summaryUndefined.metrics.grossMarginPct).toBe(BENCHMARK_UNIT_ECONOMICS.metrics.grossMarginPct);
    });

    it('Oracle: returns benchmark summary when D1 tables return completely empty sets', async () => {
      const emptyD1: Partial<D1Database> = {
        prepare: vi.fn().mockImplementation(() => ({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null),
        })),
      };

      const summary = await getUnitEconomicsSummary(60, emptyD1 as unknown as D1Database);
      expect(summary.timeframeDays).toBe(60);
      expect(summary.metrics.grossMarginPct).toBe(BENCHMARK_UNIT_ECONOMICS.metrics.grossMarginPct);
      expect(summary.metrics.totalRevenueUsd).toBe(BENCHMARK_UNIT_ECONOMICS.metrics.totalRevenueUsd);
    });

    it('Oracle: catches query exceptions on broken D1 tables and fails safe to benchmark', async () => {
      const crashingD1: Partial<D1Database> = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('D1_SQLITE_BUSY: database is locked');
        }),
      };

      const summary = await getUnitEconomicsSummary(30, crashingD1 as unknown as D1Database);
      expect(summary.metrics.grossMarginPct).toBe(BENCHMARK_UNIT_ECONOMICS.metrics.grossMarginPct);
      expect(summary.metrics.ltvCacRatio).toBe(BENCHMARK_UNIT_ECONOMICS.metrics.ltvCacRatio);
    });

    it('Oracle: handles partial empty state (media_jobs has rows, but 0 revenue / 0 licenses)', async () => {
      const partialD1: Partial<D1Database> = {
        prepare: vi.fn().mockImplementation((query: string) => ({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockImplementation(async () => {
            if (query.includes('FROM media_jobs')) {
              return {
                results: [
                  { model: 'fal-ai/flux-schnell', status: 'completed', provider_cost: 10, latency_ms: 1000, type: 'video' },
                  { model: 'eleven_turbo_v2_5', status: 'completed', provider_cost: 5, latency_ms: 500, type: 'audio' },
                ],
              };
            }
            return { results: [] }; // raas_licenses, payment_events empty
          }),
          first: vi.fn().mockImplementation(async () => null), // commission_ledger, edge_nodes empty
        })),
      };

      const summary = await getUnitEconomicsSummary(30, partialD1 as unknown as D1Database);

      // Not benchmark because totalVideos > 0
      expect(summary.totalVideosCompleted).toBe(2);
      expect(summary.metrics.totalCogsUsd).toBe(0.15); // 15 cents
      expect(summary.metrics.cogsPerVideoUsd).toBe(0.075);
      expect(summary.metrics.totalRevenueUsd).toBe(0);
      expect(summary.metrics.grossMarginPct).toBe(0); // 0 revenue -> 0% margin, no NaN
      expect(summary.activePayingCustomers).toBe(1); // Math.max(1, 0)
      expect(summary.metrics.cacUsd).toBe(0);
      expect(summary.metrics.ltvUsd).toBe(0);
      expect(summary.metrics.ltvCacRatio).toBe(0); // Math.max(1, cacUsd) prevents div by zero
      expect(summary.tierEconomics.length).toBe(4);
      expect(summary.providerCosts.length).toBe(4);
    });

    it('Oracle: handles partial empty state (payment_events has revenue, but 0 media jobs)', async () => {
      const partialD1: Partial<D1Database> = {
        prepare: vi.fn().mockImplementation((query: string) => ({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockImplementation(async () => {
            if (query.includes('FROM payment_events')) {
              return {
                results: [
                  { payload: JSON.stringify({ price_amount: 399 }) },
                  { payload: JSON.stringify({ amount: 199 }) },
                ],
              };
            }
            return { results: [] };
          }),
          first: vi.fn().mockImplementation(async () => null),
        })),
      };

      const summary = await getUnitEconomicsSummary(30, partialD1 as unknown as D1Database);

      expect(summary.totalVideosCompleted).toBe(0);
      expect(summary.metrics.totalRevenueUsd).toBe(598);
      expect(summary.metrics.totalCogsUsd).toBe(0);
      expect(summary.metrics.cogsPerVideoUsd).toBe(0); // 0 completed videos
      expect(summary.metrics.grossMarginPct).toBe(100.0);
      expect(Number.isFinite(summary.metrics.ltvUsd)).toBe(true);
      expect(summary.metrics.ltvUsd).toBeGreaterThan(0);
    });

    it('Oracle: handles partial empty state (raas_licenses has subscribers, media_jobs has 0 completed jobs)', async () => {
      const partialD1: Partial<D1Database> = {
        prepare: vi.fn().mockImplementation((query: string) => ({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockImplementation(async () => {
            if (query.includes('FROM raas_licenses')) {
              return {
                results: [
                  { tier: 'BASIC', count: 5 },
                  { tier: 'MASTER', count: 1 },
                ],
              };
            }
            return { results: [] };
          }),
          first: vi.fn().mockImplementation(async () => null),
        })),
      };

      const summary = await getUnitEconomicsSummary(30, partialD1 as unknown as D1Database);

      // Monthly revenue = 5 * 199 + 1 * 4999 = 995 + 4999 = 5994
      expect(summary.metrics.totalRevenueUsd).toBe(5994);
      expect(summary.activePayingCustomers).toBe(6);
      expect(summary.arpuUsd).toBe(999.0);
      expect(summary.metrics.grossMarginPct).toBe(100.0);
      expect(summary.metrics.cogsPerVideoUsd).toBe(0);
      expect(summary.totalVideosCompleted).toBe(0);
    });

    it('Oracle: handles failed media jobs where completed count is 0 but cost is incurred', async () => {
      const failedJobsD1: Partial<D1Database> = {
        prepare: vi.fn().mockImplementation((query: string) => ({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockImplementation(async () => {
            if (query.includes('FROM media_jobs')) {
              return {
                results: [
                  { model: 'fal-ai/flux-dev', status: 'failed', provider_cost: 30, latency_ms: 2800, type: 'video' },
                  { model: 'fal-ai/flux-dev', status: 'failed', provider_cost: 30, latency_ms: 2900, type: 'video' },
                ],
              };
            }
            if (query.includes('FROM payment_events')) {
              return {
                results: [{ payload: JSON.stringify({ price_amount: 100 }) }],
              };
            }
            return { results: [] };
          }),
          first: vi.fn().mockImplementation(async () => null),
        })),
      };

      const summary = await getUnitEconomicsSummary(30, failedJobsD1 as unknown as D1Database);

      expect(summary.totalVideosCompleted).toBe(0);
      expect(summary.metrics.totalCogsUsd).toBe(0.60); // 60 cents
      expect(summary.metrics.cogsPerVideoUsd).toBe(0); // completed videos = 0 -> cogsPerVideo = 0
      expect(summary.metrics.grossMarginPct).toBe(99.4); // ($100 - $0.60) / $100 = 99.4%
      // Provider failure rate should be 100%
      const falProvider = summary.providerCosts.find((p) => p.provider === 'fal');
      expect(falProvider).toBeDefined();
      expect(falProvider?.failureRatePct).toBe(100.0);
      expect(falProvider?.failedJobs).toBe(2);
      expect(falProvider?.successfulJobs).toBe(0);
    });

    it('Oracle: resilient against corrupted JSON and invalid values in payment_events', async () => {
      const corruptD1: Partial<D1Database> = {
        prepare: vi.fn().mockImplementation((query: string) => ({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockImplementation(async () => {
            if (query.includes('FROM payment_events')) {
              return {
                results: [
                  { payload: '{ corrupted json syntax' },
                  { payload: JSON.stringify({ price_amount: 'NaN' }) },
                  { payload: JSON.stringify({ amount: -150 }) },
                  { payload: JSON.stringify({ price_amount: 500 }) },
                ],
              };
            }
            if (query.includes('FROM raas_licenses')) {
              return { results: [{ tier: 'BASIC', count: 1 }] };
            }
            return { results: [] };
          }),
          first: vi.fn().mockImplementation(async () => null),
        })),
      };

      const summary = await getUnitEconomicsSummary(30, corruptD1 as unknown as D1Database);
      // Valid amount of 500 should be parsed, license revenue is 199 -> max(500, 199) = 500
      expect(summary.metrics.totalRevenueUsd).toBe(500);
      expect(Number.isFinite(summary.metrics.grossMarginPct)).toBe(true);
    });
  });

  // ─── 4. Multimodal Router Math Boundaries ─────────────────────────────────

  describe('4. Multimodal Router Math Boundaries', () => {
    it('Oracle: targetDurationSeconds = 0 clamps to 1s duration and produces finite costPerSecondUsd', () => {
      const decision = routeMultimodalCostArbitrage({
        targetDurationSeconds: 0,
      });

      expect(decision.durationSeconds).toBe(1);
      expect(Number.isFinite(decision.costPerSecondUsd)).toBe(true);
      expect(Number.isNaN(decision.costPerSecondUsd)).toBe(false);
      expect(decision.costPerSecondUsd).toBeGreaterThanOrEqual(0);
    });

    it('Oracle: negative targetDurationSeconds clamps to 1s duration', () => {
      const decision = routeMultimodalCostArbitrage({
        targetDurationSeconds: -60,
      });

      expect(decision.durationSeconds).toBe(1);
      expect(Number.isFinite(decision.costPerSecondUsd)).toBe(true);
    });

    it('Oracle: cloud baseline cost calculation is safe with 0 duration', () => {
      const baseline = calculateCloudBaselineCost({
        targetDurationSeconds: 0,
      });

      expect(baseline).toBeGreaterThan(0);
      expect(Number.isFinite(baseline)).toBe(true);
    });

    it('Oracle: unmetered Mekong edge achieves 100% savings on edge stages', () => {
      const decision = routeMultimodalCostArbitrage(
        {
          targetDurationSeconds: 30,
        },
        {
          edgeNodeAvailable: true,
          strategy: 'mekong_edge_first',
        }
      );

      expect(decision.isMekongGpuAccelerated).toBe(true);
      expect(decision.totalEstimatedCostUsd).toBe(0);
      expect(decision.costPerSecondUsd).toBe(0);
      expect(decision.savingsPercentage).toBe(100);
    });

    it('Oracle: pure cloud bypass mode performs cloud-to-cloud arbitrage (Flash vs Turbo) saving 8.1%', () => {
      const decision = routeMultimodalCostArbitrage(
        {
          targetDurationSeconds: 30,
          bypassEdge: true,
        },
        {
          edgeNodeAvailable: false,
        }
      );

      expect(decision.isMekongGpuAccelerated).toBe(false);
      expect(decision.totalEstimatedCostUsd).toBeGreaterThan(0);
      // Cloud-to-cloud arbitrage: Flash TTS ($0.0063) vs Baseline Turbo TTS ($0.0126) saves $0.0063 (8.1%)
      expect(decision.savingsVsCloudUsd).toBe(0.0063);
      expect(decision.savingsPercentage).toBe(8.1);
    });

    it('Oracle: quality_priority cloud routing clamps savingsVsCloudUsd to 0 when cost exceeds baseline (never negative)', () => {
      const decision = routeMultimodalCostArbitrage(
        {
          targetDurationSeconds: 30,
          bypassEdge: true,
        },
        {
          edgeNodeAvailable: false,
          strategy: 'quality_priority',
        }
      );

      expect(decision.isMekongGpuAccelerated).toBe(false);
      // Flux Pro + Claude Haiku costs more than standard baseline
      expect(decision.totalEstimatedCostUsd).toBeGreaterThan(0.0779);
      // Math.max(0, cloudBaseline - totalCost) prevents negative savings
      expect(decision.savingsVsCloudUsd).toBe(0);
      expect(decision.savingsPercentage).toBe(0);
    });

    it('Oracle: stage cost estimation with zero tokens/frames/chars does not divide by zero or crash', () => {
      const scriptCost = estimateStageCost(
        'script',
        SCRIPT_PROVIDER_OPTIONS[1], // DeepSeek
        { targetDurationSeconds: 30, scriptPromptTokens: 0, scriptCompletionTokens: 0 }
      );
      expect(scriptCost).toBe(0);

      const visualsCost = estimateStageCost(
        'visuals',
        VISUALS_PROVIDER_OPTIONS[1], // fal flux-schnell
        { targetDurationSeconds: 30, frameCount: 0 }
      );
      expect(visualsCost).toBe(0);

      const audioCost = estimateStageCost(
        'audio',
        AUDIO_PROVIDER_OPTIONS[1], // ElevenLabs
        { targetDurationSeconds: 30, audioCharacterCount: 0 }
      );
      expect(audioCost).toBe(0);

      const renderCost = estimateStageCost(
        'render',
        RENDER_PROVIDER_OPTIONS[1], // Worker
        { targetDurationSeconds: 30 }
      );
      expect(renderCost).toBe(0.005);
    });
  });

  // ─── 5. Monte Carlo Randomized Fuzzing Oracle (500 trials) ────────────────

  describe('5. Monte Carlo Randomized Fuzzing Oracle (500 trials)', () => {
    it('Oracle: 500 randomized parameter trials across calculateGrossMarginPct never produce NaN or Infinity', () => {
      for (let i = 0; i < 500; i++) {
        // Uniform and edge values: negatives, zeroes, small decimals, large numbers
        const revenue = (Math.random() - 0.2) * 100_000;
        const cogs = (Math.random() - 0.2) * 100_000;

        const margin = calculateGrossMarginPct(revenue, cogs);

        expect(Number.isFinite(margin)).toBe(true);
        expect(Number.isNaN(margin)).toBe(false);
        expect(margin).toBeGreaterThanOrEqual(-100);
        expect(margin).toBeLessThanOrEqual(100);
      }
    });

    it('Oracle: 500 randomized parameter trials across calculateCogsPerVideo never produce NaN or Infinity', () => {
      for (let i = 0; i < 500; i++) {
        const cogs = Math.random() * 50_000;
        const videos = Math.floor((Math.random() - 0.1) * 10_000);

        const cogsPerVid = calculateCogsPerVideo(cogs, videos);

        expect(Number.isFinite(cogsPerVid)).toBe(true);
        expect(Number.isNaN(cogsPerVid)).toBe(false);
        expect(cogsPerVid).toBeGreaterThanOrEqual(0);
      }
    });

    it('Oracle: 500 randomized parameter trials across calculateLtvCac never produce NaN or Infinity', () => {
      for (let i = 0; i < 500; i++) {
        const arpu = Math.random() * 5_000;
        const margin = (Math.random() - 0.2) * 100;
        const churn = (Math.random() - 0.1) * 30;
        const spend = Math.random() * 50_000;
        const customers = Math.floor((Math.random() - 0.1) * 500);

        const result = calculateLtvCac({
          arpuUsd: arpu,
          grossMarginPct: margin,
          monthlyChurnPct: churn,
          totalAcquisitionSpendUsd: spend,
          acquiredCustomersCount: customers,
        });

        expect(Number.isFinite(result.ltvUsd)).toBe(true);
        expect(Number.isNaN(result.ltvUsd)).toBe(false);
        expect(result.ltvUsd).toBeGreaterThanOrEqual(0);

        expect(Number.isFinite(result.cacUsd)).toBe(true);
        expect(Number.isNaN(result.cacUsd)).toBe(false);
        expect(result.cacUsd).toBeGreaterThanOrEqual(0);

        expect(Number.isFinite(result.ltvCacRatio)).toBe(true);
        expect(Number.isNaN(result.ltvCacRatio)).toBe(false);
        expect(result.ltvCacRatio).toBeGreaterThanOrEqual(0);

        expect(Number.isFinite(result.paybackMonths)).toBe(true);
        expect(Number.isNaN(result.paybackMonths)).toBe(false);
        expect(result.paybackMonths).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
