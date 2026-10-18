/**
 * Schemas, row mappers, and DB queries for /api/creative-memory/velocity route.
 * @module app/api/creative-memory/velocity/velocity-route-helpers
 */

import { z } from 'zod';
import { createServerClient } from '@/seed/db/client';

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

export async function queryVelocityEntries(input: z.infer<typeof GetVelocitySchema>) {
  const { workspaceId, entityType, channel } = input;
  const d1 = createServerClient();
  let sql = 'SELECT * FROM learning_velocity WHERE workspace_id = ?';
  const params: (string | number)[] = [workspaceId];

  if (entityType) {
    sql += ' AND entity_type = ?';
    params.push(entityType);
  }
  if (channel) {
    sql += ' AND channel = ?';
    params.push(channel);
  }
  sql += ' ORDER BY created_at DESC LIMIT 50';

  const result = await d1.prepare(sql).bind(...params).all<VelocityRow>();
  return (result.results ?? []).map(mapVelocityRow);
}

export async function insertVelocityEntry(input: z.infer<typeof PostVelocitySchema>) {
  const { workspaceId, entityType, channel, velocityScore, eventCount, windowStartMs, windowEndMs, avgMetrics } = input;
  const d1 = createServerClient();
  const now = Date.now();
  const id = `vel_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const startMs = windowStartMs ?? (now - 7 * 86400000);
  const endMs = windowEndMs ?? now;

  await d1
    .prepare(
      `INSERT INTO learning_velocity (
        id, workspace_id, entity_type, channel,
        velocity_score, event_count, window_start_ms, window_end_ms,
        avg_metrics, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, workspaceId, entityType, channel, velocityScore, eventCount, startMs, endMs, JSON.stringify(avgMetrics), now)
    .run();

  return {
    id,
    workspaceId,
    entityType,
    channel,
    velocityScore,
    eventCount,
    windowStartMs: startMs,
    windowEndMs: endMs,
    avgMetrics,
    createdAt: now,
  };
}
