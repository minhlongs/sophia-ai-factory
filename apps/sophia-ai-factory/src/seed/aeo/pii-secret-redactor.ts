/**
 * Pure PII and BYOK secret redactor for Dashboard LLM Context Export.
 * Ensures zero credential leakage when non-tech CEOs copy dashboard context.
 * Layer: seed/aeo
 */

const SECRET_PATTERNS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  // OpenAI / OpenRouter / Anthropic / Stripe / ElevenLabs / D-ID style sk-/sk_/pk_live_ keys
  { pattern: /\b(?:(sk|pk|rk|did)[-_]|or-)[a-zA-Z0-9_-]{12,}\b/g, replacement: '[REDACTED_API_KEY]' },
  // JWT tokens (three base64url segments starting with eyJ)
  { pattern: /\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\b/g, replacement: '[REDACTED_JWT]' },
  // Telegram Bot tokens (digits:alphanumeric)
  { pattern: /\b\d{8,12}:[A-Za-z0-9_-]{30,45}\b/g, replacement: '[REDACTED_TELEGRAM_TOKEN]' },
  // Long hexadecimal keys / hashes (32+ hex chars, e.g., ElevenLabs / D-ID / NOWPayments IPN)
  { pattern: /\b[a-fA-F0-9]{32,128}\b/g, replacement: '[REDACTED_HEX_SECRET]' },
  // Bearer authorization headers
  { pattern: /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, replacement: 'Bearer [REDACTED_TOKEN]' },
  // Email addresses in tenant dashboard exports
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '[REDACTED_EMAIL]' },
];

const SENSITIVE_KEY_NAMES = /(api[_-]?key|secret|token|password|private[_-]?key|ipn[_-]?secret|byok|authorization|cookie|session)/i;

/**
 * Scrubs any known API key, token, JWT, hex secret, or email from a raw string.
 */
export function redactSecretsFromText(input: string): string {
  if (!input) return '';
  let sanitized = input;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

/**
 * Recursively scrubs sensitive fields and string values from an arbitrary record
 * before serializing it into a Dashboard LLM Context markdown block.
 */
export function redactSecretsFromRecord(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEY_NAMES.test(key)) {
      output[key] = '[REDACTED_BY_POLICY]';
      continue;
    }
    if (typeof value === 'string') {
      output[key] = redactSecretsFromText(value);
    } else if (Array.isArray(value)) {
      output[key] = value.map((item) =>
        typeof item === 'string'
          ? redactSecretsFromText(item)
          : item && typeof item === 'object'
            ? redactSecretsFromRecord(item as Record<string, unknown>)
            : item,
      );
    } else if (value && typeof value === 'object') {
      output[key] = redactSecretsFromRecord(value as Record<string, unknown>);
    } else {
      output[key] = value;
    }
  }
  return output;
}
