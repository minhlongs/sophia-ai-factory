/**
 * @file types.ts
 * @description Types and input schemas for Fleet Matrix and SKU Radar actions
 */

import type {
  FleetCreatorAccount,
  TrendingSkuRadarItem,
  FleetCampaignDeployment,
} from '@/seed/types/fleet-matrix-sku-radar-types';
import type { SkuMetricsInput } from '@/tree/radar/sku-velocity-calculator';

export type {
  FleetCreatorAccount,
  TrendingSkuRadarItem,
  FleetCampaignDeployment,
  SkuMetricsInput,
};

export interface RegisterFleetAccountInput {
  platform: 'TIKTOK' | 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK';
  handle: string;
  displayName: string;
  proxyConfigId?: string | null;
  dailyPostLimit?: number;
}

export interface LaunchFleetDeploymentInput {
  skuId?: string;
  campaignName: string;
  targetAccountIds: string[];
  videoAssetUrl?: string;
  hookAngles: string[];
  staggerMinutes: number;
  bridgePageSlug?: string;
}

export type IngestTrendingSkuRadarInput = SkuMetricsInput & {
  affiliateUrl?: string;
};

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
