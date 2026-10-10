/**
 * @module forest/dashboard/metrics/video-metrics-aggregator
 * Campaign and video render metrics aggregation.
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { Campaign } from '@/seed/types';
import type { DashboardResult, CampaignMetrics } from './types';

/**
 * Fetch campaign-specific metrics
 */
export async function fetchCampaignMetrics(
  userId: string
): Promise<DashboardResult<CampaignMetrics>> {
  try {
    const db = createServerClient();

    const result = await db
      .from('campaigns')
      .select('id, status, created_at, video_url', { count: 'exact' })
      .eq('user_id', userId);

    if (result.error) {
      throw new Error(result.error.message);
    }

    const campaigns = (result.data as unknown as Campaign[]) || [];

    const total = campaigns.length;
    const completed = campaigns.filter(c => c.status === 'completed').length;
    const failed = campaigns.filter(c => c.status === 'failed').length;
    const active = campaigns.filter(c =>
      ['queued', 'processing_script', 'processing_video'].includes(c.status)
    ).length;
    const videosGenerated = campaigns.filter(c => !!c.video_url).length;

    // Success rate: completed / (completed + failed) avoiding division by zero
    const successRate = completed + failed > 0
      ? (completed / (completed + failed)) * 100
      : 0;

    const lastCampaign = campaigns
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    return {
      ok: true,
      data: {
        totalCampaigns: total,
        activeCampaigns: active,
        completedCampaigns: completed,
        failedCampaigns: failed,
        totalVideosGenerated: videosGenerated,
        successRate,
        lastCampaignDate: lastCampaign?.created_at || undefined,
      },
    };
  } catch (error) {
    logger.error('[dashboard] Failed to fetch campaign metrics', toError(error));
    return {
      ok: false,
      error: 'Failed to fetch campaign metrics',
    };
  }
}

/**
 * Fetch recent campaigns for a user
 */
export async function fetchRecentCampaigns(
  userId: string,
  limit: number = 10
): Promise<DashboardResult<Campaign[]>> {
  try {
    const db = createServerClient();

    const result = await db
      .from('campaigns')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (result.error) {
      throw new Error(result.error.message);
    }

    const campaigns = (result.data as unknown as Campaign[]) || [];

    return {
      ok: true,
      data: campaigns,
    };
  } catch (error) {
    logger.error('[dashboard] Failed to fetch recent campaigns', toError(error));
    return {
      ok: false,
      error: 'Failed to fetch recent campaigns',
    };
  }
}
