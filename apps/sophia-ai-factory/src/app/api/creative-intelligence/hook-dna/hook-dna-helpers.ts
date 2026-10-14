/**
 * Zod schemas and D1 query/insert helpers for /api/creative-intelligence/hook-dna.
 * @module app/api/creative-intelligence/hook-dna/hook-dna-helpers
 */

import { z } from 'zod';
import { createServerClient } from '@/seed/db/client';
import type { PlaybookPatternRow } from '@/seed/types/playbook-pattern';

export const GetHookDnaSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  hookType: z.string().optional(),
  metric: z.string().optional(),
  confidenceLevel: z.enum(['high', 'medium', 'low']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const PostHookDnaSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  hookType: z.string().min(1, 'hookType is required'),
  metric: z.string().optional().default('ctr'),
  avgMetric: z.number().min(0),
  sampleSize: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
  confidenceLevel: z.enum(['high', 'medium', 'low']).optional(),
  source: z.enum(['experiment', 'memory', 'roi']).optional().default('experiment'),
});

export async function queryHookDnaPatterns(params: z.infer<typeof GetHookDnaSchema>) {
  const { workspaceId, hookType, metric, confidenceLevel, limit } = params;
  const d1 = createServerClient();
  let sql = `SELECT * FROM playbook_patterns WHERE workspace_id = ? AND feature_key = 'hook_type'`;
  const bindParams: (string | number)[] = [workspaceId];

  if (hookType) {
    sql += ' AND feature_value = ?';
    bindParams.push(hookType);
  }
  if (metric) {
    sql += ' AND metric = ?';
    bindParams.push(metric);
  }
  if (confidenceLevel) {
    sql += ' AND confidence_level = ?';
    bindParams.push(confidenceLevel);
  }

  sql += ' ORDER BY confidence DESC, avg_metric DESC LIMIT ?';
  bindParams.push(limit);

  const result = await d1.prepare(sql).bind(...bindParams).all<PlaybookPatternRow>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    hookType: row.feature_value,
    metric: row.metric,
    avgMetric: row.avg_metric,
    sampleSize: row.sample_size,
    confidence: row.confidence,
    confidenceLevel: row.confidence_level,
    source: row.source,
    detectedAt: row.detected_at,
  }));
}

export async function insertHookDnaPattern(params: z.infer<typeof PostHookDnaSchema>) {
  const { workspaceId, hookType, metric, avgMetric, sampleSize, confidence, confidenceLevel, source } = params;
  const d1 = createServerClient();
  const now = Date.now();
  const id = `pat_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const level = confidenceLevel ?? (confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low');

  await d1
    .prepare(
      `INSERT INTO playbook_patterns (
        id, workspace_id, feature_key, feature_value,
        metric, avg_metric, sample_size, confidence,
        confidence_level, source, detected_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, workspaceId, 'hook_type', hookType, metric, avgMetric, sampleSize, confidence, level, source, now, now)
    .run();

  return {
    id,
    workspaceId,
    hookType,
    metric,
    avgMetric,
    sampleSize,
    confidence,
    confidenceLevel: level,
    source,
    detectedAt: now,
  };
}
