/**
 * `@Sophia_Bbot` Conversational Affiliate Concierge Handler.
 *
 * Handles `/ask <query>` and `/start concierge_<slug>` to guide high-intent
 * traffic from YouTube/LLM citations to contextual `/api/r/[code]` affiliate
 * links while keeping protected `/campaign`, `/status`, `/results` untouched.
 *
 * @module tree/telegram/handlers/concierge-handler
 */

import { sendTelegramMessage } from '../telegram-client';

const DEFAULT_CF_BASE_URL = 'https://sophia-ai-factory.agencyos-openclaw.workers.dev';
const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,80}$/i;

export interface ConciergeRecommendation {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly shortUrl: string;
  readonly citationUrl: string;
}

export function buildConciergeReply(
  query: string,
  baseUrl = DEFAULT_CF_BASE_URL,
): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const trimmed = query.trim();

  if (!trimmed) {
    return [
      '🤖 *Sophia Affiliate Concierge*',
      '',
      'Gửi `/ask <nhu cầu của bạn>` để nhận gợi ý sản phẩm/SaaS phù hợp kèm link đối tác đã xác minh.',
      'Ví dụ: `/ask công cụ AI viết nội dung cho team nhỏ`',
      '',
      `📄 Danh mục trích dẫn AI (llms.txt): ${cleanBase}/llms.txt`,
    ].join('\n');
  }

  const normalizedSlug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'featured-offer';

  return [
    `🤖 *Sophia Concierge — Gợi ý cho:* "${trimmed.slice(0, 120)}"`,
    '',
    `1. *Đánh giá chi tiết & So sánh (GEO):* ${cleanBase}/c/${normalizedSlug}`,
    `2. *Bản tóm tắt Markdown cho AI Agent:* ${cleanBase}/c/${normalizedSlug}/md`,
    `3. *Link đối tác đã xác minh (#ad):* ${cleanBase}/api/r/${normalizedSlug}`,
    '',
    '💡 _Trả lời tiếp bằng `/ask <tiêu chí ngân sách hoặc tính năng>` để lọc sâu hơn._',
  ].join('\n');
}

export function buildConciergeDeepLinkReply(
  slug: string,
  baseUrl = DEFAULT_CF_BASE_URL,
): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const safeSlug = SAFE_SLUG_RE.test(slug) ? slug : 'featured-offer';
  return [
    `👋 *Chào mừng bạn đến với Sophia Affiliate Concierge!*`,
    '',
    `Bạn đang xem đánh giá cho: \`${safeSlug}\``,
    `• 📄 Trang phân tích & FAQ: ${cleanBase}/c/${safeSlug}`,
    `• 🔗 Link ưu đãi chính thức (#ad): ${cleanBase}/api/r/${safeSlug}`,
    '',
    'Bạn cần so sánh thêm về giá, tính năng hay ưu/nhược điểm? Gõ `/ask <câu hỏi>` ngay nhé!',
  ].join('\n');
}

export async function handleConciergeAsk(chatId: string, query: string): Promise<void> {
  const baseUrl =
    process.env.APP_URL || process.env.WORKER_TECHNICAL_URL || DEFAULT_CF_BASE_URL;
  await sendTelegramMessage(chatId, buildConciergeReply(query, baseUrl));
}

export async function handleConciergeStart(chatId: string, slug: string): Promise<void> {
  const baseUrl =
    process.env.APP_URL || process.env.WORKER_TECHNICAL_URL || DEFAULT_CF_BASE_URL;
  await sendTelegramMessage(chatId, buildConciergeDeepLinkReply(slug, baseUrl));
}
