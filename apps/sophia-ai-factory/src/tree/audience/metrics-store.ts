/**
 * Audience metrics persistence — idempotent writes to audience_metrics.
 *
 * Layer: tree (domain-reusable). Imports seed only.
 * Timestamps: MILLISECONDS (matches performance_events convention).
 *
 * Idempotency: UNIQUE(workspace_id, platform, window_start_ms) +
 * INSERT ... ON CONFLICT DO UPDATE. Re-running the same window refreshes the
 * existing row instead of creating a duplicate.
 *
 * @module tree/audience/metrics-store
 */

import { createServerClient } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { AudienceMetrics, AudiencePlatform, Demographics } from './types';

export interface MetricsStoreError {
  code: 'INVALID_INPUT' | 'INSERT_FAILED' | 'QUERY_FAILED';
  message: string;
}

/** D1 row shape for audience_metrics. */
export interface AudienceMetricsRow {
  id: string;
  workspace_id: string;
  platform: string;
  followers: number;
  engagement_rate: number;
  demographics: string; // JSON
  window_start_ms: number;
  window_end_ms: number;
  created_at: number;
}

function newMetricsId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `am_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function parseMetricsRow(row: AudienceMetricsRow): AudienceMetrics {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    platform: row.platform as AudiencePlatform,
    followers: row.followers,
    engagementRate: row.engagement_rate,
    demographics: JSON.parse(row.demographics) as Demographics,
    windowStartMs: row.window_start_ms,
    windowEndMs: row.window_end_ms,
    createdAt: row.created_at,
  };
}

/**
 * Upsert one metrics snapshot for (workspace, platform, windowStartMs).
 * A re-run of the same window refreshes the existing row in place — the
 * UNIQUE constraint makes duplicate rows impossible.
 */
export async function upsertAudienceMetrics(
  metrics: Omit<AudienceMetrics, 'id' | 'createdAt'>,
): Promise<Result<{ windowStartMs: number }, MetricsStoreError>> {
  if (metrics.followers < 0 || metrics.engagementRate < 0 || metrics.engagementRate > 1) {
    return failure({
      code: 'INVALID_INPUT',
      message: `Invalid metrics: followers=${metrics.followers}, engagementRate=${metrics.engagementRate}`,
    });
  }
  if (metrics.windowEndMs <= metrics.windowStartMs) {
    return failure({
      code: 'INVALID_INPUT',
      message: `windowEndMs (${metrics.windowEndMs}) must be after windowStartMs (${metrics.windowStartMs})`,
    });
  }

  const id = newMetricsId();
  const nowMs = Date.now();

  try {
    const db = createServerClient();
    const runResult = await db
      .prepare(
        `INSERT INTO audience_metrics (
           id, workspace_id, platform, followers, engagement_rate,
           demographics, window_start_ms, window_end_ms, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(workspace_id, platform, window_start_ms) DO UPDATE SET
           followers = excluded.followers,
           engagement_rate = excluded.engagement_rate,
           demographics = excluded.demographics,
           window_end_ms = excluded.window_end_ms`,
      )
      .bind(
        id,
        metrics.workspaceId,
        metrics.platform,
        metrics.followers,
        metrics.engagementRate,
        JSON.stringify(metrics.demographics),
        metrics.windowStartMs,
        metrics.windowEndMs,
        nowMs,
      )
      .run();

    const changes = runResult?.meta?.changes ?? 1;
    logger.info('[metrics-store] Metrics upserted', {
      workspaceId: metrics.workspaceId,
      platform: metrics.platform,
      windowStartMs: metrics.windowStartMs,
      changes,
    });
    return success({ windowStartMs: metrics.windowStartMs });
  } catch (err) {
    logger.error('[metrics-store] upsert failed', toError(err), {
      workspaceId: metrics.workspaceId,
      platform: metrics.platform,
    });
    return failure({ code: 'INSERT_FAILED', message: toError(err).message });
  }
}

/** Latest metrics row per platform for a workspace (empty when none). */
export async function getLatestMetrics(
  workspaceId: string,
): Promise<Result<AudienceMetrics[], MetricsStoreError>> {
  try {
    const db = createServerClient();
    const { results } = await db
      .prepare(
        `SELECT m.* FROM audience_metrics m
         INNER JOIN (
           SELECT platform, MAX(window_start_ms) AS max_window
           FROM audience_metrics
           WHERE workspace_id = ?1
           GROUP BY platform
         ) latest
         ON m.platform = latest.platform AND m.window_start_ms = latest.max_window
         WHERE m.workspace_id = ?1`,
      )
      .bind(workspaceId)
      .all<AudienceMetricsRow>();
    return success((results ?? []).map(parseMetricsRow));
  } catch (err) {
    logger.error('[metrics-store] latest query failed', toError(err), { workspaceId });
    return failure({ code: 'QUERY_FAILED', message: toError(err).message });
  }
}
