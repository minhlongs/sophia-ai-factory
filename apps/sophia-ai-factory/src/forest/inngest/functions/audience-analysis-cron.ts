/**
 * Inngest Cron: Audience Analysis
 * Runs daily — pulls platform audience metrics via tree adapters using BYOK
 * tokens (encrypted in publishing_channels.access_token) and upserts them
 * into audience_metrics.
 *
 * Idempotency: the window is the current UTC day (deterministic per day) and
 * audience_metrics has UNIQUE(workspace_id, platform, window_start_ms), so a
 * re-run of the same day refreshes rows instead of duplicating them.
 *
 * Circuit breaker + failure-kind classification live inside the tree fetcher
 * (every external HTTP call goes through it). Per-channel error isolation —
 * one bad token never aborts the whole run.
 *
 * Layer: forest (infrastructure orchestration). Imports seed + tree only.
 *
 * @module forest/inngest/functions/audience-analysis-cron
 */

import { inngest } from '@/seed/inngest/client';
import { AUDIENCE_PLATFORMS } from '@/tree/audience/types';
import { logger } from '@/seed/utils/logger-utility';
import {
  computeDailyWindow,
  listActiveChannels,
  pullChannelMetrics,
} from './audience-analysis-helpers';

export { computeDailyWindow };

export const audienceAnalysisCron = inngest.createFunction(
  { id: 'audience-analysis-cron', retries: 2 },
  { cron: '0 4 * * *' }, // Daily at 04:00 UTC
  async ({ step }) => {
    const channels = await step.run('list-active-channels', listActiveChannels);

    if (channels.length === 0) {
      logger.info('[audience-analysis-cron] No active channels', { reason: 'no_channels' });
      return { pulled: 0, failed: 0, channels: 0, skipped: true };
    }

    const { windowStartMs, windowEndMs } = computeDailyWindow(Date.now());
    let pulled = 0;
    let failed = 0;
    const errors: Array<{ workspaceId: string; platform: string; error: string }> = [];

    for (const channel of channels) {
      const outcome = await step.run(
        `pull-${channel.tenant_id}-${channel.provider}`,
        async () => pullChannelMetrics(channel, windowStartMs, windowEndMs),
      );
      if (outcome.ok) {
        pulled += 1;
      } else {
        failed += 1;
        errors.push({ workspaceId: channel.tenant_id, platform: outcome.platform, error: outcome.error ?? 'unknown' });
      }
    }

    logger.info('[audience-analysis-cron] Completed', {
      channels: channels.length,
      pulled,
      failed,
      windowStartMs,
      platforms: AUDIENCE_PLATFORMS.join(','),
    });

    return { pulled, failed, channels: channels.length, errors: errors.length > 0 ? errors : undefined };
  },
);
