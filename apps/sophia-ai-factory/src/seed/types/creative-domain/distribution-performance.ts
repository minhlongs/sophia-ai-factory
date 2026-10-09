/**
 * @file distribution-performance.ts
 * @description Distribution plans, channel configs, performance metrics, and revenue events.
 * @layer seed
 */

export interface ChannelConfig {
  channel: string; // 'youtube' | 'tiktok' | 'x' | ...
  assetId: string;
  title?: string;
  description?: string;
  tags?: string[];
  publishAt?: number;
  settings: Record<string, unknown>;
}

export interface DistributionPlan {
  id: string;
  projectId: string;
  workspaceId: string;
  channels: ChannelConfig[];
  scheduleAt?: number;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  createdAt: number;
  updatedAt: number;
}

export interface DistributionAsset {
  id: string;
  workspaceId: string;
  planId: string;
  assetId: string;
  channel: string;
  platformPostId?: string;
  status: 'draft' | 'scheduled' | 'posting' | 'posted' | 'failed';
  scheduledAt: number;
  postedAt?: number;
  analytics: Record<string, unknown>;
  error?: string;
  createdAt: number;
}

export interface PerformanceEvent {
  id: string;
  workspaceId: string;
  assetId: string;
  projectId: string;
  entityType: string; // 'asset' | 'mission' | 'campaign'
  entityId: string;
  channel: string;
  eventType: string; // 'impression' | 'view' | 'click' | 'like' | 'share' | 'save' | 'follow' | 'conversion' | 'revenue'
  count: number;
  valueCents?: number;
  recordedAt: number;
  rawData?: Record<string, unknown>;
}

export interface PerformanceSnapshot {
  id: string;
  workspaceId: string;
  assetId: string;
  channel: string;
  snapshotDate: number;
  impressions: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  watchTimeSeconds: number;
  retention3s: number;
  retention30s: number;
  followerDelta: number;
  leadDelta: number;
  revenueCents: number;
  costCents: number;
  creativeRoi: number;
}

export type RevenueEventType = 'sale' | 'affiliate' | 'ad' | 'subscription' | 'lead' | 'licensing';

export interface RevenueEvent {
  id: string;
  workspaceId: string;
  assetId?: string;
  projectId?: string;
  channel: string;
  type: RevenueEventType;
  amountCents: number;
  currency: string;
  metadata: Record<string, unknown>;
  occurredAt: number;
  recordedAt: number;
}
