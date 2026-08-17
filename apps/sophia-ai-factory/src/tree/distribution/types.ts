/**
 * Distribution OS row types + mapping.
 * Converts between D1 snake_case rows and camelCase domain types.
 *
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/distribution/types
 */

import type {
  DistributionPlan,
  DistributionAsset,
  ChannelConfig,
} from '@/seed/types/creative-domain';

export type { DistributionPlan, DistributionAsset, ChannelConfig };

// ─── ID generation ─────────────────────────────────────────────────────────

export function newDistributionPlanId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'dplt_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function newDistributionAssetId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'dast_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Row types (D1 snake_case) ─────────────────────────────────────────────

export interface DistributionPlanRow {
  id: string;
  workspace_id: string;
  project_id: string;
  channels: string; // JSON array
  schedule_at: number | null;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface DistributionAssetRow {
  id: string;
  workspace_id: string;
  plan_id: string;
  asset_id: string;
  channel: string;
  platform_post_id: string | null;
  status: string;
  scheduled_at: number;
  posted_at: number | null;
  analytics: string; // JSON object
  error: string | null;
  created_at: number;
}

// ─── Row → Domain mapping ──────────────────────────────────────────────────

export function planRowToDomain(row: DistributionPlanRow): DistributionPlan {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    channels: JSON.parse(row.channels) as ChannelConfig[],
    scheduleAt: row.schedule_at ?? undefined,
    status: row.status as DistributionPlan['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function assetRowToDomain(row: DistributionAssetRow): DistributionAsset {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    planId: row.plan_id,
    assetId: row.asset_id,
    channel: row.channel,
    platformPostId: row.platform_post_id ?? undefined,
    status: row.status as DistributionAsset['status'],
    scheduledAt: row.scheduled_at,
    postedAt: row.posted_at ?? undefined,
    analytics: JSON.parse(row.analytics) as Record<string, unknown>,
    error: row.error ?? undefined,
    createdAt: row.created_at,
  };
}

// ─── Domain → Row mapping ──────────────────────────────────────────────────

export function planDomainToRow(
  plan: DistributionPlan,
): Omit<DistributionPlanRow, 'id'> {
  return {
    workspace_id: plan.workspaceId,
    project_id: plan.projectId,
    channels: JSON.stringify(plan.channels),
    schedule_at: plan.scheduleAt ?? null,
    status: plan.status,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,
  };
}

export function assetDomainToRow(
  asset: DistributionAsset,
): Omit<DistributionAssetRow, 'id'> {
  return {
    workspace_id: asset.workspaceId,
    plan_id: asset.planId,
    asset_id: asset.assetId,
    channel: asset.channel,
    platform_post_id: asset.platformPostId ?? null,
    status: asset.status,
    scheduled_at: asset.scheduledAt,
    posted_at: asset.postedAt ?? null,
    analytics: JSON.stringify(asset.analytics),
    error: asset.error ?? null,
    created_at: asset.createdAt,
  };
}
