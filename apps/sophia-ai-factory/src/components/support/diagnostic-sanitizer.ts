/**
 * Diagnostic Sanitizer Helpers
 * Redacts PII/secrets, masks tenant IDs, and classifies operational errors.
 *
 * @module components/support/diagnostic-sanitizer
 */

const REDACTED_MARKER = '[REDACTED]';

const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9_\-]{8,}/g,
  /Bearer\s+[a-zA-Z0-9_\-\.]+/gi,
  /ey[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]+/g,
  /password\s*[:=]\s*[^\s,]+/gi,
  /(postgres|mysql|sqlite|redis|mongodb):\/\/[^\s]+/gi,
  /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g,
];

export function sanitizeText(input: string): string {
  let result = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, REDACTED_MARKER);
  }
  return result;
}

export function maskTenantId(userId: string): string {
  if (!userId) return 'usr_anon';
  const clean = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (clean.length <= 6) return `usr_***${clean}`;
  return `usr_***${clean.slice(-6)}`;
}

export function classifyErrorToCategory(rawError: string): string {
  const err = rawError.toLowerCase();
  if (/401|403|unauthorized|auth|key|invalid_api_key|expired/.test(err)) {
    return 'KEY_EXPIRED_OR_INVALID';
  }
  if (/429|rate limit|too many|quota exceeded|throttled/.test(err)) {
    return 'PROVIDER_RATE_LIMIT';
  }
  if (/402|credit|balance|insufficient|unpaid/.test(err)) {
    return 'QUOTA_EXHAUSTED';
  }
  if (/timeout|abort|econnrefused|fetch failed|network/.test(err)) {
    return 'NETWORK_TIMEOUT';
  }
  if (/safety|filter|validation|nsfw|format|unsupported/.test(err)) {
    return 'ASSET_VALIDATION_FAILED';
  }
  return 'GENERIC_OPERATIONAL_ERROR';
}
