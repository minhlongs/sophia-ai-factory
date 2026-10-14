/**
 * @module forest/agent-chat/system-prompt
 *
 * Agent Chat — Bilingual System Prompt Builder with optional memory injection.
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { ChatContext } from './types';
import {
  BASE_PROMPT_EN,
  BASE_PROMPT_VI,
  appendPageAndSessionLines,
  fetchRelevantMemories,
} from './system-prompt-helpers';

/**
 * Options for building the system prompt.
 */
export interface BuildSystemPromptOptions extends ChatContext {
  /** User ID for memory injection (required if injectMemories is true). */
  userId?: string;
  /** Whether to inject relevant memories into the prompt (default false — opt-in). */
  injectMemories?: boolean;
  /** Maximum memories to inject (default 5). */
  maxMemories?: number;
}

/**
 * Build a system prompt string for the chat session.
 */
export async function buildSystemPrompt(
  context: ChatContext,
  options?: BuildSystemPromptOptions,
): Promise<string> {
  const isVietnamese = context.locale === 'vi';
  const base = isVietnamese ? BASE_PROMPT_VI : BASE_PROMPT_EN;
  const injectMemories = options?.injectMemories ?? false;
  const userId = options?.userId;
  const maxMemories = options?.maxMemories ?? 5;

  const lines: string[] = [base];

  if (injectMemories && userId) {
    try {
      const memories = await fetchRelevantMemories(userId, maxMemories);
      if (memories.length > 0) {
        lines.push('');
        lines.push(
          isVietnamese
            ? '--- Thông tin đã biết về người dùng ---'
            : '--- Known user context ---',
        );
        for (const mem of memories) {
          const text =
            mem.content.text.length > 300
              ? mem.content.text.slice(0, 300) + '...'
              : mem.content.text;
          lines.push(`[${mem.memoryType}] ${text}`);
        }
        lines.push(
          isVietnamese
            ? '--- Kết thúc thông tin người dùng ---'
            : '--- End user context ---',
        );
      }
    } catch (err) {
      logger.warn('[SystemPrompt] Memory injection failed, proceeding without', {
        userId,
        error: getErrorMessage(err),
      });
    }
  }

  appendPageAndSessionLines(lines, context, isVietnamese);
  return lines.join('\n');
}

/**
 * Synchronous version of buildSystemPrompt — skips memory injection.
 */
export function buildSystemPromptSync(context: ChatContext): string {
  const isVietnamese = context.locale === 'vi';
  const base = isVietnamese ? BASE_PROMPT_VI : BASE_PROMPT_EN;

  const lines: string[] = [base];
  appendPageAndSessionLines(lines, context, isVietnamese);
  return lines.join('\n');
}
