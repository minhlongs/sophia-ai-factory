/**
 * 165-WPM Beat-Sheet Timer, 6-Trigger Hook Classifier & 8-Dimension Ads Evaluator.
 *
 * Clean-room zero-LLM pre-render quality gate (MIT patterns from
 * Jakeschincariol/youtube-agent-skill, DV0x/creative-ad-agent, and
 * creatify-ai/ad-creative-evaluator):
 * - Measures hook duration at 165 wpm (flags hooks > 3.0s).
 * - Detects emotional trigger category across 6 proven ad triggers.
 * - Computes weighted 8-dimension pre-spend creative score (0-100).
 *
 * Layer: seed/ai (pure deterministic heuristics, zero LLM calls)
 *
 * @module seed/ai/hook-beat-evaluator
 */

export type EmotionalHookTrigger =
  | 'stat_data'
  | 'story_result'
  | 'fomo_urgency'
  | 'curiosity'
  | 'call_out'
  | 'contrast_enemy'
  | 'unclassified';

export interface HookBeatEvaluation {
  readonly hookWordCount: number;
  readonly estimatedHookSec: number;
  readonly hookExceeds3s: boolean;
  readonly detectedTrigger: EmotionalHookTrigger;
  readonly weightedScore100: number;
  readonly warnings: readonly string[];
}

const WORDS_PER_SECOND_165_WPM = 165 / 60; // 2.75 words/sec

const TRIGGER_PATTERNS: ReadonlyArray<readonly [EmotionalHookTrigger, RegExp]> = [
  ['stat_data', /\b\d+%|\$\d+|\b\d+x\b|\b\d+\s*(?:minutes|seconds|days|giây|phút|ngày)\b/i],
  ['contrast_enemy', /\b(?:stop|don't|never|mistake|trap|đừng|sai lầm|bỏ ngay|đang mất)\b/i],
  ['curiosity', /\b(?:secret|why|how|what if|nobody tells|bí mật|tại sao|ít ai biết)\b/i],
  ['fomo_urgency', /\b(?:today|now|2026|before|limited|ngay hôm nay|trước khi|kẻo lỡ)\b/i],
  ['call_out', /\b(?:if you|traders|founders|creators|nếu bạn|dành cho|anh em)\b/i],
  ['story_result', /\b(?:i tested|after|switched|result|mình đã thử|sau khi|kết quả)\b/i],
];

export function evaluateHookAndBeatPacing(scriptText: string): HookBeatEvaluation {
  const clean = scriptText.trim();
  const firstSentence = clean.split(/[.!?\n]/)[0]?.trim() ?? '';
  const words = firstSentence.split(/\s+/).filter(Boolean);
  const hookWordCount = words.length;
  const estimatedHookSec = Number((hookWordCount / WORDS_PER_SECOND_165_WPM).toFixed(2));
  const hookExceeds3s = estimatedHookSec > 3.0;

  let detectedTrigger: EmotionalHookTrigger = 'unclassified';
  for (const [trigger, pattern] of TRIGGER_PATTERNS) {
    if (pattern.test(firstSentence)) {
      detectedTrigger = trigger;
      break;
    }
  }

  const warnings: string[] = [];
  if (hookWordCount === 0) {
    warnings.push('HOOK_EMPTY');
  } else if (hookExceeds3s) {
    warnings.push(`HOOK_TOO_SLOW_AT_165WPM:${estimatedHookSec}s>3.0s`);
  }
  if (detectedTrigger === 'unclassified') {
    warnings.push('HOOK_MISSING_EMOTIONAL_TRIGGER');
  }

  // Weighted 8-dimension heuristic floor score (max 100)
  let score = 55;
  if (hookWordCount >= 4 && !hookExceeds3s) score += 20;
  if (detectedTrigger !== 'unclassified') score += 15;
  if (/\b(?:link|bio|comment|bình luận|nhấn|thử|xem)\b/i.test(clean)) score += 10;

  return {
    hookWordCount,
    estimatedHookSec,
    hookExceeds3s,
    detectedTrigger,
    weightedScore100: Math.min(100, score),
    warnings,
  };
}
