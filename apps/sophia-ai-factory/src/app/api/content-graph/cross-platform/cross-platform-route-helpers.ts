/**
 * Schemas and row mappers for /api/content-graph/cross-platform route.
 * @module app/api/content-graph/cross-platform/cross-platform-route-helpers
 */

import { z } from 'zod';

export const GetCrossPlatformSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  projectId: z.string().optional(),
  channel: z.string().optional(),
});

export const PostCrossPlatformSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  planId: z.string().min(1, 'planId is required'),
  assetId: z.string().min(1, 'assetId is required'),
  channel: z.string().min(1, 'channel is required'),
  platformPostId: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'posting', 'posted', 'failed']).optional().default('scheduled'),
  scheduledAt: z.number().int().positive().optional(),
  analytics: z.record(z.string(), z.unknown()).optional().default({}),
});

export interface DistAssetRow {
  id: string;
  workspace_id: string;
  plan_id: string;
  asset_id: string;
  channel: string;
  platform_post_id: string | null;
  status: string;
  scheduled_at: number;
  posted_at: number | null;
  analytics: string;
  error: string | null;
  created_at: number;
}

export function mapDistAssetRow(row: DistAssetRow) {
  let analytics: unknown = {};
  try {
    analytics = typeof row.analytics === 'string' ? JSON.parse(row.analytics) : (row.analytics ?? {});
  } catch {
    analytics = {};
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    planId: row.plan_id,
    assetId: row.asset_id,
    channel: row.channel,
    platformPostId: row.platform_post_id,
    status: row.status,
    scheduledAt: row.scheduled_at,
    postedAt: row.posted_at,
    analytics,
    error: row.error,
    createdAt: row.created_at,
  };
}
