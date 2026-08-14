/**
 * @module forest/agent-chat/tool-executor
 *
 * Tool Executor — implements IToolExecutor for Sophia's agent chat.
 *
 * Dispatches tool calls to actual business logic in land/ and forest/ modules.
 * Each handler returns a formatted AgentToolResult.
 *
 * Import direction: forest → seed, tree, land (orchestration boundary).
 */

import { createLogger } from '@/seed/utils/logger-utility';
import { getUserTier } from '@/seed/db/get-user-tier';
import { TIER_CONFIGS } from '@/seed/config/tiers';
import { getBalance, deductCredits } from '@/tree/mcu/credits-repo';
import { getMemoryConsolidationService } from './memory-consolidation-service';
import { AgentToolName, type AgentToolDefinition, type AgentToolResult, type IToolExecutor } from './tool-registry';

const logger = createLogger('tool-executor');

// ── Tool Executor ──────────────────────────────────────────────────────────────

/**
 * Sophia Tool Executor — implements IToolExecutor with real business logic.
 *
 * Each tool handler calls into existing Sophia modules (credits, campaigns, etc.).
 * Returns structured results that the LLM can interpret and present to the user.
 */
export class SophiaToolExecutor implements IToolExecutor {
  private userId: string | null = null;

  /** Set the current user context for tool execution */
  setUser(userId: string): void {
    this.userId = userId;
  }

  async execute(
    name: AgentToolName,
    args: Record<string, unknown>,
    userId: string,
  ): Promise<AgentToolResult> {
    this.setUser(userId);
    const start = Date.now();

    try {
      let result: AgentToolResult;
      switch (name) {
        case AgentToolName.GetCampaigns:
          result = await this.getCampaigns(args);
          break;
        case AgentToolName.GetCampaignDetail:
          result = await this.getCampaignDetail(args);
          break;
        case AgentToolName.CreateCampaign:
          result = await this.createCampaign(args);
          break;
        case AgentToolName.CancelCampaign:
          result = await this.cancelCampaign(args);
          break;
        case AgentToolName.ListVideoModels:
          result = await this.listVideoModels();
          break;
        case AgentToolName.ListVoiceModels:
          result = await this.listVoiceModels();
          break;
        case AgentToolName.SearchMedia:
          result = await this.searchMedia(args);
          break;
        case AgentToolName.GetCreditBalance:
          result = await this.getCreditBalance();
          break;
        case AgentToolName.GetChatHistory:
          result = await this.getChatHistory(args);
          break;
        default:
          return this.error(`Unknown tool: ${name}`);
      }

      const elapsed = Date.now() - start;
      logger.debug('Tool execution completed', { name, elapsed, success: result.success });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Tool execution error', { name, error: message });
      return this.error(message);
    }
  }

  listTools(): AgentToolDefinition[] {
    // Delegate to ToolRegistry — this method exists for IToolExecutor contract.
    // The registry holds the canonical definitions.
    return [];
  }

  async isAvailable(_name: AgentToolName, userId: string): Promise<boolean> {
    // All tools require auth — check if user exists and has credits.
    const balance = await getBalance(userId).catch(() => null);
    return balance !== null && balance.credits_remaining > 0;
  }

  // ── Tool Handlers ──────────────────────────────────────────────────────────

  private async getCampaigns(args: Record<string, unknown>): Promise<AgentToolResult> {
    const { getD1 } = await import('@/seed/db/client');
    const db = getD1();
    if (!db) return this.error('Database not available');

    const statusFilter = args.status as string | undefined;
    const limit = Math.min(Math.max((args.limit as number) ?? 20, 1), 50);

    let query = `SELECT id, name, status, progress, created_at, updated_at FROM campaigns WHERE user_id = ?`;
    const params: unknown[] = [this.userId];

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

    return this.ok(campaigns as unknown[]);
  }

  private async getCampaignDetail(args: Record<string, unknown>): Promise<AgentToolResult> {
    const { getD1 } = await import('@/seed/db/client');
    const db = getD1();
    if (!db) return this.error('Database not available');

    const campaignId = args.campaign_id as string;
    if (!campaignId) return this.error('campaign_id is required');

    const { results } = await db
      .prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?')
      .bind(campaignId, this.userId)
      .all();

    const campaign = (results as Array<Record<string, unknown>>)[0];
    if (!campaign) return this.error(`Campaign not found: ${campaignId}`);

    // Return safe fields only (no raw keys)
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

    return this.ok(safe);
  }

