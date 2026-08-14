/**
 * @module tree/agents/ceo-intent-detector
 *
 * CEO agent intent detection from natural-language user input.
 * Extracted from ceo-executor.ts for file size management.
 *
 * Layer: tree → imports seed only.
 */

import type { CeoIntent, CampaignSummary } from './ceo-intent-types';

// ── Keyword lists ─────────────────────────────────────────────────────────────

const CAMPAIGN_LIST_KEYWORDS =
  /campaign|chiến dịch|list|danh sách|shows?|hiện|latest|mới nhất|recent|gần đây/i;
const CAMPAIGN_STATUS_KEYWORDS =
  /status|trạng thái|progress|tiến độ|how.*(doing|làm)|đang怎么样/i;
const CAMPAIGN_CREATE_KEYWORDS =
  /create|tạo|new|mới|launch|phát|start|bắt đầu|chạy|run|make|làm/i;
const REVENUE_KEYWORDS =
  /revenue|doanh thu|income|thu nhập|earnings|kiếm được|money|tiền|sales|bán|profit|lợi nhuận|financial|tài chính|budget|ngân sách|subscription|đăng ký|tier|gói|billing|hóa đơn/i;

/** Extract a slug / topic from the input text. */
export function extractTopicFromInput(input: string): string | null {
  // Remove greetings and filler
  const cleaned = input
    .replace(/^(hi|hello|xin chào|hey|xin phép)\s*,?\s*/i, '')
    .replace(/^(please|xin hãy|cho tôi|tôi muốn)\s+/i, '')
    .trim();

  // Try to find quoted topic
  const quoted = cleaned.match(/["'"']([^"'"']+)["'"']/);
  if (quoted) return quoted[1].trim();

  // Try to find "about X" pattern
  const aboutMatch = cleaned.match(/(?:about|về|cho|for|regarding)\s+(.+?)(?:\.|$)/i);
  if (aboutMatch) return aboutMatch[1].trim().slice(0, 100);

  // Return remaining text after removing command words
  const withoutCommand = cleaned
    .replace(/^(?:run|create|start|make|new|tạo|chạy|bắt đầu)\s+(?:a\s+)?(?:campaign|chiến dịch)\s+/i, '')
    .trim();

  return withoutCommand.slice(0, 100) || null;
}

/**
 * Detect the user's intent from natural-language input.
 *
 * Returns an intent enum and optional topic/parsed parameters
 * that downstream functions can use to fetch data or create resources.
 */
export function detectIntent(
  input: string,
  campaigns: CampaignSummary[],
): { intent: CeoIntent; topic?: string } {
  const lc = input.toLowerCase();

  // ── Intent detection ──────────────────────────────────────────────────────

  // Status query
  if (CAMPAIGN_STATUS_KEYWORDS.test(input)) {
    // Try to match a campaign title in the input
    for (const c of campaigns) {
      if (lc.includes(c.title.toLowerCase())) {
        return { intent: 'get_campaign_status', topic: c.id };
      }
    }
    return { intent: 'list_campaigns' };
  }

  // Campaign list
  if (CAMPAIGN_LIST_KEYWORDS.test(input)) {
    return { intent: 'list_campaigns' };
  }

  // Campaign creation
  if (CAMPAIGN_CREATE_KEYWORDS.test(input)) {
    const topic = extractTopicFromInput(input);
    return { intent: 'create_campaign', topic: topic ?? undefined };
  }

  // Revenue / financial insights
  if (REVENUE_KEYWORDS.test(input)) {
    return { intent: 'revenue_insights' };
  }

  // Default fallback
  return { intent: 'general_query' };
}
