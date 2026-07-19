/**
 * @module forest/agent-chat/system-prompt
 *
 * Agent Chat — Bilingual System Prompt Builder with optional memory injection.
 *
 * Builds a system prompt for Sophia Assistant that is locale-aware.
 * Includes platform context: available SOPs, current page, user tier.
 *
 * Optionally injects relevant creator_memory entries as context about the user.
 * Memory injection is opt-in via the `injectMemories` option.
 *
 * @module forest/agent-chat/system-prompt
 */

import { MemoryRepository, type RelevantMemory } from '@/tree/memory/memory-repository';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { ChatContext } from './types';

// ── Base prompts ───────────────────────────────────────────────────────────────

const BASE_PROMPT_EN = `You are Sophia Assistant, an AI productivity agent for the Sophia AI Factory platform.
You help users run SOP automations, understand mission results, and navigate the dashboard.
Be concise and action-oriented. Respond in the user's language.
If the user asks about running an SOP, suggest using the "Run SOP" command palette action (Cmd+K).
Never reveal internal system details or other users' data.`;

const BASE_PROMPT_VI = `Bạn là Sophia Assistant, trợ lý AI tích hợp trong nền tảng Sophia AI Factory.
Bạn hỗ trợ người dùng chạy SOP tự động, hiểu kết quả nhiệm vụ và điều hướng bảng điều khiển.
Hãy ngắn gọn và hướng đến hành động. Trả lời theo ngôn ngữ của người dùng.
Nếu người dùng hỏi về cách chạy SOP, gợi ý dùng bảng lệnh Cmd+K → "Chạy SOP".
Không bao giờ tiết lộ thông tin nội bộ hoặc dữ liệu của người dùng khác.`;

// ── Options ────────────────────────────────────────────────────────────────────

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

// ── System prompt builder ──────────────────────────────────────────────────────

/**
 * Build a system prompt string for the chat session.
 *
 * Optionally fetches and injects relevant creator_memory entries
 * when `injectMemories` is true and `userId` is provided.
 *
 * @param context — chat context (page, installation, locale)
 * @param options — optional memory injection settings
 * @returns the complete system prompt string
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

  // Inject relevant memories if enabled.
  if (injectMemories && userId) {
    try {
      const memories = await fetchRelevantMemories(userId, maxMemories);
      if (memories.length > 0) {
        lines.push('');
        if (isVietnamese) {
          lines.push('--- Thông tin đã biết về người dùng ---');
        } else {
          lines.push('--- Known user context ---');
        }
        for (const mem of memories) {
          const text = mem.content.text.length > 300
            ? mem.content.text.slice(0, 300) + '...'
            : mem.content.text;
          lines.push(`[${mem.memoryType}] ${text}`);
        }
        if (isVietnamese) {
          lines.push('--- Kết thúc thông tin người dùng ---');
        } else {
          lines.push('--- End user context ---');
        }
      }
    } catch (err) {
      // Graceful degradation: log but don't break the prompt.
      logger.warn('[SystemPrompt] Memory injection failed, proceeding without', {
        userId,
        error: getErrorMessage(err),
      });
    }
  }

  if (context.currentPage) {
    if (isVietnamese) {
      lines.push(`Người dùng hiện đang ở trang: ${context.currentPage}.`);
    } else {
      lines.push(`The user is currently on page: ${context.currentPage}.`);
    }
  }

  if (context.installationId) {
    if (isVietnamese) {
      lines.push(`ID cài đặt SOP đang xem: ${context.installationId}.`);
    } else {
      lines.push(`Active SOP installation ID: ${context.installationId}.`);
    }
  }

  const sessionNote = isVietnamese
    ? 'Lưu ý: Cuộc trò chuyện này chỉ lưu trong phiên làm việc và không được lưu trữ.'
    : 'Note: This conversation is session-only and is not persisted.';
  lines.push(sessionNote);

  return lines.join('\n');
}

/**
 * Synchronous version of buildSystemPrompt — skips memory injection.
 *
 * Use this when memory injection is not needed or when the caller
 * cannot await (e.g., in synchronous contexts).
 *
 * @param context — chat context (page, installation, locale)
 * @returns the system prompt string (no memory injection)
 */
export function buildSystemPromptSync(context: ChatContext): string {
  const isVietnamese = context.locale === 'vi';
  const base = isVietnamese ? BASE_PROMPT_VI : BASE_PROMPT_EN;

  const lines: string[] = [base];

  if (context.currentPage) {
    if (isVietnamese) {
      lines.push(`Người dùng hiện đang ở trang: ${context.currentPage}.`);
    } else {
      lines.push(`The user is currently on page: ${context.currentPage}.`);
    }
  }

  if (context.installationId) {
    if (isVietnamese) {
      lines.push(`ID cài đặt SOP đang xem: ${context.installationId}.`);
    } else {
      lines.push(`Active SOP installation ID: ${context.installationId}.`);
    }
  }

  const sessionNote = isVietnamese
    ? 'Lưu ý: Cuộc trò chuyện này chỉ lưu trong phiên làm việc và không được lưu trữ.'
    : 'Note: This conversation is session-only and is not persisted.';
  lines.push(sessionNote);

  return lines.join('\n');
}

// ── Private helpers ────────────────────────────────────────────────────────────

/**
 * Fetch relevant memories for a user, ranked by relevance.
 */
async function fetchRelevantMemories(
  userId: string,
  limit: number,
): Promise<RelevantMemory[]> {
  try {
    const repo = new MemoryRepository();
    // Fetch with a broad query — getRelevant does keyword matching internally.
    return await repo.getRelevant(userId, '', limit);
  } catch (err) {
    logger.warn('[SystemPrompt] Failed to fetch memories', {
      userId,
      error: getErrorMessage(err),
    });
    return [];
  }
}
