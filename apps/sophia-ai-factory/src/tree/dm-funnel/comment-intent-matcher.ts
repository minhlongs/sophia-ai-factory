/**
 * @file comment-intent-matcher.ts
 * @description Ingests comments and detects purchase/inquiry intent keywords
 * @layer tree
 */

export interface CommentIntentMatch {
  isIntentDetected: boolean;
  matchedKeyword: string | null;
  priorityScore: number;
  normalizedText: string;
}

const INTENT_PATTERNS: Array<{ regex: RegExp; keyword: string; weight: number }> = [
  { regex: /\b(ib|inbox|nhắn tin|nhan tin)\b/i, keyword: 'inbox', weight: 95 },
  { regex: /\b(link|xin link|cho link|đường link)\b/i, keyword: 'link', weight: 90 },
  { regex: /\b(giá|gia|bao nhiêu|nhiêu tiền|price)\b/i, keyword: 'price', weight: 85 },
  { regex: /\b(deal|mã giảm|voucher|khuyến mãi)\b/i, keyword: 'deal', weight: 80 },
  { regex: /\b(tư vấn|tu van|hỗ trợ|mua ở đâu)\b/i, keyword: 'consult', weight: 75 },
];

/**
 * Normalizes input text and evaluates purchase intent signals.
 */
export function matchCommentIntent(rawComment: string): CommentIntentMatch {
  const trimmed = rawComment.trim();

  for (const pattern of INTENT_PATTERNS) {
    if (pattern.regex.test(trimmed)) {
      return {
        isIntentDetected: true,
        matchedKeyword: pattern.keyword,
        priorityScore: pattern.weight,
        normalizedText: trimmed,
      };
    }
  }

  return {
    isIntentDetected: false,
    matchedKeyword: null,
    priorityScore: 10,
    normalizedText: trimmed,
  };
}
