/**
 * @module forest/agent-chat/executor/campaign-handlers
 * Campaign query, creation, and cancellation tool execution handlers.
 */

import { createLogger } from '@/seed/utils/logger-utility';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { getD1 } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { TIER_CONFIGS } from '@/seed/config/tiers';
import { getBalance, deductCredits } from '@/tree/mcu/credits-repo';
import { type AgentToolResult, toolOk, toolError } from './types';

const logger = createLogger('tool-executor:campaign');

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

export async function executeCreateCampaign(
  userId: string,
  args: Record<string, unknown>,
): Promise<AgentToolResult> {
  const topic = args.topic as string;
  if (!topic) return toolError('topic is required');

  const tier = await resolveUserTier(userId);
  const tierConfig = TIER_CONFIGS[tier];
  if (!tierConfig) return toolError('Account tier not found');

  const balance = await getBalance(userId).catch(() => null);
  if (!balance || balance.credits_remaining < 5) {
    return toolError('Insufficient credits. Campaign creation requires 5 MCU.');
  }

  const deducted = await deductCredits(userId, 5, 'campaign_creation', 'agent_tool');
  if (!deducted) return toolError('Could not reserve credits for campaign creation.');

  const db = await getD1();
  if (!db) return toolError('Database not available');

  const campaignId = crypto.randomUUID();
  const now = Date.now();
  await db.prepare(
    `INSERT INTO campaigns (id, user_id, title, topic, audience, status, script_content, template_id, progress, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?)`,
  )
    .bind(
      campaignId,
      userId,
      topic.slice(0, 100),
      topic,
      null,
      args.script ? JSON.stringify({ content: args.script }) : null,
      args.template_id ?? null,
      0,
      now,
      now,
    )
    .run();

  try {
    await inngest.send({
      name: 'campaign.created',
      data: {
        campaignId,
        userId,
        topic,
        audience: '',
        tier,
      },
    });
  } catch {
    // Inngest not configured — campaign still created in DB.
  }

  logger.info('Campaign created via tool', undefined, { campaignId, userId });
  return toolOk({ campaign_id: campaignId, name: topic.slice(0, 100), status: 'queued' });
}

export async function executeCancelCampaign(
  userId: string,
  args: Record<string, unknown>,
): Promise<AgentToolResult> {
  const db = await getD1();
  if (!db) return toolError('Database not available');

  const campaignId = args.campaign_id as string;
  if (!campaignId) return toolError('campaign_id is required');

  const { results } = await db
    .prepare('SELECT status FROM campaigns WHERE id = ? AND user_id = ?')
    .bind(campaignId, userId)
    .all();

  const row = (results as Array<Record<string, unknown>>)[0];
  if (!row) return toolError(`Campaign not found: ${campaignId}`);

  const status = row.status as string;
  if (!['queued', 'processing_script', 'processing_video'].includes(status)) {
    return toolError(`Cannot cancel campaign in status: ${status}`);
  }

  await db.prepare("UPDATE campaigns SET status = 'cancelled', updated_at = ? WHERE id = ?")
    .bind(Date.now(), campaignId)
    .run();

  logger.info('Campaign cancelled via tool', undefined, { campaignId, userId });
  return toolOk({ campaign_id: campaignId, new_status: 'cancelled' });
}