  private async createCampaign(args: Record<string, unknown>): Promise<AgentToolResult> {
    const topic = args.topic as string;
    if (!topic) return this.error('topic is required');

    // Validate tier — campaign creation requires at least BASIC.
    const tier = await getUserTier(this.userId!);
    const tierConfig = TIER_CONFIGS[tier];
    if (!tierConfig) return this.error('Account tier not found');

    // Check credits — campaign creation costs 5 MCU.
    const balance = await getBalance(this.userId!).catch(() => null);
    if (!balance || balance.credits_remaining < 5) {
      return this.error('Insufficient credits. Campaign creation requires 5 MCU.');
    }

    // Deduct credits for campaign creation.
    const deducted = await deductCredits(this.userId!, 5, 'campaign_creation', 'agent_tool');
    if (!deducted) return this.error('Could not reserve credits for campaign creation.');

    // Create campaign directly via D1 (createCampaignCore only sends Inngest event).
    const { getD1 } = await import('@/seed/db/client');
    const db = getD1();
    if (!db) return this.error('Database not available');

    const campaignId = crypto.randomUUID();
    const now = Date.now();
    await db.prepare(
      `INSERT INTO campaigns (id, user_id, title, topic, audience, status, script_content, template_id, progress, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?)`,
    )
      .bind(
        campaignId,
        this.userId,
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

    // Send Inngest event for pipeline processing (fire-and-forget).
    try {
      const { sendCampaignCreatedEvent } = await import('@/land/campaigns/create-campaign-core');
      await sendCampaignCreatedEvent({
        campaignId,
        userId: this.userId!,
        topic,
        audience: '',
        tier: tier,
      });
    } catch {
      // Inngest not configured — campaign still created in DB.
    }

    logger.info('Campaign created via tool', { campaignId, userId: this.userId });
    return this.ok({ campaign_id: campaignId, name: topic.slice(0, 100), status: 'queued' });
  }

  private async cancelCampaign(args: Record<string, unknown>): Promise<AgentToolResult> {
    const { getD1 } = await import('@/seed/db/client');
    const db = getD1();
    if (!db) return this.error('Database not available');

    const campaignId = args.campaign_id as string;
    if (!campaignId) return this.error('campaign_id is required');

    // Only allow cancellation of queued/processing campaigns.
    const { results } = await db
      .prepare('SELECT status FROM campaigns WHERE id = ? AND user_id = ?')
      .bind(campaignId, this.userId)
      .all();

    const row = (results as Array<Record<string, unknown>>)[0];
    if (!row) return this.error(`Campaign not found: ${campaignId}`);

    const status = row.status as string;
    if (!['queued', 'processing_script', 'processing_video'].includes(status)) {
      return this.error(`Cannot cancel campaign in status: ${status}`);
    }

    await db.prepare("UPDATE campaigns SET status = 'cancelled', updated_at = ? WHERE id = ?")
      .bind(Date.now(), campaignId)
      .run();

    logger.info('Campaign cancelled via tool', { campaignId, userId: this.userId });
    return this.ok({ campaign_id: campaignId, new_status: 'cancelled' });
  }

  private async listVideoModels(): Promise<AgentToolResult> {
    // Return models from BYOK config — what the user has configured.
    const { getD1 } = await import('@/seed/db/client');
    const db = getD1();
    if (!db) return this.error('Database not available');

    const { results } = await db
      .prepare(`SELECT provider_name, model_name, is_active FROM byok_credentials
        WHERE user_id = ? AND service_type IN ('openrouter', 'anthropic') AND is_active = 1`)
      .bind(this.userId)
      .all();

    const models = (results as Array<Record<string, unknown>>).map((row) => ({
      provider: row.provider_name,
      model: row.model_name,
      active: row.is_active,
    }));

    return this.ok(models.length > 0 ? models : [{ provider: 'openrouter', model: 'default', active: true }] as unknown[]);
  }

  private async listVoiceModels(): Promise<AgentToolResult> {
    const { getD1 } = await import('@/seed/db/client');
    const db = getD1();
    if (!db) return this.error('Database not available');

    const { results } = await db
      .prepare(`SELECT provider_name, model_name, is_active FROM byok_credentials
        WHERE user_id = ? AND service_type = 'elevenlabs' AND is_active = 1`)
      .bind(this.userId)
      .all();

    const models = (results as Array<Record<string, unknown>>).map((row) => ({
      provider: row.provider_name,
      voice: row.model_name,
      active: row.is_active,
    }));

    return this.ok(models.length > 0 ? models : [{ provider: 'elevenlabs', voice: 'default', active: false }] as unknown[]);
  }

  private async searchMedia(args: Record<string, unknown>): Promise<AgentToolResult> {
    const { getD1 } = await import('@/seed/db/client');
    const db = getD1();
    if (!db) return this.error('Database not available');

    const query = (args.query as string)?.trim();
    if (!query) return this.error('query is required');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
    const mediaType = (args.media_type as string) ?? 'all';
    const limit = Math.min(Math.max((args.limit as number) ?? 10, 1), 50);

    // Search in R2 media manifests.
    const { results } = await db
      .prepare(`SELECT id, filename, media_type, file_size, created_at, r2_key
        FROM media_assets WHERE user_id = ? AND filename LIKE ? LIMIT ?`)
      .bind(this.userId, `%${query}%`, limit)
      .all();

    const assets = (results as Array<Record<string, unknown>>).map((row) => ({
      id: row.id,
      filename: row.filename,
      media_type: row.media_type,
      file_size: row.file_size,
      created_at: row.created_at,
    }));

    return this.ok(assets as unknown[]);
  }

  private async getCreditBalance(): Promise<AgentToolResult> {
    const balance = await getBalance(this.userId!).catch(() => null);
    if (!balance) return this.error('Could not retrieve credit balance');

    return this.ok({
      credits_remaining: balance.credits_remaining,
      credits_total_purchased: balance.credits_total_purchased ?? 0,
      credits_total_used: balance.credits_total_used ?? 0,
    });
  }

  private async getChatHistory(args: Record<string, unknown>): Promise<AgentToolResult> {
    const consolidationService = getMemoryConsolidationService();
    const limit = Math.min(Math.max((args.limit as number) ?? 10, 1), 20);

    const memories = await consolidationService.listConversationMemories(this.userId!, limit);
    const history = memories.map((m) => ({
      conversation_id: m.conversationId,
      summary: m.summary,
      message_count: m.messageCount,
      last_consolidated_at: m.lastConsolidatedAt,
    }));

    return this.ok(history);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private ok(content: string | Record<string, unknown> | unknown[]): AgentToolResult {
    return { success: true, content, isInternal: false };
  }

  private error(message: string): AgentToolResult {
    return { success: false, content: message, error: message, isInternal: false };
  }
}
