/**
 * Signal Analyzer for Hook Styles and Video Duration
 *
 * Layer: tree (domain reusable)
 * @module tree/learning-loop/patterns/signal-analyzer
 */

import {
  type HookStyle,
  type DurationPattern,
  VALID_HOOK_STYLES,
} from './types';

/**
 * Bucket video duration in seconds into standard short-form buckets.
 */
export function bucketDurationPattern(seconds: number | string | null | undefined): DurationPattern {
  if (seconds == null || seconds === '') return '0-15s';
  const n = typeof seconds === 'number' ? seconds : Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return '0-15s';
  if (n <= 15) return '0-15s';
  if (n <= 30) return '16-30s';
  if (n <= 60) return '31-60s';
  if (n <= 90) return '61-90s';
  return '90s+';
}

function resolveTextFromInput(input: unknown): string {
  if (typeof input === 'string') {
    return input.trim();
  }
  if (typeof input === 'object' && input !== null) {
    const record = input as Record<string, unknown>;
    const narration = typeof record.narration === 'string' ? record.narration : '';
    const prompt = typeof record.prompt === 'string' ? record.prompt : '';
    const title = typeof record.title === 'string' ? record.title : '';
    const content = typeof record.text === 'string' ? record.text : '';
    return (narration || prompt || content || title).trim();
  }
  return '';
}

function classifyHookByRegex(lower: string): HookStyle {
  // 1. Story lead: personal anecdotal or timeline openers
  if (
    /it all started|last year|when i was|a few years ago|i used to|my journey/i.test(lower) ||
    /hồi đó|năm ngoái|ngày xưa|khi tôi|hành trình|câu chuyện/i.test(lower)
  ) {
    return 'story_lead';
  }

  // 2. Problem agitation: warning, mistakes, friction, pain points
  if (
    /stop doing|biggest mistake|warning|danger|tired of|frustrated|don't ever|hate when|struggling with/i.test(lower) ||
    /dừng lại|sai lầm|cảnh báo|nguy hiểm|mệt mỏi|đừng bao giờ|vấn đề|bế tắc|thất bại|nỗi đau/i.test(lower)
  ) {
    return 'problem_agitation';
  }

  // 3. Curiosity gap: teasing incomplete information or dramatic conclusions
  if (
    /wait until|the secret|you won't believe|what happens next|here is what happened|there is one thing/i.test(lower) ||
    /cái kết|điều bí mật|chờ xem|bất ngờ|không thể tin/i.test(lower)
  ) {
    return 'curiosity_gap';
  }

  // 4. Bold claim: shocking assertions, transformative statements
  if (
    /unbelievable|nobody tells you|the truth about|shocking|guaranteed|impossible|10x|completely change|game changer/i.test(lower) ||
    /will\s+(\w+\s+)?change|thay đổi hoàn toàn|sự thật gây sốc|đột phá|kinh ngạc|gấp 10|chắc chắn/i.test(lower)
  ) {
    return 'bold_claim';
  }

  // 5. Statistic reveal: percentages (90%), dollar signs ($100), numbered counts (3 reasons, 5 steps)
  if (
    /\d+(\.\d+)?%|\$\d+|\b\d+\s*(reasons|steps|ways|people|million|percent|hours|days|years)\b/i.test(lower) ||
    /\b\d+\s*(lý do|cách|bước|người|triệu|tỷ|ngày|năm|giờ)\b/i.test(lower) ||
    /statistics|thống kê/i.test(lower)
  ) {
    return 'statistic_reveal';
  }

  // 6. Question: explicit question mark or standard interrogation words
  if (
    /\?|why|how|what if|did you know|have you ever|who else|where do|can you|are you/i.test(lower) ||
    /tại sao|làm sao|làm thế nào|bạn có biết|liệu|ai có thể|đã bao giờ/i.test(lower)
  ) {
    return 'question';
  }

  return 'curiosity_gap';
}

/**
 * Classify hook style from scene 0 narration, prompt, or raw text.
 * Uses bilingual regex heuristics (EN/VI) with fallback to 'curiosity_gap'.
 */
export function extractHookStyleFromScene0(input: unknown): HookStyle {
  if (!input) return 'curiosity_gap';

  if (typeof input === 'string' && VALID_HOOK_STYLES.has(input.trim() as HookStyle)) {
    return input.trim() as HookStyle;
  }

  if (typeof input === 'object' && input !== null) {
    const record = input as Record<string, unknown>;
    const explicitTag = (record.hookStyle || record.hook_style) as string | undefined;
    if (explicitTag && VALID_HOOK_STYLES.has(explicitTag as HookStyle)) {
      return explicitTag as HookStyle;
    }
  }

  const text = resolveTextFromInput(input);
  if (!text) return 'curiosity_gap';

  return classifyHookByRegex(text.toLowerCase());
}
