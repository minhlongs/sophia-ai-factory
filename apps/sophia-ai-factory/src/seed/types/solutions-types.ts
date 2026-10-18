/**
 * Solutions & Growth Analytics Domain Types
 *
 * Types for programmatic SEO solutions pages, multi-entity schema builders,
 * and executive admin growth analytics ($5K MRR milestone & 4-stage funnel).
 *
 * Layer: Seed (Foundational types, no upper layer imports)
 *
 * @module seed/types/solutions-types
 */

export type {
  FunnelStageKey,
  FunnelStageMetrics,
  MrrTierBreakdown,
  MrrMilestoneProgress,
  ChannelAttributionKey,
  ChannelAttributionItem,
  RecentGrowthLeadItem,
  GrowthAnalyticsSummary,
} from './solutions-growth-analytics-types';

export interface PainPointItem {
  titleEn: string;
  titleVi: string;
  descEn: string;
  descVi: string;
}

export interface RoiComparisonData {
  traditionalAgencyCostMonthlyUsd: number;
  traditionalTurnaroundDays: number;
  sophiaMonthlyUsd: number;
  sophiaTurnaroundSeconds: number;
  estimatedMonthlySavingsUsd: number;
  estimatedVideoOutputPerMonth: number;
}

export interface SolutionTestimonial {
  quoteEn: string;
  quoteVi: string;
  author: string;
  roleEn: string;
  roleVi: string;
  company: string;
  metrics: string;
}

export interface SolutionFaqItem {
  questionEn: string;
  questionVi: string;
  answerEn: string;
  answerVi: string;
}

export interface SolutionIndustry {
  slug: string;
  nameEn: string;
  nameVi: string;
  category: string;
  iconName: string;
  heroHeadlineEn: string;
  heroHeadlineVi: string;
  heroSubheadlineEn: string;
  heroSubheadlineVi: string;
  painPoints: PainPointItem[];
  samplePromptEn: string;
  samplePromptVi: string;
  samplePromptTitleEn: string;
  samplePromptTitleVi: string;
  roiComparison: RoiComparisonData;
  testimonial: SolutionTestimonial;
  faqs: SolutionFaqItem[];
  keywordsEn: string[];
  keywordsVi: string[];
}
