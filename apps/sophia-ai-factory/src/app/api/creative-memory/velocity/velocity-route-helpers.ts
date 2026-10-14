/**
 * Schemas and row mappers for /api/creative-memory/velocity route.
 * @module app/api/creative-memory/velocity/velocity-route-helpers
 */

import { z } from 'zod';

export const GetVelocitySchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  entityType: z.string().optional(),
  channel: z.string().optional(),
});

export const PostVelocitySchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  entityType: z.string().min(1, 'entityType is required'),
  channel: z.string().min(1, 'channel is required'),
  velocityScore: z.number().min(0).max(100),
  eventCount: z.number().int().nonnegative().optional().default(0),
  windowStartMs: z.number().int().positive().optional(),
  windowEndMs: z.number().int().positive().optional(),
  avgMetrics: z.record(z.string(), z.unknown()).optional().default({}),
});

export interface VelocityRow {
  id: string;
  workspace_id: string;
  entity_type: string;
  channel: string;
  velocity_score: number;
  event_count: number;
  window_start_ms: number;
  window_end_ms: number;
  avg_metrics: string;
  created_at: number;
}

export function mapVelocityRow(row: VelocityRow) {
  let avgMetrics: unknown = {};
  try {
    avgMetrics = typeof row.avg_metrics === 'string' ? JSON.parse(row.avg_metrics) : (row.avg_metrics ?? {});
  } catch {
    avgMetrics = {};
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    entityType: row.entity_type,
    channel: row.channel,
    velocityScore: row.velocity_score,
    eventCount: row.event_count,
    windowStartMs: row.window_start_ms,
    windowEndMs: row.window_end_ms,
    avgMetrics,
    createdAt: row.created_at,
  };
}
