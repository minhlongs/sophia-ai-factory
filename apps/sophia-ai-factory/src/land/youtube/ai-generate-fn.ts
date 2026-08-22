/**
 * Build an AIGenerateFn for the YouTube pipeline from BYOK credentials.
 * Uses the customer's OpenRouter key when available; falls back to
 * Sophia's multi-provider router when configured.
 * @module land/youtube/ai-generate-fn
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { AIGenerateFn } from '@/tree/youtube-strategy/strategy-generator';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

async function postChat(
  url: string,
  apiKey: string,
  model: string,
  prompt: string,
  maxTokens: number,
  temperature: number,
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are a YouTube content strategist and scriptwriter.' },
    { role: 'user', content: prompt },
  ];
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network',
      'X-Title': 'Sophia AI Factory',
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI chat failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as ChatResponse;
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI chat returned no content');
  return content;
}

/**
 * Resolve the user's AI key and return an AIGenerateFn.
 * Returns null when no key is configured (template fallback is used instead).
 */
export async function buildAIGenerateFn(userId: string): Promise<AIGenerateFn | null> {
  // Lazy import to avoid circular dependency at module load.
  const { getUserCredential } = await import('@/tree/credentials/user-credentials-repo');

  const openrouterKey = await getUserCredential(userId, 'openrouter').catch((err) => {
    logger.warn('buildAIGenerateFn: openrouter lookup failed', { error: toError(err).message, userId });
    return null;
  });
  if (openrouterKey) {
    const model = process.env.OPENROUTER_MODEL ?? 'openrouter/auto';
    return (prompt, options) => postChat(OPENROUTER_URL, openrouterKey, model, prompt, options?.maxTokens ?? 1000, options?.temperature ?? 0.7);
  }

  const openaiKey = await getUserCredential(userId, 'openai').catch((err) => {
    logger.warn('buildAIGenerateFn: openai lookup failed', { error: toError(err).message, userId });
    return null;
  });
  if (openaiKey) {
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    return (prompt, options) => postChat(OPENAI_URL, openaiKey, model, prompt, options?.maxTokens ?? 1000, options?.temperature ?? 0.7);
  }

  return null;
}