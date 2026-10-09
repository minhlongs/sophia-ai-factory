/**
 * Growth Analytics Calculation Types & Targets
 *
 * Layer: Land (Domain service & data aggregation, imports seed only)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module land/growth/analytics-service/types
 */

export const TARGET_MRR_USD = 5000;
export const TARGET_PAYING_CUSTOMERS = 10;

export interface CalculateFunnelStagesInput {
  visitors: number;
  leads: number;
  trials: number;
  paid: number;
}

export interface CalculateMrrProgressInput {
  tierCounts: {
    basic: number;
    premium: number;
    enterprise: number;
    master: number;
  };
  customMrr?: number;
}

export interface RawChannelAttributionData {
  channel: 'viral_videos' | 'telegram_bot' | 'programmatic_seo' | 'affiliate_partners';
  channelLabelEn: string;
  channelLabelVi: string;
  visitors: number;
  leads: number;
  trials: number;
  paid: number;
}
