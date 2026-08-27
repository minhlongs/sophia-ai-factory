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
import { createServerClient } from '@/seed/db/client';
import { decryptToken } from '@/tree/crypto/token-crypto';
import { fetchPlatformMetrics } from '@/tree/audience/metrics-fetcher';
import { upsertAudienceMetrics } from '@/tree/audience/metrics-store';
import { AUDIENCE_PLATFORMS, type AudiencePlatform } from '@/tree/audience/types';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Deterministic daily window: UTC midnight of the day containing `nowMs`. */
export function computeDailyWindow(nowMs: number): { windowStartMs: number; windowEndMs: number } {
  const windowStartMs = Math.floor(nowMs / DAY_MS) * DAY_MS;
  return { windowStartMs, windowEndMs: windowStartMs + DAY_MS };
}

interface ChannelRow {
  tenant_id: string;
  provider: string;
  access_token: string;
}

/** Active publishing channels for platforms that have a metrics adapter. */
async function listActiveChannels(): Promise<ChannelRow[]> {
  const db = createServerClient();
  const { results } = await db
    .prepare(
      `SELECT tenant_id, provider, access_token
       FROM publishing_channels
       WHERE status = 'active'
         AND provider IN ('youtube', 'tiktok', 'instagram', 'facebook')`,
    )
    .all<ChannelRow>();
  return results ?? [];
}

/** Pull + upsert metrics for one channel. Never throws — returns an outcome. */
async function pullChannelMetrics(
  channel: ChannelRow,
  windowStartMs: number,
  windowEndMs: number,
): Promise<{ platform: string; ok: boolean; error?: string }> {
  const platform = channel.provider as AudiencePlatform;
  try {
    const token = await decryptToken(channel.access_token);
    if (!token) {
      return { platform, ok: false, error: 'token_decrypt_failed' };
    }

    const fetched = await fetchPlatformMetrics(platform, token);
    if (!fetched.ok) {
      return { platform, ok: false, error: `${fetched.error.code}: ${fetched.error.message}` };
    }

    const stored = await upsertAudienceMetrics({
      workspaceId: channel.tenant_id,
      platform,
      followers: fetched.value.followers,
      engagementRate: fetched.value.engagementRate,
      demographics: fetched.value.demographics,
      windowStartMs,
      windowEndMs,
    });
    if (!stored.ok) {
      return { platform, ok: false, error: `${stored.error.code}: ${stored.error.message}` };
    }
    return { platform, ok: true };
  } catch (err) {
    logger.error('[audience-analysis-cron] Channel pull failed', toError(err), {
      workspaceId: channel.tenant_id,
      platform,
    });
    return { platform, ok: false, error: toError(err).message };
  }
}

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
