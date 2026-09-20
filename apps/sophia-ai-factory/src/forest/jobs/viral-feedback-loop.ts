/**
 * Viral Feedback Loop — Closed-Loop Engagement Harvester & Concurrency Orchestrator
 *
 * Ingests published video telemetry (views, shares, retention, conversion clicks),
 * computes normalized Creative Effectiveness Scores (CES), and updates statistical
 * pattern weights in `playbook_patterns` via atomic OCC CAS.
 *
 * Runs as an Inngest scheduled cron (every 4 hours) or on-demand programmatic sync.
 *
 * Layer: forest (infrastructure & domain orchestration — depends on seed, tree, and forest).
 * Zero :any types. Zero console.log.
 *
 * @module forest/jobs/viral-feedback-loop
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  isCertificationBlocking,
  resolveCertifiedProvider,
  ProviderNotCertifiedError,
} from '@/seed/ai/provider-certification';
import type {
  VideoEngagementFeedback,
  PatternUpdateResult,
} from '@/seed/types/creative-intelligence';
import {
  calculateViralCES,
  ingestEngagementFeedback,
} from '@/tree/learning-loop/scoring-cas';

export { calculateViralCES, ingestEngagementFeedback };

export interface ViralFeedbackSyncResult {
  readonly processed: number;
  readonly updated: number;
  readonly conflicts: number;
  readonly errors: string[];
  readonly activeProvider?: string;
  readonly providerDiverted?: boolean;
}

/**
 * Executes a full synchronization run over recent video engagement analytics.
 *
 * @param db Optional D1Database binding for test overrides or direct invocation.
 * @param lookbackMs Time window to scan for updated analytics (default: 5 hours).
 */
export async function runViralFeedbackSync(
  db?: D1Database,
  lookbackMs = 5 * 60 * 60 * 1000,
): Promise<ViralFeedbackSyncResult> {
  const d1 = db ?? (await getD1());
  if (!d1) {
    logger.warn('[ViralFeedbackLoop] D1 database unavailable for viral feedback sync');
    return { processed: 0, updated: 0, conflicts: 0, errors: ['D1_UNAVAILABLE'] };
  }

  // Actively resolve certified provider for downstream prompt optimization and text reasoning
  const isHermesBlocked = isCertificationBlocking('hermes');
  let certResolution;
  try {
    certResolution = isHermesBlocked
      ? resolveCertifiedProvider('hermes', ['openrouter', 'anthropic'])
      : {
          provider: 'hermes',
          diverted: false,
          originalProvider: 'hermes',
        };
    if (certResolution.diverted) {
      logger.warn('[ViralFeedbackLoop] Hermes provider blocked by certification — actively diverting downstream prompt optimization to certified provider', {
        originalProvider: certResolution.originalProvider,
        divertedProvider: certResolution.provider,
        reason: certResolution.reason,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[ViralFeedbackLoop] Critical: No certified provider available for viral feedback loop', { error: msg });
    return {
      processed: 0,
      updated: 0,
      conflicts: 0,
      errors: [msg],
    };
  }

  const since = Date.now() - lookbackMs;
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

    const analyticsRes = await queryStmt.bind(since).all<{
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
    }>();

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
    // Soft failure when analytics table is empty in testing
  }

  logger.info('[ViralFeedbackLoop] Viral feedback synchronization complete', {
    processed,
    updated,
    conflicts,
    errorsCount: errors.length,
  });

  return {
    processed,
    updated,
    conflicts,
    errors,
    activeProvider: certResolution.provider,
    providerDiverted: certResolution.diverted,
  };
}

/**
 * Inngest Scheduled Cron: Viral Feedback Loop
 * Runs every 4 hours to harvest engagement signals and update pattern scores.
 */
export const viralFeedbackLoopCron = inngest.createFunction(
  {
    id: 'viral-feedback-loop-cron',
    name: 'Viral Feedback Loop Cron',
  },
  { cron: '0 */4 * * *' },
  async ({ step }) => {
    return await step.run('run-viral-feedback-sync', async () => {
      return await runViralFeedbackSync();
    });
  },
);
