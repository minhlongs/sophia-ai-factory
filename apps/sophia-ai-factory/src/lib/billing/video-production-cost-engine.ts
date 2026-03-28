/**
 * Video Production Cost Engine
 *
 * Calculates EXACT operational costs for AI video production.
 * Uses real API pricing from HeyGen, ElevenLabs, OpenRouter.
 * Computes throughput capacity and ROI/ARR projections.
 */

import type { Tier } from '@/types';
import { UNIFIED_TIERS } from '@/lib/unified-tier-config';

/** Real API costs per video component (USD) */
export const API_COSTS = {
  /** HeyGen Scale API: ~$0.50/min for 60s video */
  heygen: { perMinute: 0.50, monthlyFixed: 99 },
  /** ElevenLabs Creator: ~$0.04 per script (~700 chars avg) */
  elevenlabs: { perScript: 0.04, monthlyFixed: 22 },
  /** OpenRouter: $0.03/script avg (gpt-4o-mini for BASIC, Claude 3.5 for ENTERPRISE) */
  openrouter: { perScript: 0.03, monthlyFixed: 0 },
  /** D-ID Build (optional): ~$1.13/min */
  did: { perMinute: 1.13, monthlyFixed: 18 },
} as const;

/** Cloud + infrastructure costs (USD/month) */
export const INFRA_COSTS = {
  /** Cloudflare Workers Paid plan (includes D1, KV) */
  cloudflareWorkers: 5,
  /** Cloudflare R2 storage (~10GB video cache, $0.015/GB) */
  cloudflareR2: 0.15,
  /** Custom domain renewal (~$12/year ÷ 12) */
  domain: 1,
  /** Upstash Redis — rate limiting + nonce tracking */
  upstashRedis: 10,
  /** Inngest — background job queue for video pipeline */
  inngest: 25,
  /** Resend — billing email notifications */
  resend: 5,
  /** Telegram Bot API — free */
  telegram: 0,
  /** YouTube Data API — free */
  youtube: 0,
  /** TikTok Publishing API — free */
  tiktok: 0,
} as const;

/** Total monthly infrastructure cost */
export const MONTHLY_INFRA_COST = Object.values(INFRA_COSTS).reduce((a, b) => a + b, 0);

/** Production constraints */
export const PRODUCTION_LIMITS = {
  /** Average video duration in minutes */
  avgDurationMin: 1,
  /** HeyGen processing time per video (minutes) — includes queue + render */
  processingTimeMin: 4,
  /** Max parallel jobs (HeyGen Scale tier) */
  maxParallelJobs: 3,
  /** Hours per day the factory can operate */
  operatingHoursPerDay: 24,
} as const;

export interface CostBreakdown {
  /** Cost per single video (variable API costs only) */
  variableCostPerVideo: number;
  /** Monthly fixed subscription costs */
  monthlyFixedCosts: number;
  /** Total cost for N videos including fixed costs amortization */
  totalCostPerVideo: number;
  /** Individual API costs per video */
  components: {
    heygen: number;
    elevenlabs: number;
    openrouter: number;
  };
}

export interface ThroughputResult {
  /** Videos per hour */
  videosPerHour: number;
  /** Videos per day (24h) */
  videosPerDay: number;
  /** Videos per month (30 days) */
  videosPerMonth: number;
  /** Videos per year (365 days) */
  videosPerYear: number;
}

export interface ROIProjection {
  /** Tier name */
  tier: Tier;
  tierName: string;
  /** Monthly subscription price (what customer pays) */
  monthlyRevenue: number;
  /** Annual subscription revenue */
  annualRevenue: number;
  /** Monthly operational cost to serve this customer */
  monthlyCost: number;
  /** Annual operational cost */
  annualCost: number;
  /** Monthly gross profit */
  monthlyProfit: number;
  /** Annual gross profit */
  annualProfit: number;
  /** Gross margin percentage */
  marginPercent: number;
  /** ROI percentage */
  roiPercent: number;
  /** Videos this tier can produce per month */
  videosPerMonth: number;
  /** Cost per video at this tier's volume */
  costPerVideo: number;
}

export interface ARRProjection {
  /** Number of customers */
  customers: number;
  /** Total ARR */
  arr: number;
  /** Total annual cost */
  annualCost: number;
  /** Net annual profit */
  annualProfit: number;
  /** Blended margin */
  marginPercent: number;
}

/**
 * Calculate variable cost per video (API costs only).
 */
export function calculateVariableCost(durationMin: number = 1): CostBreakdown['components'] {
  return {
    heygen: API_COSTS.heygen.perMinute * durationMin,
    elevenlabs: API_COSTS.elevenlabs.perScript,
    openrouter: API_COSTS.openrouter.perScript,
  };
}

