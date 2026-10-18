/**
 * Video Production Cost & ROI Projection Types
 *
 * @module billing/video-production-cost-types
 */

import type { Tier } from '@/seed/types';

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
