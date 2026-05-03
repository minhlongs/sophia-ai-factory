/**
 * Handler: proposal:create
 *
 * Generates a business proposal using OpenRouter LLM.
 * Saves result to proposals table.
 *
 * LIVE — requires OPENROUTER_API_KEY env var or user's own key.
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import type { MissionHandlerResult, MissionContext } from './types';

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
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sophia.agencyos.network',
        'X-Title': 'Sophia AI Factory',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: PROPOSAL_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1200,
        temperature: 0.7,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { ok: false, error: `OpenRouter error: ${resp.status} ${errText.slice(0, 200)}` };
    }

    const json = await resp.json() as { choices: Array<{ message: { content: string } }> };
    const content = json.choices?.[0]?.message?.content ?? '';

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
