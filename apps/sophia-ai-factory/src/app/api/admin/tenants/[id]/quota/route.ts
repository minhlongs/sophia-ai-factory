/**
 * GET /api/admin/tenants/[id]/quota
 *
 * Admin-only. Returns current quota usage vs. limits for a tenant.
 * Includes videos, storage, and channel counts with percentage used.
 *
 * Requires Better Auth session with role=admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { VIDEO_TIER_CONFIG, toVideoTierKey } from '@/config/tiers/video-quota-tiers';
import type { VideoTierKey } from '@/config/tiers/video-quota-tiers';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';

function getD1(): D1Database | null {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.DB) return env.DB as D1Database;
  return (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined ?? null;
}

function currentYYYYMM(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

function pct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100 * 10) / 10);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id: tenantId } = await params;

  const db = getD1();
  if (!db) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    // Resolve tenant's tier from video_jobs (most recent job's tier)
    const tierRow = await db
      .prepare(
        'SELECT tier FROM video_jobs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1'
      )
      .bind(tenantId)
      .first<{ tier: string }>();

    const dbTier = tierRow?.tier ?? 'free';
    const tierKey: VideoTierKey = toVideoTierKey(dbTier);
    const limits = VIDEO_TIER_CONFIG[tierKey];

    // Current month video count
    const { year, month } = currentYYYYMM();
    const monthStartSec = Math.floor(
      new Date(Date.UTC(year, month - 1, 1)).getTime() / 1000
    );

    const videoCountRow = await db
      .prepare(
        'SELECT COUNT(*) AS cnt FROM video_jobs WHERE tenant_id = ? AND created_at >= ?'
      )
      .bind(tenantId, monthStartSec)
      .first<{ cnt: number }>();
    const videosUsed = videoCountRow?.cnt ?? 0;

    // Storage from tenant_storage_usage
    const storageRow = await db
      .prepare(
        'SELECT total_bytes, video_count FROM tenant_storage_usage WHERE tenant_id = ?'
      )
      .bind(tenantId)
      .first<{ total_bytes: number; video_count: number }>();

    const storageUsedBytes = storageRow?.total_bytes ?? 0;
    const storageUsedGB = storageUsedBytes / (1024 ** 3);

    // Channel count from voices (tenant-scoped)
    const channelRow = await db
      .prepare('SELECT COUNT(DISTINCT user_id) AS cnt FROM voices WHERE tenant_id = ?')
      .bind(tenantId)
      .first<{ cnt: number }>();
    const channelsUsed = channelRow?.cnt ?? 0;

    const used = {
      videos: videosUsed,
      storageGB: Math.round(storageUsedGB * 1000) / 1000,
      channels: channelsUsed,
    };

    const limitDisplay = {
      videos: limits.videosPerMonth === -1 ? 'unlimited' : limits.videosPerMonth,
      storageGB: limits.storageGB === -1 ? 'unlimited' : limits.storageGB,
      channels: limits.channelsLimit === -1 ? 'unlimited' : limits.channelsLimit,
    };

    const pctUsed = {
      videos: limits.videosPerMonth === -1 ? 0 : pct(videosUsed, limits.videosPerMonth),
      storageGB: limits.storageGB === -1 ? 0 : pct(storageUsedGB, limits.storageGB),
      channels: limits.channelsLimit === -1 ? 0 : pct(channelsUsed, limits.channelsLimit),
    };

    return NextResponse.json({
      tenantId,
      tier: tierKey,
      monthlyPriceUSDT: limits.monthlyPriceUSDT,
      used,
      limits: limitDisplay,
      pctUsed,
    });
  } catch (err) {
    logger.error('[Admin/Quota] Query error', { tenantId, err: toError(err).message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
