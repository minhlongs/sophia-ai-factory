/**
 * Channel metrics pull and persistence helpers for Audience Analysis Cron.
 * Layer: forest (infrastructure orchestration). Imports seed + tree only.
 *
 * @module forest/inngest/functions/audience-analysis-helpers
 */

import { createServerClient } from '@/seed/db/client';
import { decryptToken } from '@/tree/crypto/token-crypto';
import { fetchPlatformMetrics } from '@/tree/audience/metrics-fetcher';
import { upsertAudienceMetrics } from '@/tree/audience/metrics-store';
import type { AudiencePlatform } from '@/tree/audience/types';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Deterministic daily window: UTC midnight of the day containing `nowMs`. */
export function computeDailyWindow(nowMs: number): { windowStartMs: number; windowEndMs: number } {
  const windowStartMs = Math.floor(nowMs / DAY_MS) * DAY_MS;
  return { windowStartMs, windowEndMs: windowStartMs + DAY_MS };
}

export interface ChannelRow {
  tenant_id: string;
  provider: string;
  access_token: string;
}

/** Active publishing channels for platforms that have a metrics adapter. */
export async function listActiveChannels(): Promise<ChannelRow[]> {
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
export async function pullChannelMetrics(
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
