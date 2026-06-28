/**
 * Handler: proposal:create
 *
 * Generates a business proposal using OpenRouter LLM.
 * Saves result to proposals table.
 *
 * LIVE — requires OPENROUTER_API_KEY env var or user's own key.
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import type { MissionHandlerResult, MissionContext } from '@/forest/missions/types';

const PROPOSAL_SYSTEM_PROMPT = `You are an expert business proposal writer.
Create a compelling, professional business proposal in Markdown format.
Include: Executive Summary, Problem Statement, Proposed Solution, Timeline, Investment, and Next Steps.`;

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { userId, missionId, params } = ctx;
  const niche = (params?.niche as string) ?? 'digital marketing services';
  const clientName = (params?.client_name as string) ?? 'Valued Client';
  const title = (params?.title as string) ?? `Business Proposal for ${clientName}`;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: 'OpenRouter API key not configured. Set OPENROUTER_API_KEY in Settings > Integrations.',
    };
  }

  const userPrompt = `Create a business proposal for ${clientName} in the ${niche} niche.
Title: ${title}
Tone: professional, persuasive
Length: 500-800 words`;

  try {
    const combinedPrompt = `${PROPOSAL_SYSTEM_PROMPT}\n\nUser: ${userPrompt}`;
    const content = await resilientChatCompletion(combinedPrompt, {
      openRouterKey: apiKey,
      anthropicKey: undefined,
      enableFallback: false,
      model: 'openai/gpt-4o-mini',
    });

    // Save to proposals table
    const db = createServerClient();
    const proposalId = crypto.randomUUID();
    await db.from('proposals').insert({
      id: proposalId,
      user_id: userId,
      mission_id: missionId,
      title,
      content,
      niche,
      status: 'draft',
    });

    return {
      ok: true,
      data: {
        proposal_id: proposalId,
        title,
        content,
        niche,
        word_count: content.split(/\s+/).length,
      },
    };
  } catch (err) {
    logger.error('[proposal:create] error', err instanceof Error ? err : new Error(String(err)));
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Proposal generation failed',
    };
  }
}
