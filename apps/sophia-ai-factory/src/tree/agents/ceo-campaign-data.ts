/**
 * @module tree/agents/ceo-campaign-data
 *
 * Campaign data fetch and creation operations for CEO agent.
 * Extracted from ceo-executor.ts for file size management.
 *
 * Layer: tree → imports seed only.
 */

import { createServerClient } from '@/seed/db/client';
import { createLogger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { CampaignStatus } from '@/seed/types';
import type { CampaignSummary } from './ceo-intent-types';

const log = createLogger('ceo-executor');

// ── Campaign Data ─────────────────────────────────────────────────────────────

/**
 * Fetch the N most recent campaigns for a user.
 */
export async function fetchRecentCampaigns(
  userId: string,
  limit = 10,
): Promise<CampaignSummary[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from('campaigns')
    .select('id, user_id, title, topic, audience, status, progress, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    log.error('[ceo-executor] Failed to fetch campaigns', {
      message: String(error),
      code: (error as { code?: string }).code ?? 'unknown',
    });
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    title: String(row.title),
    status: String(row.status) as CampaignStatus,
    progress: Number(row.progress),
    topic: String(row.topic),
    audience: String(row.audience),
    createdAt: String(row.created_at),
  }));
}

/**
 * Fetch all campaigns for a user (full dataset).
 */
export async function fetchCampaigns(userId: string): Promise<CampaignSummary[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from('campaigns')
    .select('id, user_id, title, topic, audience, status, progress, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    log.error('[ceo-executor] Failed to fetch campaigns', {
      message: String(error),
      code: (error as { code?: string }).code ?? 'unknown',
    });
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    title: String(row.title),
    status: String(row.status) as CampaignStatus,
    progress: Number(row.progress),
    topic: String(row.topic),
    audience: String(row.audience),
    createdAt: String(row.created_at),
  }));
}

/**
 * Create a new campaign record in D1.
 */
export async function createCampaignForUser(
  userId: string,
  title: string,
  topic: string,
  audience: string,
): Promise<{ id: string } | { error: string }> {
  const db = createServerClient();
  const campaignId = crypto.randomUUID();

  const { error } = await db.from('campaigns').insert({
    id: campaignId,
    user_id: userId,
    title,
    topic,
    audience,
    status: 'pending',
    progress: 0,
    created_at: new Date().toISOString(),
  });

  if (error) {
    log.error('[ceo-executor] Failed to create campaign', {
      message: String(error),
      code: (error as { code?: string }).code ?? 'unknown',
    });
    return { error: `Failed to create campaign: ${getErrorMessage(error)}` };
  }

  return { id: campaignId };
}
