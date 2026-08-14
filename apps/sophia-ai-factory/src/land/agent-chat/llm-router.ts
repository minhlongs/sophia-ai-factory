/**
 * Agent Chat — LLM Route Resolver
 *
 * Priority: local_llm BYO cred → DeepSeek cloud R1 → Anthropic Claude fallback.
 * Returns LlmRoute with provider/baseUrl/apiKey/model ready for OpenAI-compat API call.
 *
 * @module lib/agent-chat/llm-router
 */

import type { LlmRoute } from './types';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

/**
 * Resolve which LLM backend to use for a given user.
 * Throws 'NO_LLM_CONFIGURED' if no provider is available.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function resolveLlmRoute(userId: string): Promise<LlmRoute> {
  // BYO local LLM is deprecated/removed to ensure synchronization. Direct to DeepSeek or Anthropic.

  // 2 — DeepSeek cloud R1
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    return {
      provider: 'deepseek',
      baseUrl: DEEPSEEK_BASE_URL,
      apiKey: deepseekKey,
      model: 'deepseek-reasoner',
    };
  }

  // 3 — Anthropic Claude fallback
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return {
      provider: 'anthropic',
      baseUrl: ANTHROPIC_BASE_URL,
      apiKey: anthropicKey,
      model: 'claude-3-5-sonnet-20241022',
    };
  }

  throw new Error('NO_LLM_CONFIGURED');
}
