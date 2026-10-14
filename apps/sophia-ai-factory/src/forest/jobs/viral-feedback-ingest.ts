/**
 * Video Analytics Batch Ingestion Helper for Viral Feedback Loop
 * @module forest/jobs/viral-feedback-ingest
 */

import { logger } from '@/seed/utils/logger-utility';
import type { VideoEngagementFeedback } from '@/seed/types/creative-intelligence';
import { ingestEngagementFeedback } from '@/tree/learning-loop/scoring-cas';

export interface VideoAnalyticsRow {
  video_id: string;
  workspace_id: string;
  platform: string;
  views: number;
  watch_time_sec: number;
  completion_rate?: number;
  shares: number;
  likes?: number;
  comments?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  synced_at: number;
}

export async function ingestRecentVideoAnalytics(
  d1: D1Database,
  since: number,
): Promise<{ processed: number; updated: number; conflicts: number; errors: string[] }> {
  let processed = 0;
  let updated = 0;
  let conflicts = 0;
  const errors: string[] = [];

  try {
    const queryStmt = d1.prepare(
      `SELECT video_id, workspace_id, platform, views, watch_time_sec,
              completion_rate, shares, likes, comments, impressions, clicks, conversions, synced_at
       FROM video_analytics
       WHERE synced_at >= ?
       ORDER BY synced_at DESC
       LIMIT 50`,
    );

    const analyticsRes = await queryStmt.bind(since).all<VideoAnalyticsRow>();
    const rows = analyticsRes.results ?? [];

    for (const row of rows) {
      processed++;
      try {
        const feedback: VideoEngagementFeedback = {
          videoId: row.video_id,
          workspaceId: row.workspace_id,
          platform: row.platform ?? 'tiktok',
          views: row.views ?? 0,
          shares: row.shares ?? 0,
          watchTimeSeconds: row.watch_time_sec ?? 0,
          completionRate: row.completion_rate,
          likes: row.likes,
          comments: row.comments,
          impressions: row.impressions,
          clicks: row.clicks,
          conversions: row.conversions,
          syncedAt: row.synced_at,
        };

        const res = await ingestEngagementFeedback(d1, feedback);
        if (res.casApplied) {
          updated++;
        } else {
          conflicts++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Video ${row.video_id}: ${msg}`);
        logger.error('[ViralFeedbackLoop] Failed ingesting video feedback', {
          videoId: row.video_id,
          error: msg,
        });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('[ViralFeedbackLoop] video_analytics query error (table empty or unmigrated)', {
      error: msg,
    });
  }

  return { processed, updated, conflicts, errors };
}
