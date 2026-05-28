/**
 * Smart LLM Router — Phase 4C
 *
 * Pure decision helper: classify prompt complexity + select provider/model.
 * No network calls. No side effects. Safe to call anywhere (edge, tests).
 *
 * (Local-mode mekongd support has been deprecated and removed. All requests route to cloud.)
 */

export type Complexity = 'simple' | 'medium' | 'complex'

export interface RouteDecision {
  provider: 'openrouter' | 'anthropic'
  model:    string
  complexity: Complexity
  reason:   string
}

// ── Keyword tables (EN + VN, lowercased) ─────────────────────────────────────

const COMPLEX_KEYWORDS = [
  'explain', 'analyze', 'compare', 'design', 'architect', 'refactor',
  'reason',  'evaluate', 'synthesize', 'investigate',
  'phân tích', 'thiết kế', 'so sánh', 'đánh giá', 'tổng hợp',
] as const

const SIMPLE_KEYWORDS = [
  'summarize', 'translate', 'hello', 'what is', 'define',
  'simple',    'quick',     'basic', 'list',
  'tóm tắt', 'dịch', 'chào', 'là gì', 'định nghĩa',
] as const

// ── Thresholds (tuned to match PDF heuristic) ────────────────────────────────

const COMPLEX_LEN_THRESHOLD = 500
const MEDIUM_LEN_THRESHOLD  = 200
const COMPLEX_SCORE_TRIP    = 2

/**
 * Classify a prompt into one of 3 complexity tiers.
 * Pure + deterministic — same prompt always returns the same tier.
 */
export function classifyComplexity(prompt: string): Complexity {
  const text = prompt.toLowerCase()
  const length = prompt.length

  let complexScore = 0
  for (const kw of COMPLEX_KEYWORDS) {
    if (text.includes(kw)) complexScore++
  }

  let simpleScore = 0
  for (const kw of SIMPLE_KEYWORDS) {
    if (text.includes(kw)) simpleScore++
  }

  if (length > COMPLEX_LEN_THRESHOLD || complexScore >= COMPLEX_SCORE_TRIP) {
    return 'complex'
  }
  if (length > MEDIUM_LEN_THRESHOLD || (complexScore > 0 && simpleScore === 0)) {
    return 'medium'
  }
  return 'simple'
}

// ── Routing matrix ───────────────────────────────────────────────────────────

const CLOUD_MODELS: Record<Complexity, { provider: 'openrouter' | 'anthropic'; model: string }> = {
  simple:  { provider: 'openrouter', model: 'gpt-4o-mini' },
  medium:  { provider: 'openrouter', model: 'gpt-4o-mini' },
  complex: { provider: 'anthropic',  model: 'claude-sonnet-4-6' },
}

/**
 * Pick provider + model for a classified prompt.
 *
 * @param complexity    — result of `classifyComplexity()`
 * @param _hasLocalMode  — (deprecated) ignored, local mode is removed.
 */
export function selectRoute(
  complexity: Complexity,
  _hasLocalMode?: boolean,
): RouteDecision {
  const cloud = CLOUD_MODELS[complexity]
  return {
    provider:   cloud.provider,
    model:      cloud.model,
    complexity,
    reason:     `cloud:${complexity}`,
  }
}

/**
 * Convenience: classify + select in one call.
 */
export function route(prompt: string, _hasLocalMode?: boolean): RouteDecision {
  return selectRoute(classifyComplexity(prompt), _hasLocalMode)
}
