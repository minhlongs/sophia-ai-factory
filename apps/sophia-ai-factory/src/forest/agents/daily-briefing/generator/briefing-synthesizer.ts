import { resolveLlmRoute } from '@/forest/agent-chat/llm-router';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  MAX_LLM_RETRIES,
  BRIEFING_TIMEOUT_MS,
} from './types';
import {
  CEO_BRIEFING_SYSTEM_PROMPT_EN,
  CEO_BRIEFING_SYSTEM_PROMPT_VI,
  buildBriefingPrompt,
} from './prompt-assembler';

/**
 * Call the LLM to generate a briefing text.
 * Returns null if the LLM is not configured or the call fails.
 */
export async function callLlmForBriefing(
  userId: string,
  locale: string,
): Promise<string | null> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt < MAX_LLM_RETRIES; attempt++) {
    try {
      const route = await resolveLlmRoute(userId);
      const isVietnamese = locale === 'vi';

      const systemPrompt = isVietnamese
        ? CEO_BRIEFING_SYSTEM_PROMPT_VI
        : CEO_BRIEFING_SYSTEM_PROMPT_EN;

      const userPrompt = buildBriefingPrompt(locale);

      // Non-streaming POST to OpenAI-compatible endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BRIEFING_TIMEOUT_MS);

      try {
        const response = await fetch(`${route.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${route.apiKey}`,
          },
          body: JSON.stringify({
            model: route.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 1024,
            temperature: 0.5,
            stream: false,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => 'unknown error');
          lastError = `HTTP ${response.status}: ${errText}`;
          logger.warn('[DailyBriefing] LLM call failed', {
            attempt,
            error: lastError,
            status: response.status,
          });
          continue;
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          return content;
        }

        lastError = 'Empty response from LLM';
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      lastError = isTimeout
        ? `LLM call timed out after ${BRIEFING_TIMEOUT_MS}ms`
        : getErrorMessage(err);

      logger.warn('[DailyBriefing] LLM call attempt failed', {
        attempt,
        error: lastError,
        isTimeout,
      });
    }
  }

  logger.error('[DailyBriefing] All LLM call attempts exhausted', { lastError });
  return null;
}
