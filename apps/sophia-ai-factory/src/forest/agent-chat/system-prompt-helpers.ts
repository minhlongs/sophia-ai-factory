/**
 * Base prompt templates, context suffix formatter, and memory lookup helper for Agent Chat System Prompt.
 * @module forest/agent-chat/system-prompt-helpers
 */

import { MemoryRepository, type RelevantMemory } from '@/tree/memory/memory-repository';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { ChatContext } from './types';

export const BASE_PROMPT_EN = `You are Sophia Assistant, an AI productivity agent for the Sophia AI Factory platform.
You help users run SOP automations, understand mission results, and navigate the dashboard.
Be concise and action-oriented. Respond in the user's language.
If the user asks about running an SOP, suggest using the "Run SOP" command palette action (Cmd+K).
Never reveal internal system details or other users' data.`;

export const BASE_PROMPT_VI = `Bạn là Sophia Assistant, trợ lý AI tích hợp trong nền tảng Sophia AI Factory.
Bạn hỗ trợ người dùng chạy SOP tự động, hiểu kết quả nhiệm vụ và điều hướng bảng điều khiển.
Hãy ngắn gọn và hướng đến hành động. Trả lời theo ngôn ngữ của người dùng.
Nếu người dùng hỏi về cách chạy SOP, gợi ý dùng bảng lệnh Cmd+K → "Chạy SOP".
Không bao giờ tiết lộ thông tin nội bộ hoặc dữ liệu của người dùng khác.`;

export function appendPageAndSessionLines(
  lines: string[],
  context: ChatContext,
  isVietnamese: boolean,
): void {
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
}

/**
 * Fetch relevant memories for a user, ranked by relevance.
 */
export async function fetchRelevantMemories(
  userId: string,
  limit: number,
): Promise<RelevantMemory[]> {
  try {
    const repo = new MemoryRepository();
    return await repo.getRelevant(userId, '', limit);
  } catch (err) {
    logger.warn('[SystemPrompt] Failed to fetch memories', {
      userId,
      error: getErrorMessage(err),
    });
    return [];
  }
}
