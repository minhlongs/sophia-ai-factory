/**
 * D1 database queries for campaign stream state and checkpoints.
 * @module forest/streaming/campaign/campaign-queries
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { CampaignStreamEvent, StepCompleteEvent } from './types';

/**
 * Query D1 for new campaign checkpoints since the last poll.
 */
export async function fetchNewCheckpoints(
  campaignId: string,
  afterTimestamp: string,
): Promise<CampaignStreamEvent[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from('campaign_checkpoints')
    .select('step, completed_at, metadata')
    .eq('campaign_id', campaignId)
    .gt('completed_at', afterTimestamp)
    .order('completed_at', { ascending: true });

  if (error || !data) {
    logger.warn(
      '[campaign-stream] checkpoint query failed',
      error ? new Error(error.message) : undefined,
      { campaignId, afterTimestamp },
    );
    return [];
  }

  return (data as unknown as { step: string; completed_at: string; metadata: string }[])
    .filter((row) => row.completed_at > afterTimestamp)
    .map((row): StepCompleteEvent => {
      let parsedMetadata: Record<string, unknown> = {};
      try {
        parsedMetadata = JSON.parse(row.metadata) as Record<string, unknown>;
      } catch {
        parsedMetadata = { raw: row.metadata };
      }
      return {
        type: 'step_complete',
        timestamp: row.completed_at,
        campaignId,
        step: row.step,
        completedAt: row.completed_at,
        metadata: parsedMetadata,
      };
    });
}

/**
 * Query D1 for the current campaign row.
 */
export async function fetchCampaign(
  campaignId: string,
): Promise<{ status: string; progress: number } | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from('campaigns')
    .select('status, progress')
    .eq('id', campaignId)
    .maybeSingle();

  if (error || !data) {
    logger.warn(
      '[campaign-stream] campaign query failed',
      error ? new Error(error.message) : undefined,
      { campaignId },
    );
    return null;
  }

  return {
    status: (data as { status: string; progress: number }).status,
    progress: (data as { status: string; progress: number }).progress,
  };
}
