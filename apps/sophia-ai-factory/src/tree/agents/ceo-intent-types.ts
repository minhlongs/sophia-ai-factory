/**
 * @module tree/agents/ceo-intent-types
 *
 * Type definitions for CEO agent intent detection.
 * Extracted from ceo-executor.ts for file size management.
 */

/** Detectable intents from user natural-language input. */
export type CeoIntent =
  | 'list_campaigns'
  | 'get_campaign_status'
  | 'create_campaign'
  | 'revenue_insights'
  | 'general_query';

/** Shape of a campaign record used in context summaries. */
export interface CampaignSummary {
  id: string;
  title: string;
  status: string;
  progress: number;
  topic: string;
  audience: string;
  createdAt: string;
}

/** Revenue tier breakdown returned by fetchRevenue. */
export interface RevenueByTier {
  tier: string;
  customers: number;
  revenue: number;
}

/** Daily revenue data point for trend display. */
export interface RevenueTrendPoint {
  date: string;
  revenue: number;
}

/** Full revenue insights payload. */
export interface RevenueInsights {
  periodLabel: string;
  totalRevenue: number;
  recurringRevenue: number;
  oneTimeRevenue: number;
  byTier: RevenueByTier[];
  trend: RevenueTrendPoint[];
}

/** Enriched context object returned by executeCeoContext. */
export interface CeoContext {
  intent: CeoIntent;
  summary: string;
  campaigns?: CampaignSummary[];
  revenue?: RevenueInsights;
  actionResult?: string;
}
