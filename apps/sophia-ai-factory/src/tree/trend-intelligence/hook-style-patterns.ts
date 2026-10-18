/**
 * Bilingual Heuristic Hook Classifier Patterns & Score Sanitizer (EN / VI)
 *
 * Layer: tree/trend-intelligence
 */

import type { HookStyle } from '@/seed/types/creative-intelligence';

/**
 * Safely sanitizes and clamps a numerical score into [0.0, 1.0].
 * Rejects NaN, Infinity, -Infinity, null, and undefined with a finite fallback.
 */
export function sanitizeScore(value: unknown, fallback = 0.5): number {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return fallback;
    }
    if (value === -Infinity) {
      return 0;
    }
    if (value === Infinity) {
      return 1;
    }
    return Math.max(0, Math.min(1, value));
  }
  return fallback;
}

const STATISTIC_PATTERNS = [
  /\b\d+(\.\d+)?%/,
  /\$\d+/,
  /\b\d+\s+(bí quyết|cách|reasons|steps|tips|tools|sai lầm|secrets|things|ways|nguyên nhân|bước)/i,
  /(^|\s)(top\s+\d+|hơn\s+\d+|hàng\s+\d+|9[0-9]%|8[0-9]%|7[0-9]%)/i,
  /\b\d+\s*(triệu|tỷ|k|m|nghìn)\b/i,
];

const QUESTION_PATTERNS = [
  /\?/,
  /(^|\s)(tại sao|làm sao|liệu|có bao giờ|ai là|ai cũng|vì sao|đâu là)/i,
  /\b(did you know|why do|why are|how can|how to|what if|have you ever|is it possible|are you still)\b/i,
];

const PROBLEM_AGITATION_PATTERNS = [
  /\b(stop doing|don't make this|worst mistake|biggest mistake|stop wasting|ruining your|fatal mistake)\b/i,
  /(^|\s)(sai lầm|cảnh báo|đừng bao giờ|nguy hiểm|lừa đảo|thất bại|lãng phí|cảnh giác|mất tiền|ngừng làm)/i,
];

const BOLD_CLAIM_PATTERNS = [
  /\b(outperforms|insane|mind-blowing|game changer|revolution|best kept secret|10x faster|unbelievable|guaranteed|impossible)\b/i,
  /(^|\s)(sự thật gây sốc|không thể tin được|thay đổi hoàn toàn|chưa từng thấy|đỉnh cao|vượt trội hoàn toàn|thần thánh)/i,
];

const STORY_LEAD_PATTERNS = [
  /\b(last year|when i started|my journey|i lost everything|how i went from|story time|back in|years ago|i used to)\b/i,
  /(^|\s)(hồi đó|ngày xưa|khi tôi mới|năm ngoái|câu chuyện|tôi từng|tôi đã|hành trình|thuở mới)/i,
];

const CURIOSITY_GAP_PATTERNS = [
  /\b(wait until the end|you won't believe|nobody tells you|secret nobody|watch till the end|the truth about|here is why|this is how)\b/i,
  /(^|\s)(cái kết|bất ngờ|điều bí mật|sự thật đằng sau|chờ đến cuối|xem đến hết|lý do thực sự|bí quyết không ai nói)/i,
];

export const HOOK_STYLE_MATCHERS: readonly {
  style: HookStyle;
  patterns: readonly RegExp[];
}[] = [
  { style: 'question', patterns: QUESTION_PATTERNS },
  { style: 'story_lead', patterns: STORY_LEAD_PATTERNS },
  { style: 'problem_agitation', patterns: PROBLEM_AGITATION_PATTERNS },
  { style: 'bold_claim', patterns: BOLD_CLAIM_PATTERNS },
  { style: 'statistic_reveal', patterns: STATISTIC_PATTERNS },
  { style: 'curiosity_gap', patterns: CURIOSITY_GAP_PATTERNS },
];
