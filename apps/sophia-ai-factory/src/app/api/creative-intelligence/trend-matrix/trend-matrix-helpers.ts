/**
 * Schemas and D1 helpers for /api/creative-intelligence/trend-matrix
 *
 * @module app/api/creative-intelligence/trend-matrix/trend-matrix-helpers
 */

import { z } from 'zod';
import { createServerClient } from '@/seed/db/client';

export const GetTrendMatrixSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  channel: z.string().optional(),
  topic: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const PostTrendMatrixSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  triggerDetection: z.boolean().optional().default(false),
  topic: z.string().optional(),
  channel: z.string().optional(),
  momentum: z.number().optional().default(0),
  forecast: z.record(z.string(), z.unknown()).optional().default({}),
  evidenceIds: z.array(z.string()).optional().default([]),
});

export interface TrendRow {
  id: string;
  workspace_id: string;
  topic: string;
  channel: string | null;
  momentum: number;
  forecast: string | null;
  evidence_ids: string | null;
  detected_at: number;
}

export async function queryTrendDetections(
  workspaceId: string,
  channel: string | undefined,
  topic: string | undefined,
  limit: number,
) {
  const d1 = createServerClient();
  let sql = 'SELECT * FROM trend_detections WHERE workspace_id = ?';
  const params: (string | number)[] = [workspaceId];
  if (channel) {
    sql += ' AND channel = ?';
    params.push(channel);
  }
  if (topic) {
    sql += ' AND topic = ?';
    params.push(topic);
  }
  sql += ' ORDER BY momentum DESC, detected_at DESC LIMIT ?';
  params.push(limit);

  const result = await d1.prepare(sql).bind(...params).all<TrendRow>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    topic: row.topic,
    channel: row.channel,
    momentum: row.momentum,
    forecast: (() => {
      try {
        return row.forecast ? JSON.parse(row.forecast) : null;
      } catch {
        return null;
      }
    })(),
    evidenceIds: (() => {
      try {
        return row.evidence_ids ? JSON.parse(row.evidence_ids) : [];
      } catch {
        return [];
      }
    })(),
    detectedAt: row.detected_at,
  }));
}

export async function insertTrendDetection(params: {
  workspaceId: string;
  topic: string;
  channel?: string;
  momentum: number;
  forecast: Record<string, unknown>;
  evidenceIds: string[];
}) {
  const d1 = createServerClient();
  const now = Date.now();
  const id = `trd_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  await d1
    .prepare(
      `INSERT INTO trend_detections (id, workspace_id, topic, channel, momentum, forecast, evidence_ids, detected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      params.workspaceId,
      params.topic,
      params.channel ?? null,
      params.momentum,
      JSON.stringify(params.forecast),
      JSON.stringify(params.evidenceIds),
      now,
    )
    .run();

  return {
    id,
    workspaceId: params.workspaceId,
    topic: params.topic,
    channel: params.channel ?? null,
    momentum: params.momentum,
    forecast: params.forecast,
    evidenceIds: params.evidenceIds,
    detectedAt: now,
  };
}
