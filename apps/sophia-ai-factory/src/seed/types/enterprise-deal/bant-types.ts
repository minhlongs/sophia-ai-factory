/**
 * BANT Scoring Types and Qualification Schemas
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 * Conforms to: Sophia 4-Layer Architecture Doctrine (< 200 LOC)
 *
 * @module seed/types/enterprise-deal/bant-types
 */

import type { PipelineTier } from './deal-constants';

export interface BantFactorBreakdown {
  score: number;
  maxScore: number;
  factor: 'budget' | 'authority' | 'need' | 'timeline';
  reason: string;
  details: Record<string, unknown>;
}

export interface BantAnalysis {
  budget: BantFactorBreakdown;
  authority: BantFactorBreakdown;
  need: BantFactorBreakdown;
  timeline: BantFactorBreakdown;
  totalScore: number;
  tier: PipelineTier;
  recommendation: string;
  qualifiedAt: number;
}

export interface BantScoreInput {
  // Budget
  statedBudgetArr?: number; // annual USD (e.g. 50000 = $50k)
  statedMonthlyMcu?: number; // requested MCUs
  companyRevenueRange?: string; // e.g. ">$50M", "$10M-$50M", "$1M-$10M", "<$1M"

  // Authority
  jobTitle?: string;
  isCorporateEmail?: boolean;
  leadEmail?: string;

  // Need
  needsHighVolumeSyndication?: boolean;
  needsApacDubbing?: boolean;
  needsDedicatedGpuLane?: boolean;
  needsCustomApiOrWhiteLabel?: boolean;
  statedBottleneckOrPainPoint?: string;
  needTags?: string[];

  // Timeline
  timeframe?:
    | 'immediate'
    | '1_to_3_months'
    | '3_to_6_months'
    | '6_to_12_months'
    | 'exploring'
    | string;
}

export interface BantScoreResult {
  totalScore: number;
  budgetScore: number;
  authorityScore: number;
  needScore: number;
  timelineScore: number;
  pipelineTier: PipelineTier;
  analysis: BantAnalysis;
}
