/**
 * Database operations for automation server actions.
 * Layer: app/actions
 * @module app/actions/automation-db-helpers
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export async function createCampaignRecord(
  userId: string,
  topic: string,
  audience: string,
): Promise<{ id: string } | { error: string }> {
  const db = createServerClient();
  const { data: campaign, error: dbError } = await db
    .from('campaigns')
    .insert({
      topic,
      audience,
      title: topic,
      status: 'draft',
      user_id: userId,
    })
    .select()
    .single();

  if (dbError || !campaign) {
    logger.error('Failed to create campaign record', toError(dbError));
    return { error: 'Failed to initialize campaign' };
  }

  return { id: (campaign as Record<string, string>).id };
}

export async function updateCampaignForRender(
  scriptId: string,
  userId: string,
): Promise<{ success: true } | { error: string }> {
  const db = createServerClient();
  const { error: dbError } = await db
    .from('campaigns')
    .update({ status: 'processing_video' })
    .eq('id', scriptId)
    .eq('user_id', userId);

  if (dbError) {
    logger.error('Failed to update campaign status for rendering', toError(dbError));
    return { error: 'Failed to update status' };
  }

  return { success: true };
}

export async function fetchUserProjects(userId: string) {
  const db = createServerClient();
  const { data: campaigns, error } = await db
    .from('campaigns')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch user projects', toError(error));
    return [];
  }

  return campaigns || [];
}