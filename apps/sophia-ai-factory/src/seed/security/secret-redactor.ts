/**
 * SEC-02: Secret Redactor for Structured Logs, Error Payloads, and SSE/Telegram Alerts
 *
 * Scrubs raw API keys, Bearer tokens, JWTs, hex secrets, and credential key-value pairs
 * before any payload reaches external logs or operator notifications.
 *
 * Layer: seed (foundational primitive)
 * @module seed/security/secret-redactor
 */

export const REDACTED_MARKER = '[REDACTED_SECRET]';

const SECRET_PATTERNS: readonly RegExp[] = [
  // Bearer tokens in Authorization strings
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  // OpenAI / OpenRouter / Anthropic / Stripe style sk-* or rk-* keys
  /\b(?:sk|rk|pk)_(?:live|test|or|ant|proj)?[_-]?[A-Za-z0-9_-]{12,}\b/g,
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  // ElevenLabs / generic xi-api-key values or hex tokens >= 32 chars
  /\bxi_[A-Za-z0-9_-]{16,}\b/g,
  // JWT tokens (3 base64url segments starting with eyJ)
  /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  // Telegram bot tokens (digits:alphanumeric)
  /\b\d{8,11}:[A-Za-z0-9_-]{30,45}\b/g,
  // Inline key=value or "apiKey": "..." patterns
  /((?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|checksum[_-]?key|ipn[_-]?secret|private[_-]?key|authorization)["']?\s*[:=]\s*["']?)([^"'\s,}]{8,})/gi,
];

const SENSITIVE_FIELD_NAME =
  /(?:^|[_-])(?:api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|client[_-]?secret|secret|password|authorization|xi-api-key|x-api-key|checksum[_-]?key|ipn[_-]?secret|private[_-]?key|encrypted[_-]?key)(?:$|[_-])/i;

/**
 * Scrubs known credential and token formats from an arbitrary string.
 */
export function redactSecrets(input: string): string {
  if (!input || typeof input !== 'string') return input;

  let scrubbed = input;
  for (let i = 0; i < SECRET_PATTERNS.length; i++) {
    const pattern = SECRET_PATTERNS[i];
    if (i === SECRET_PATTERNS.length - 1) {
      scrubbed = scrubbed.replace(pattern, `$1${REDACTED_MARKER}`);
    } else {
      scrubbed = scrubbed.replace(pattern, REDACTED_MARKER);
    }
  }
  return scrubbed;
}

/**
 * Recursively scrubs sensitive keys and string values in structured log / alert objects.
 */
export function redactObjectSecrets<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return redactSecrets(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactObjectSecrets(item)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_FIELD_NAME.test(k) && typeof v === 'string' && v.length > 0) {
        out[k] = REDACTED_MARKER;
      } else {
        out[k] = redactObjectSecrets(v);
      }
    }
    return out as T;
  }
  return value;
}
