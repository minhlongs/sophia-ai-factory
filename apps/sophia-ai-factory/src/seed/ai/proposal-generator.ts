/**
 * Proposal generator — shared library for HTTP route + mission handler.
 *
 * Uses OpenRouter (canonical AI gateway). BYOK via `apiKey` param, else falls
 * back to `OPENROUTER_API_KEY` env var.
 */

import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import { buildSystemPrompt, buildUserPrompt } from './proposal-prompts';
import { parseProposalContent } from './proposal-parser';
import type { ProposalGenerationParams, GeneratedProposal } from './proposal-types';

export type { ProposalGenerationParams, GeneratedProposal } from './proposal-types';

export async function generateProposal(
  params: ProposalGenerationParams,
): Promise<GeneratedProposal> {
  const apiKey = params.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OpenRouter API key not configured. Set OPENROUTER_API_KEY in Settings > Integrations.',
    );
  }

  const startTime = Date.now();
  const systemPrompt = buildSystemPrompt(params.tone, params.length);
  const userPrompt = buildUserPrompt(params);
  const fullPrompt = `System: ${systemPrompt}\n\nUser: ${userPrompt}`;

  const content = await resilientChatCompletion(fullPrompt, {
    openRouterKey: apiKey,
    anthropicKey: undefined,
    enableFallback: false,
    model: 'openai/gpt-4o-mini',
  });

  const endTime = Date.now();
  const parsed = parseProposalContent(content);

  return {
    ...parsed,
    metadata: {
      tokenCount: content.length / 4, // rough estimate
      generationTimeMs: endTime - startTime,
      model: 'openrouter-model',
    },
  };
}
