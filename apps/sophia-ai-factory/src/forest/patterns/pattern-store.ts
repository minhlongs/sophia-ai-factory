/**
 * Pattern Store — Phase 5: Auto-Creative Playbook (COMPOUND stage)
 *
 * Read/write detected patterns to D1. Patterns are idempotent: re-running
 * detection for the same workspace/feature/value/metric overwrites the
 * previous row rather than duplicating it.
 *
 * Layer: forest (infrastructure orchestrator)
 */

import { createServerClient } from '@/seed/db/client'
import type { PlaybookPattern, PlaybookPatternRow } from '@/seed/types/playbook-pattern'

/** Insert or replace a detected pattern. Uses the unique (workspace, feature, value) shape. */
export async function upsertPattern(p: PlaybookPattern): Promise<void> {
  const db = createServerClient()
  await db.execute(
    `INSERT INTO playbook_patterns
       (id, workspace_id, feature_key, feature_value, metric, avg_metric,
        sample_size, confidence, confidence_level, source, detected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(workspace_id, feature_key, feature_value, metric)
     DO UPDATE SET avg_metric = excluded.avg_metric,
                   sample_size = excluded.sample_size,
                   confidence = excluded.confidence,
                   confidence_level = excluded.confidence_level,
                   detected_at = excluded.detected_at`,
    [
      p.id, p.workspaceId, p.featureKey, p.featureValue, p.metric,
      p.avgMetric, p.sampleSize, p.confidence, p.confidenceLevel,
      p.source, p.detectedAt,
    ],
  )
}

/** Fetch all patterns for a workspace, ordered by confidence descending. */
export async function listPatterns(workspaceId: string): Promise<PlaybookPattern[]> {
  const db = createServerClient()
  const result = await db.execute(
    `SELECT * FROM playbook_patterns
     WHERE workspace_id = ?
     ORDER BY confidence DESC, detected_at DESC`,
    [workspaceId],
  )
  return ((result.results ?? []) as PlaybookPatternRow[]).map(rowToPattern)
}

/** Fetch the single highest-confidence pattern for a feature, or null. */
export async function getTopPattern(
  workspaceId: string,
  featureKey: string,
): Promise<PlaybookPattern | null> {
  const db = createServerClient()
  const result = await db.execute(
    `SELECT * FROM playbook_patterns
     WHERE workspace_id = ? AND feature_key = ?
     ORDER BY confidence DESC, detected_at DESC
     LIMIT 1`,
    [workspaceId, featureKey],
  )
  const rows = (result.results ?? []) as PlaybookPatternRow[]
  return rows.length === 0 ? null : rowToPattern(rows[0])
}

function rowToPattern(r: PlaybookPatternRow): PlaybookPattern {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    featureKey: r.feature_key,
    featureValue: r.feature_value,
    metric: r.metric,
    avgMetric: r.avg_metric,
    sampleSize: r.sample_size,
    confidence: r.confidence,
    confidenceLevel: r.confidence_level,
    source: r.source as 'experiment' | 'memory' | 'roi',
    detectedAt: r.detected_at,
  }
}