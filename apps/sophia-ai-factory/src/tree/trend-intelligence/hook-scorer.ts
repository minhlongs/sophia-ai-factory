/**
 * Hook Scoring Engine — Hermes Intelligence V2
 *
 * Pure domain scoring implementing the canonical viral score formula:
 *   S_viral = 0.40 * S_hook + 0.25 * S_pacing + 0.20 * S_retention + 0.15 * S_cta
 *
 * Weight Normalization Proof:
 *   w_hook + w_pacing + w_retention + w_cta = 0.40 + 0.25 + 0.20 + 0.15 = 1.00
 *
 * Classifies video script openings into 6 canonical hook styles:
 *   - curiosity_gap: Suspense, withholding critical info
 *   - bold_claim: Shocking counter-intuitive assertion
 *   - problem_agitation: Warning, fatal mistake, or friction point
 *   - question: Direct inquiry activating viewer participation
 *   - story_lead: Anecdotal narrative lead-in
 *   - statistic_reveal: Hard data, percentages, counts, or dollar figures
 *
 * Layer: tree (domain reusable — depends only on seed and tree).
 * Zero :any types. Zero console.log.
 *
 * @module tree/trend-intelligence/hook-scorer
 */

import type {
  HookEvaluationInput,
  HookScoreResult,
  HookStyle,
} from '@/seed/types/creative-intelligence';

/** Canonical weights for viral hook score evaluation */
export const VIRAL_SCORE_WEIGHTS = {
  hook: 0.4,
  pacing: 0.25,
  retention: 0.2,
  cta: 0.15,
} as const;

/** Canonical 6 hook style list */
export const CANONICAL_HOOK_STYLES: readonly HookStyle[] = [
  'curiosity_gap',
  'bold_claim',
  'problem_agitation',
  'question',
  'story_lead',
  'statistic_reveal',
] as const;

// ── Bilingual Heuristic Hook Classifier (EN / VI) ─────────────────────────────

/**
 * Safely sanitizes and clamps a numerical score into [0.0, 1.0].
 * Rejects NaN, Infinity, -Infinity, null, and undefined with a finite fallback.
 */
function sanitizeScore(value: unknown, fallback = 0.5): number {
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

/**
 * Classifies a hook text string into one of the 6 canonical hook styles
 * using bilingual heuristic pattern matching.
 */
export function classifyHookStyle(hookText: string): HookStyle {
  const safeText = typeof hookText === 'string' ? hookText : '';
  const trimmed = safeText.trim();
  if (!trimmed) {
    return 'curiosity_gap';
  }

  // 1. Direct questions and inquiries take strong precedence
  for (const pattern of QUESTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'question';
    }
  }

  // 2. Personal story and narrative lead-ins (e.g. "Story time: ...", "Last year I ...")
  for (const pattern of STORY_LEAD_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'story_lead';
    }
  }

  // 3. Problem agitation, warnings, fatal mistakes
  for (const pattern of PROBLEM_AGITATION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'problem_agitation';
    }
  }

  // 4. Bold claims and shocking counter-intuitive assertions
  for (const pattern of BOLD_CLAIM_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'bold_claim';
    }
  }

  // 5. Specific data, numbers, percentages or metrics
  for (const pattern of STATISTIC_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'statistic_reveal';
    }
  }

  // 6. Curiosity gap and withholding crucial info
  for (const pattern of CURIOSITY_GAP_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'curiosity_gap';
    }
  }

  // Default fallback style
  return 'curiosity_gap';
}

/**
 * Evaluates and calculates the viral score for a video script opening.
 *
 * Formula:
 *   S_viral = 0.40 * S_hook + 0.25 * S_pacing + 0.20 * S_retention + 0.15 * S_cta
 *
 * All inputs are strictly sanitized against NaN, Infinity, -Infinity, null, and undefined.
 *
 * @param input Hook evaluation parameters including text and optional component scores.
 * @returns Fully validated HookScoreResult with detected style and normalized viral score.
 */
export function calculateHookScore(input: HookEvaluationInput): HookScoreResult {
  const hook = sanitizeScore(input.scores?.hookScore, 0.5);
  const pacing = sanitizeScore(input.scores?.pacingScore, 0.5);
  const retention = sanitizeScore(input.scores?.retentionScore, 0.5);
  const cta = sanitizeScore(input.scores?.ctaScore, 0.5);

  const rawViral =
    VIRAL_SCORE_WEIGHTS.hook * hook +
    VIRAL_SCORE_WEIGHTS.pacing * pacing +
    VIRAL_SCORE_WEIGHTS.retention * retention +
    VIRAL_SCORE_WEIGHTS.cta * cta;

  const boundedViral = Number.isFinite(rawViral) ? Math.min(1.0, Math.max(0.0, rawViral)) : 0.5;
  const viralScore = Math.round(boundedViral * 100) / 100;
  const detectedHookStyle = input.hookStyle ?? classifyHookStyle(input.hookText);

  return {
    viralScore,
    hookScore: hook,
    pacingScore: pacing,
    retentionScore: retention,
    ctaScore: cta,
    detectedHookStyle,
    weights: VIRAL_SCORE_WEIGHTS,
    reasoning: `Hook style '${detectedHookStyle}' evaluated with viral score ${viralScore.toFixed(2)} (Hook: ${hook.toFixed(2)}, Pacing: ${pacing.toFixed(2)}, Retention: ${retention.toFixed(2)}, CTA: ${cta.toFixed(2)})`,
  };
}
