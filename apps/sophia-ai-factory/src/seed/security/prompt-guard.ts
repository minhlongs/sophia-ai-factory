/**
 * Prompt Injection Guard — heuristic detection at LLM ingress.
 *
 * PDF Giai đoạn 4 "Enterprise Security: Prompt Injection Protection".
 * Regex + keyword patterns only. No external API. No LLM-based classification.
 *
 * Policy: prefer false-negatives over false-positives (don't block legitimate users).
 * severity='high' → reject request. 'medium' → emit signal, allow. 'low' → ignore.
 */

export type Severity = 'low' | 'medium' | 'high'

export interface GuardResult {
  flagged: boolean
  severity: Severity
  reasons: string[]
}

interface Pattern {
  id: string
  regex: RegExp
  severity: Severity
}

// Ordered most-specific first. All case-insensitive. Match on normalized text.
const PATTERNS: Pattern[] = [
  // role-switch / authority override (HIGH — clear attack intent)
  { id: 'role-switch',          severity: 'high',   regex: /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|messages?|rules?|directives?)\b/i },
  { id: 'new-instructions',     severity: 'high',   regex: /\b(new|updated|different)\s+(instructions?|directives?|system\s+prompt)\s*:\s*/i },
  { id: 'you-are-now',          severity: 'high',   regex: /\byou\s+are\s+now\s+(a\s+|an\s+)?(?:different|new|dan|jailbroken|unrestricted|uncensored)/i },
  { id: 'act-as-dan',           severity: 'high',   regex: /\bact\s+as\s+(?:dan|do\s+anything\s+now|an?\s+(?:unrestricted|uncensored|jailbroken))/i },

  // system prompt leak attempts (HIGH — clear info-extraction attack)
  { id: 'reveal-system',        severity: 'high',   regex: /\b(reveal|show|print|output|display|repeat)\s+(your\s+)?(system\s+prompt|instructions|hidden\s+prompt|prior\s+context|initial\s+prompt)/i },
  { id: 'repeat-above',         severity: 'high',   regex: /\brepeat\s+everything\s+(above|before\s+this|that\s+was\s+said)/i },
  { id: 'print-prompt',         severity: 'high',   regex: /\b(print|output)\s+(this\s+)?(entire\s+|full\s+)?(prompt|conversation\s+history|context\s+window)/i },

  // instruction override (MEDIUM — ambiguous, could be legitimate rephrasing)
  { id: 'instead-do',           severity: 'medium', regex: /\b(instead|rather)\s*,?\s*(do|execute|run|perform)\s+(this|the\s+following)/i },
  { id: 'override',             severity: 'medium', regex: /\b(override|bypass|circumvent)\s+(the\s+)?(safety|security|guardrails?|filters?|restrictions?)/i },

  // homoglyph / Unicode obfuscation (MEDIUM — attempts to evade keyword filters)
  { id: 'cyrillic-latin-mix',   severity: 'medium', regex: /(?=.*[a-z])(?=.*[\u0430-\u044f]).*(?:ignore|pr[\u043eo]mpt|syst[\u0435e]m)/i },

  // delimiter / markdown injection (LOW — noisy pattern, heuristic only)
  { id: 'backtick-spam',        severity: 'low',    regex: /`{20,}/ },
  { id: 'triple-dash-spam',     severity: 'low',    regex: /(?:-{3,}\s*){5,}/ },
  { id: 'fake-system-tag',      severity: 'low',    regex: /<\/?(?:system|admin|root|instruction)>/i },
]

const MAX_PROMPT_LENGTH_SOFT = 4000  // > this escalates low → medium
const MAX_PROMPT_LENGTH_HARD = 20000 // > this = 'high' regardless of content

/** Normalize text for matching: NFKC Unicode + trim. */
function normalize(input: string): string {
  return input.normalize('NFKC').trim()
}

/**
 * Inspect an untrusted prompt for injection signals.
 * Returns the highest matched severity + all reasons.
 */
export function detectInjection(input: string): GuardResult {
  const text = normalize(input)
  const reasons: string[] = []
  let maxSeverity: Severity = 'low'

  if (text.length > MAX_PROMPT_LENGTH_HARD) {
    return {
      flagged: true,
      severity: 'high',
      reasons: [`length-exceeds-hard-cap:${text.length}`],
    }
  }

  for (const p of PATTERNS) {
    if (p.regex.test(text)) {
      reasons.push(p.id)
      if (severityRank(p.severity) > severityRank(maxSeverity)) {
        maxSeverity = p.severity
      }
    }
  }

  // Length-based escalation: suspicious + long = elevated severity
  if (reasons.length > 0 && text.length > MAX_PROMPT_LENGTH_SOFT && maxSeverity === 'low') {
    maxSeverity = 'medium'
    reasons.push('length-escalation')
  }

  // Multiple medium hits → escalate to high
  const mediumCount = reasons.filter((r) =>
    PATTERNS.find(p => p.id === r)?.severity === 'medium',
  ).length
  if (mediumCount >= 2) {
    maxSeverity = 'high'
    reasons.push('multi-medium-escalation')
  }

  return {
    flagged: reasons.length > 0,
    severity: maxSeverity,
    reasons,
  }
}

function severityRank(s: Severity): number {
  return s === 'high' ? 3 : s === 'medium' ? 2 : 1
}

/** Public for tests. */
export const __TEST__ = { PATTERNS, MAX_PROMPT_LENGTH_SOFT, MAX_PROMPT_LENGTH_HARD }
