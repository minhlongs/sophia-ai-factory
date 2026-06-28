/**
 * Agent Chat — Bilingual System Prompt Builder
 *
 * Builds a system prompt for Sophia Assistant that is locale-aware.
 * Includes platform context: available SOPs, current page, user tier.
 *
 * @module lib/agent-chat/system-prompt
 */

import type { ChatContext } from './types';

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

/**
 * Build a system prompt string for the chat session.
 */
export function buildSystemPrompt(context: ChatContext): string {
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