/**
 * Calculate full cost breakdown for a given monthly volume.
 * Includes API subscriptions + cloud infrastructure.
 */
export function calculateCostBreakdown(videosPerMonth: number, durationMin: number = 1): CostBreakdown {
  const components = calculateVariableCost(durationMin);
  const variableCostPerVideo = components.heygen + components.elevenlabs + components.openrouter;

  const monthlyFixedCosts =
    API_COSTS.heygen.monthlyFixed +
    API_COSTS.elevenlabs.monthlyFixed +
    API_COSTS.openrouter.monthlyFixed +
    MONTHLY_INFRA_COST;

  const fixedPerVideo = videosPerMonth > 0 ? monthlyFixedCosts / videosPerMonth : 0;
  const totalCostPerVideo = variableCostPerVideo + fixedPerVideo;

  return { variableCostPerVideo, monthlyFixedCosts, totalCostPerVideo, components };
}

/**
 * Calculate maximum production throughput.
 */
export function calculateThroughput(
  parallelJobs: number = PRODUCTION_LIMITS.maxParallelJobs,
  processingTimeMin: number = PRODUCTION_LIMITS.processingTimeMin,
): ThroughputResult {
  const videosPerHour = Math.floor((60 / processingTimeMin) * parallelJobs);
  const videosPerDay = videosPerHour * PRODUCTION_LIMITS.operatingHoursPerDay;
  const videosPerMonth = videosPerDay * 30;
  const videosPerYear = videosPerDay * 365;

  return { videosPerHour, videosPerDay, videosPerMonth, videosPerYear };
}

/**
 * Calculate ROI projection for a specific tier.
 */
export function calculateTierROI(tier: Tier, videosPerMonth?: number): ROIProjection {
  const config = UNIFIED_TIERS[tier];
  const vpm = videosPerMonth ?? config.campaignsPerMonth;
  const cost = calculateCostBreakdown(vpm);

  const monthlyRevenue = config.price;
  const annualRevenue = monthlyRevenue * 12;
  const monthlyCost = (cost.variableCostPerVideo * vpm) + cost.monthlyFixedCosts;
  const annualCost = monthlyCost * 12;
  const monthlyProfit = monthlyRevenue - monthlyCost;
  const annualProfit = annualRevenue - annualCost;
  const marginPercent = monthlyRevenue > 0 ? (monthlyProfit / monthlyRevenue) * 100 : 0;
  const roiPercent = annualCost > 0 ? (annualProfit / annualCost) * 100 : 0;

  return {
    tier,
    tierName: config.name,
    monthlyRevenue,
    annualRevenue,
    monthlyCost: Math.round(monthlyCost * 100) / 100,
    annualCost: Math.round(annualCost * 100) / 100,
    monthlyProfit: Math.round(monthlyProfit * 100) / 100,
    annualProfit: Math.round(annualProfit * 100) / 100,
    marginPercent: Math.round(marginPercent * 10) / 10,
    roiPercent: Math.round(roiPercent * 10) / 10,
    videosPerMonth: vpm,
    costPerVideo: Math.round(cost.totalCostPerVideo * 100) / 100,
  };
}

/**
 * Calculate ARR projection for a customer mix.
 * Fixed API costs (HeyGen/ElevenLabs subscriptions) are shared across
 * all customers — they're factory costs, not per-customer costs.
 */
export function calculateARRProjection(
  customersByTier: Record<Tier, number>,
): ARRProjection {
  let totalARR = 0;
  let totalVariableCost = 0;
  let totalCustomers = 0;

  const monthlyFixedCosts =
    API_COSTS.heygen.monthlyFixed +
    API_COSTS.elevenlabs.monthlyFixed +
    API_COSTS.openrouter.monthlyFixed;

  for (const tier of Object.keys(customersByTier) as Tier[]) {
    const count = customersByTier[tier];
    if (count <= 0) continue;
    const config = UNIFIED_TIERS[tier];
    const vpm = config.campaignsPerMonth;
    const cost = calculateCostBreakdown(vpm);
    totalARR += config.price * 12 * count;
    totalVariableCost += cost.variableCostPerVideo * vpm * 12 * count;
    totalCustomers += count;
  }

  // Fixed costs paid once for the factory, not per customer
  const totalAnnualCost = totalVariableCost + (monthlyFixedCosts * 12);
  const annualProfit = totalARR - totalAnnualCost;
  const marginPercent = totalARR > 0 ? (annualProfit / totalARR) * 100 : 0;

  return {
    customers: totalCustomers,
    arr: Math.round(totalARR),
    annualCost: Math.round(totalAnnualCost),
    annualProfit: Math.round(annualProfit),
    marginPercent: Math.round(marginPercent * 10) / 10,
  };
}
