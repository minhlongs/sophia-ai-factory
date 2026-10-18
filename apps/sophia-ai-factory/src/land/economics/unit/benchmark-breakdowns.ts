/**
 * Unit Economics Benchmark Breakdown Data
 * @module land/economics/unit/benchmark-breakdowns
 */

import type { UnitEconomicsSummary } from '@/seed/types/unit-economics-types';

export const BENCHMARK_TIER_ECONOMICS: UnitEconomicsSummary['tierEconomics'] = [
  {
    tier: 'BASIC',
    monthlyPriceUsd: 199,
    monthlyMcuQuota: 200,
    estimatedVideoQuota: 100,
    activeSubscribers: 18,
    monthlyRevenueUsd: 3582,
    estimatedCogsUsd: 396,
    grossMarginPct: 88.9,
    status: 'OPTIMAL',
  },
  {
    tier: 'PREMIUM',
    monthlyPriceUsd: 399,
    monthlyMcuQuota: 500,
    estimatedVideoQuota: 250,
    activeSubscribers: 12,
    monthlyRevenueUsd: 4788,
    estimatedCogsUsd: 552,
    grossMarginPct: 88.5,
    status: 'OPTIMAL',
  },
  {
    tier: 'ENTERPRISE',
    monthlyPriceUsd: 799,
    monthlyMcuQuota: 1200,
    estimatedVideoQuota: 600,
    activeSubscribers: 6,
    monthlyRevenueUsd: 4794,
    estimatedCogsUsd: 594,
    grossMarginPct: 87.6,
    status: 'HEALTHY',
  },
  {
    tier: 'MASTER',
    monthlyPriceUsd: 4999,
    monthlyMcuQuota: 10000,
    estimatedVideoQuota: 5000,
    activeSubscribers: 2,
    monthlyRevenueUsd: 9998,
    estimatedCogsUsd: 825,
    grossMarginPct: 91.7,
    status: 'OPTIMAL',
  },
];

export const BENCHMARK_PROVIDER_COSTS: UnitEconomicsSummary['providerCosts'] = [
  {
    provider: 'fal',
    displayName: 'fal.ai (Flux Schnell / Dev)',
    totalJobs: 18450,
    successfulJobs: 18320,
    failedJobs: 130,
    totalCostUsd: 840.2,
    avgCostPerJobUsd: 0.0455,
    costSharePct: 50.0,
    failureRatePct: 0.7,
    avgLatencyMs: 1450,
  },
  {
    provider: 'elevenlabs',
    displayName: 'ElevenLabs Neural TTS',
    totalJobs: 17200,
    successfulJobs: 17110,
    failedJobs: 90,
    totalCostUsd: 588.1,
    avgCostPerJobUsd: 0.0342,
    costSharePct: 35.0,
    failureRatePct: 0.5,
    avgLatencyMs: 620,
  },
  {
    provider: 'openrouter',
    displayName: 'OpenRouter (DeepSeek / GPT-4o-mini)',
    totalJobs: 21100,
    successfulJobs: 21010,
    failedJobs: 90,
    totalCostUsd: 253.2,
    avgCostPerJobUsd: 0.012,
    costSharePct: 15.0,
    failureRatePct: 0.4,
    avgLatencyMs: 820,
  },
  {
    provider: 'mekong',
    displayName: 'Mekong GPU Edge (Apple M1 Max)',
    totalJobs: 14266,
    successfulJobs: 14210,
    failedJobs: 56,
    totalCostUsd: 0.0,
    avgCostPerJobUsd: 0.0,
    costSharePct: 0.0,
    failureRatePct: 0.39,
    avgLatencyMs: 380,
  },
];
