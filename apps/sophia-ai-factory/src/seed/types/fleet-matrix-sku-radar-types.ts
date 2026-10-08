/**
 * @file fleet-matrix-sku-radar-types.ts
 * @description Zod schemas and TypeScript types for Multi-Account Fleet Matrix & Trending SKU Radar
 * @layer seed
 */

import { z } from 'zod';

export const FLEET_PLATFORMS = ['TIKTOK', 'YOUTUBE', 'INSTAGRAM', 'FACEBOOK'] as const;
export type FleetPlatform = (typeof FLEET_PLATFORMS)[number];

export const FLEET_ACCOUNT_STATUSES = ['ACTIVE', 'WARMING_UP', 'COOLDOWN', 'SUSPENDED'] as const;
export type FleetAccountStatus = (typeof FLEET_ACCOUNT_STATUSES)[number];

export const RADAR_PLATFORMS = ['TIKTOK_SHOP', 'SHOPEE', 'CLICKBANK'] as const;
export type RadarPlatform = (typeof RADAR_PLATFORMS)[number];

export const HOT_TREND_TIERS = ['BREAKOUT', 'SURGING', 'STEADY', 'COOLING'] as const;
export type HotTrendTier = (typeof HOT_TREND_TIERS)[number];

export const DEPLOYMENT_STATUSES = ['PENDING', 'GENERATING', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'PAUSED'] as const;
export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

export const FleetCreatorAccountSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  platform: z.enum(FLEET_PLATFORMS),
  handle: z.string().min(1),
  displayName: z.string().min(1),
  avatarUrl: z.string().url().nullable().optional(),
  proxyConfigId: z.string().nullable().optional(),
  status: z.enum(FLEET_ACCOUNT_STATUSES).default('ACTIVE'),
  dailyPostLimit: z.number().int().min(1).max(20).default(3),
  postsPublishedToday: z.number().int().min(0).default(0),
  lastPostAt: z.number().int().nullable().optional(),
  totalViews: z.number().int().min(0).default(0),
  totalClicks: z.number().int().min(0).default(0),
  totalGmv: z.number().min(0).default(0),
  totalCommission: z.number().min(0).default(0),
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
});
export type FleetCreatorAccount = z.infer<typeof FleetCreatorAccountSchema>;

export const TrendingSkuRadarItemSchema = z.object({
  id: z.string().min(1),
  platform: z.enum(RADAR_PLATFORMS),
  skuCode: z.string().min(1),
  productName: z.string().min(1),
  productCategory: z.string().min(1),
  productImageUrl: z.string().url().nullable().optional(),
  price: z.number().positive(),
  currency: z.string().default('VND'),
  commissionRate: z.number().min(0.01).max(0.9),
  estimatedCommission: z.number().min(0),
  dailySalesVolume: z.number().int().min(0).default(0),
  growthVelocityScore: z.number().min(0).max(100).default(0),
  hotTrendTier: z.enum(HOT_TREND_TIERS).default('STEADY'),
  affiliateUrl: z.string().url(),
  topSellingHookSummary: z.string().nullable().optional(),
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
});
export type TrendingSkuRadarItem = z.infer<typeof TrendingSkuRadarItemSchema>;

export const FleetCampaignDeploymentSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  skuId: z.string().min(1),
  campaignName: z.string().min(1),
  targetFleetAccountIds: z.array(z.string().min(1)).min(1),
  generatedHookAngles: z.array(z.string().min(1)).min(1),
  bridgePageSlug: z.string().min(1),
  status: z.enum(DEPLOYMENT_STATUSES).default('PENDING'),
  staggerIntervalMinutes: z.number().int().min(5).max(180).default(30),
  totalAssignedAccounts: z.number().int().min(0).default(0),
  totalPublishedVideos: z.number().int().min(0).default(0),
  aggregateGmv: z.number().min(0).default(0),
  aggregateCommission: z.number().min(0).default(0),
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
});
export type FleetCampaignDeployment = z.infer<typeof FleetCampaignDeploymentSchema>;
