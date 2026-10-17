/**
 * @module forest/agent-chat/executor/campaign-handlers
 * Campaign query, creation, and cancellation tool execution handlers.
 */

import { getD1 } from '@/seed/db/client';
import { type AgentToolResult, toolOk, toolError } from './types';
import {
  executeCreateCampaign,
  executeCancelCampaign,
} from './campaign-mutation-handlers';

export { executeCreateCampaign, executeCancelCampaign };

export async function executeGetCampaigns(
  userId: string,
  args: Record<string, unknown>,
): Promise<AgentToolResult> {
  const db = await getD1();
  if (!db) return toolError('Database not available');

  const statusFilter = args.status as string | undefined;
  const limit = Math.min(Math.max((args.limit as number) ?? 20, 1), 50);

  let query = `SELECT id, name, status, progress, created_at, updated_at FROM campaigns WHERE user_id = ?`;
  const params: unknown[] = [userId];

  if (statusFilter) {
    query += ' AND status = ?';
    params.push(statusFilter);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const { results } = await db.prepare(query).bind(...params).all();
  const campaigns = (results as Array<Record<string, unknown>>).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    progress: row.progress,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return toolOk(campaigns as unknown[]);
}

export async function executeGetCampaignDetail(
  userId: string,
  args: Record<string, unknown>,
): Promise<AgentToolResult> {
  const db = await getD1();
  if (!db) return toolError('Database not available');

  const campaignId = args.campaign_id as string;
  if (!campaignId) return toolError('campaign_id is required');

  const { results } = await db
    .prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?')
    .bind(campaignId, userId)
    .all();

  const campaign = (results as Array<Record<string, unknown>>)[0];
  if (!campaign) return toolError(`Campaign not found: ${campaignId}`);

  const safe = {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    progress: campaign.progress,
    script_content: campaign.script_content,
    video_url: campaign.video_url,
    template_id: campaign.template_id,
    target_platform: campaign.target_platform,
    error_message: campaign.error_message,
    created_at: campaign.created_at,
    updated_at: campaign.updated_at,
  };

  return toolOk(safe);
}
