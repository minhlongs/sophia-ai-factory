/**
 * ConversationSummarizer Orchestrator
 *
 * Layer: tree/memory/summarizer
 */

import type { ChatMessage } from '@/seed/ai/provider-interface';
import { logger } from '@/seed/utils/logger-utility';
import type { SummaryResult } from './types';
import { extractKeyPoints, summarizeExtractive } from './extractive-summarizer';
import { summarizeWithLLM } from './abstractive-summarizer';

export class ConversationSummarizer {
  private readonly maxSummaryTokens: number;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor(
    maxSummaryTokens = 500,
    apiKey?: string,
    baseUrl = 'https://openrouter.ai/api/v1',
  ) {
    this.maxSummaryTokens = maxSummaryTokens;
    this.apiKey = apiKey ?? process.env.OPENROUTER_API_KEY;
    this.baseUrl = baseUrl.replace(/\/+$/, '');

    logger.info('[ConversationSummarizer] Initialized', undefined, {
      maxSummaryTokens,
      hasApiKey: Boolean(this.apiKey),
      baseUrl: this.baseUrl,
    });
  }

  async summarize(
    messages: ChatMessage[],
    maxTokens?: number,
  ): Promise<SummaryResult> {
    const effectiveMax = maxTokens ?? this.maxSummaryTokens;

    if (messages.length === 0) {
      return {
        summary: 'No messages to summarize.',
        tokenCount: 3,
        messagesSummarized: 0,
        usedLLM: false,
        topics: [],
        decisions: [],
        userPreferences: [],
        actionItems: [],
        estimatedTokens: 3,
      };
    }

    const keyPoints = this.extractKeyPoints(messages);

    if (this.apiKey) {
      try {
        const result = await summarizeWithLLM(
          messages,
          effectiveMax,
          this.apiKey,
          this.baseUrl,
        );
        logger.info('[ConversationSummarizer] LLM summary complete', undefined, {
          messagesSummarized: result.messagesSummarized,
          tokenCount: result.tokenCount,
        });
        return {
          ...result,
          topics: keyPoints.topics,
          decisions: keyPoints.decisions,
          userPreferences: keyPoints.userPreferences,
          actionItems: keyPoints.actionItems,
          estimatedTokens: result.tokenCount,
        };
      } catch (err) {
        logger.warn(
          '[ConversationSummarizer] LLM summarization failed, using fallback',
          undefined,
          { error: err instanceof Error ? err.message : String(err) },
        );
      }
    }

    const fallback = summarizeExtractive(messages, effectiveMax);
    logger.info('[ConversationSummarizer] Extractive fallback summary', undefined, {
      messagesSummarized: fallback.messagesSummarized,
      tokenCount: fallback.tokenCount,
    });
    return {
      ...fallback,
      topics: keyPoints.topics,
      decisions: keyPoints.decisions,
      userPreferences: keyPoints.userPreferences,
      actionItems: keyPoints.actionItems,
      estimatedTokens: fallback.tokenCount,
    };
  }

  extractKeyPoints(messages: ChatMessage[]): {
    topics: string[];
    decisions: string[];
    userPreferences: string[];
    actionItems: string[];
  } {
    return extractKeyPoints(messages);
  }
}
