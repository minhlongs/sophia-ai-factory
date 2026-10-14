/**
 * Secret redaction, ID masking, and error categorization helpers for safe diagnostic bundles.
 * @module tree/diagnostics/safe-bundle-redactor
 */

const REDACTED_PLACEHOLDER = '[REDACTED]';

/** Comprehensive regex patterns to catch API keys, tokens, credentials, and connection strings */
const COMPREHENSIVE_SECRET_PATTERNS: RegExp[] = [
  /(?:sk|fal|r8|el|key|api|token|secret)[-_a-zA-Z0-9]{8,}/gi,
  /Bearer\s+[a-zA-Z0-9_\-\.]+/gi,
  /ey[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]+/g,
  /(?:password|passwd|pwd|client_secret|auth_token)\s*[:=]\s*["']?[^\s,"']+/gi,
  /(?:postgres|postgresql|mysql|sqlite|redis|mongodb|upstash):\/\/[^\s]+/gi,
  /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g,
  /(?:cookie|set-cookie|session):\s*[^\r\n]+/gi,
];

/**
 * Clean and redact any sensitive text or serialized object string.
 */
export function redactSensitiveData(input: string): string {
  if (!input) return '';
  let sanitized = input;
  for (const pattern of COMPREHENSIVE_SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, REDACTED_PLACEHOLDER);
  }
  return sanitized;
}

/**
 * Mask an ID (userId or workspaceId) showing only the last characters.
 */
export function maskIdentifier(id: string, prefix = 'id'): string {
  if (!id) return `${prefix}_anon`;
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (clean.length <= 6) return `${prefix}_***${clean}`;
  return `${prefix}_***${clean.slice(-6)}`;
}

/**
 * Categorize raw errors into safe coarse-grained diagnostic enum tags.
 */
export function categorizeError(errorMsg: string): string {
  const lower = errorMsg.toLowerCase();
  if (/401|403|unauthorized|auth|api_key|credential|invalid_key/.test(lower)) {
    return 'AUTH_CREDENTIAL_ERROR';
  }
  if (/429|rate limit|too many|quota exceeded|throttl/.test(lower)) {
    return 'RATE_LIMIT_EXCEEDED';
  }
  if (/402|credit|balance|insufficient|mcu/.test(lower)) {
    return 'INSUFFICIENT_CREDITS';
  }
  if (/timeout|abort|econnrefused|fetch failed|network|socket/.test(lower)) {
    return 'NETWORK_UNAVAILABLE';
  }
  if (/format|invalid_argument|validation|schema|payload/.test(lower)) {
    return 'PAYLOAD_VALIDATION_ERROR';
  }
  if (/d1|database|sqlite|sql|query|db/.test(lower)) {
    return 'PERSISTENCE_LAYER_ERROR';
  }
  return 'GENERIC_INTERNAL_ERROR';
}
