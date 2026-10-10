/**
 * Abstractive LLM-Backed Summarizer
 *
 * Layer: tree/memory/summarizer
 */

import type { ChatMessage } from '@/seed/ai/provider-interface';
import {
  SUMMARIZATION_SYSTEM_PROMPT,
  SUMMARIZATION_USER_TEMPLATE,
  estimateTokens,
} from './types';

export async function summarizeWithLLM(
  messages: ChatMessage[],
  maxTokens: number,
  apiKey: string,
  baseUrl: string,
): Promise<{
  summary: string;
  tokenCount: number;
  messagesSummarized: number;
  usedLLM: boolean;
}> {
  const userContent = [
    SUMMARIZATION_USER_TEMPLATE(messages.length),
    ...messages.map((m, i) => `[${i + 1}] ${m.role}: ${m.content}`).join('\n'),
  ].join('');

  const requestBody = {
    model: 'openai/gpt-4o-mini',
    messages: [
      { role: 'system', content: SUMMARIZATION_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    max_tokens: maxTokens,
    temperature: 0.3,
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://sophia.agencyos.network',
      'X-Title': 'Sophia AI Factory',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM summarization failed: ${response.status} ${response.statusText} — ${errorText.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };

  const summaryText = data.choices?.[0]?.message?.content?.trim() ?? '';
  const tokenCount = data.usage?.total_tokens ?? estimateTokens(summaryText);

  return {
    summary: summaryText,
    tokenCount,
    messagesSummarized: messages.length,
    usedLLM: true,
  };
}
