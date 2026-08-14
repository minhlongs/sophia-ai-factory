/**
 * OpenClaw Bridge: video status + handover summary.
 * Extracted from openclaw-bridge-info for file size compliance.
 * @module land/openclaw-telegram/openclaw-bridge-status
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

// ─── sophia_get_video_status ─────────────────────────────────────────────────

export interface VideoSummary {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

export interface VideoStatusResult {
  count: number;
  videos: VideoSummary[];
}

export async function callGetVideoStatus(
  userId: string,
  statusFilter?: string,
  limit = 5,
): Promise<VideoStatusResult> {
  try {
    const db = createServerClient();
    let query = db
      .from('user_videos')
      .select('id, title, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (statusFilter && ['processing', 'completed', 'failed'].includes(statusFilter)) {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;
    const videos = (data ?? []).map((v: Record<string, unknown>) => ({
      id: String(v.id),
      title: String(v.title ?? ''),
      status: String(v.status),
      createdAt: String(v.created_at ?? ''),
    }));
    return { count: videos.length, videos };
  } catch (err) {
    logger.warn('[openclaw-bridge] video status failed', toError(err), { userId });
    return { count: 0, videos: [] };
  }
}

// ─── sophia_get_handover ──────────────────────────────────────────────────────

export interface HandoverSummary {
  agencyName: string | null;
  tier: string | null;
  status: string | null;
  firstLoginAt: number | null;
  firstSopInstallAt: number | null;
  firstRunAt: number | null;
}

export async function callGetHandover(userId: string): Promise<HandoverSummary | null> {
  try {
    const db = createServerClient();
    const { data: handoverRow } = await db
      .from('customer_handovers')
      .select('agency_name, tier, status, first_login_at, first_sop_install_at, first_run_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!handoverRow) return null;

    const row = handoverRow as Record<string, unknown>;
    return {
      agencyName: row.agency_name as string | null,
      tier: row.tier as string | null,
      status: row.status as string | null,
      firstLoginAt: row.first_login_at as number | null,
      firstSopInstallAt: row.first_sop_install_at as number | null,
      firstRunAt: row.first_run_at as number | null,
    };
  } catch (err) {
    logger.warn('[openclaw-bridge] handover query failed', toError(err), { userId });
    return null;
  }
}
