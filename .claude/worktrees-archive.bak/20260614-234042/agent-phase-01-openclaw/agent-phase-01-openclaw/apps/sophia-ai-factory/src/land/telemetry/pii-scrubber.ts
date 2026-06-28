/**
 * PII Scrubber — RED-TEAM #2
 * Regex-removes BYOK keys, JWTs, bearer tokens, emails, phones before any log/AI send.
 * Applied BEFORE D1 insert AND BEFORE any OpenRouter/Better Stack push.
 */

// Patterns ordered by specificity: specific token prefixes first, generic last
const PATTERNS: [RegExp, string][] = [
  // BYOK API keys (OpenAI/Anthropic style)
  [/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED-SK]'],
  // Publishable keys (pk_live_... pk_test_... Stripe/etc patterns include underscores)
  [/pk_[a-zA-Z0-9_]{20,}/g, '[REDACTED-PK]'],
  // JWTs (header.payload.signature — eyJ prefix)
  [/eyJ[a-zA-Z0-9._-]+/g, '[REDACTED-JWT]'],
  // Bearer tokens in Authorization headers
  [/Bearer\s+[a-zA-Z0-9._\-/+]{8,}/g, 'Bearer [REDACTED]'],
  // Email addresses
  [/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[REDACTED-EMAIL]'],
  // Phone numbers (international + local, 8–15 digits)
  [/\+?[0-9]{8,15}/g, '[REDACTED-PHONE]'],
];

/**
 * Scrub PII from a string.
 * All patterns replaced with typed REDACTED markers.
 */
export function scrubPII(text: string): string {
  let result = text;
  for (const [pattern, replacement] of PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Recursively scrub PII from any object value.
 * Non-string primitives and null/undefined pass through.
 */
export function scrubPIIDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return scrubPII(value);
  if (Array.isArray(value)) return value.map(scrubPIIDeep);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubPIIDeep(v);
    }
    return out;
  }
  return value;
}
