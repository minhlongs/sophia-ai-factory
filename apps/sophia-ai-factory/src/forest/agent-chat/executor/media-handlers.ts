/**
 * @module forest/agent-chat/executor/media-handlers
 * Video/voice models, media search, credit balance, and chat history handlers.
 */

import { getD1 } from '@/seed/db/client';
import { getBalance } from '@/tree/mcu/credits-repo';
import { getMemoryConsolidationService } from '../memory-consolidation-service';
import { type AgentToolResult, toolOk, toolError } from './types';

export async function executeListVideoModels(userId: string): Promise<AgentToolResult> {
  const db = await getD1();
  if (!db) return toolError('Database not available');

  const { results } = await db
    .prepare(`SELECT provider_name, model_name, is_active FROM byok_credentials
      WHERE user_id = ? AND service_type IN ('openrouter', 'anthropic') AND is_active = 1`)
    .bind(userId)
    .all();

  const models = (results as Array<Record<string, unknown>>).map((row) => ({
    provider: row.provider_name,
    model: row.model_name,
    active: row.is_active,
  }));

  return toolOk(models.length > 0 ? models : [{ provider: 'openrouter', model: 'default', active: true }] as unknown[]);
}

export async function executeListVoiceModels(userId: string): Promise<AgentToolResult> {
  const db = await getD1();
  if (!db) return toolError('Database not available');

  const { results } = await db
    .prepare(`SELECT provider_name, model_name, is_active FROM byok_credentials
      WHERE user_id = ? AND service_type = 'elevenlabs' AND is_active = 1`)
    .bind(userId)
    .all();

  const models = (results as Array<Record<string, unknown>>).map((row) => ({
    provider: row.provider_name,
    voice: row.model_name,
    active: row.is_active,
  }));

  return toolOk(models.length > 0 ? models : [{ provider: 'elevenlabs', voice: 'default', active: false }] as unknown[]);
}

export async function executeSearchMedia(
  userId: string,
  args: Record<string, unknown>,
): Promise<AgentToolResult> {
  const db = await getD1();
  if (!db) return toolError('Database not available');

  const query = (args.query as string)?.trim();
  if (!query) return toolError('query is required');

  const limit = Math.min(Math.max((args.limit as number) ?? 10, 1), 50);

  const { results } = await db
    .prepare(`SELECT id, filename, media_type, file_size, created_at, r2_key
      FROM media_assets WHERE user_id = ? AND filename LIKE ? LIMIT ?`)
    .bind(userId, `%${query}%`, limit)
    .all();

  const assets = (results as Array<Record<string, unknown>>).map((row) => ({
    id: row.id,
    filename: row.filename,
    media_type: row.media_type,
    file_size: row.file_size,
    created_at: row.created_at,
  }));

  return toolOk(assets as unknown[]);
}

export async function executeGetCreditBalance(userId: string): Promise<AgentToolResult> {
  const balance = await getBalance(userId).catch(() => null);
  if (!balance) return toolError('Could not retrieve credit balance');

  return toolOk({
    credits_remaining: balance.credits_remaining,
    credits_total_purchased: balance.credits_total_purchased ?? 0,
    credits_total_used: balance.credits_total_used ?? 0,
  });
}

export async function executeGetChatHistory(
  userId: string,
  args: Record<string, unknown>,
): Promise<AgentToolResult> {
  const consolidationService = getMemoryConsolidationService();
  const limit = Math.min(Math.max((args.limit as number) ?? 10, 1), 20);

  const memories = await consolidationService.listConversationMemories(userId, limit);
  const history = memories.map((m) => ({
    conversation_id: m.conversationId,
    summary: m.summary,
    message_count: m.messageCount,
    last_consolidated_at: m.lastConsolidatedAt,
  }));

  return toolOk(history);
}
