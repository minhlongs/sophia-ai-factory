/**
 * Error Response Sanitization
 *
 * Ensures error responses never leak sensitive information (stack traces,
 * API keys, internal paths) to clients. All HTTP error responses should
 * route through sanitizeErrorMessage() before being sent.
 *
 * Pattern adopted from OmniRoute's buildErrorBody/sanitizeErrorMessage.
 */

const SENSITIVE_PATTERNS = [
  /api[_-]?key[s]?\s*[:=]\s*["']?[^\s"']+/gi,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /password[s]?\s*[:=]\s*["']?[^\s"']+/gi,
  /secret[s]?\s*[:=]\s*["']?[^\s"']+/gi,
  /token[s]?\s*[:=]\s*["']?[^\s"']+/gi,
  /(?:\/Users\/|\/home\/|\/root\/|C:\\Users\\)[^\s"']+/gi,
  /(?:node_modules|\.next|\.open-next)[^\s"']*/gi,
  /wrangler\.toml[^\s"']*/gi,
  /\.env(?:\.\w+)?/gi,
];

export interface SanitizedErrorBody {
  error: string;
  code?: string;
  requestId?: string;
}

/**
 * Sanitize an error message for client consumption.
 * Removes sensitive patterns and replaces stack traces with safe messages.
 */
export function sanitizeErrorMessage(error: Error | string): string {
  const raw = typeof error === 'string' ? error : error.message ?? 'Unknown error';

  let sanitized = raw;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  // If the message looks like a stack trace, replace entirely
  if (sanitized.includes('\n    at ') || sanitized.includes('Error:')) {
    return 'An internal error occurred. Please try again later.';
  }

  return sanitized;
}

/**
 * Build a safe error response body for HTTP responses.
 * Never includes stack traces or internal details.
 */
export function buildErrorBody(
  error: Error | string,
  options?: { code?: string; requestId?: string },
): SanitizedErrorBody {
  return {
    error: sanitizeErrorMessage(error),
    ...(options?.code && { code: options.code }),
    ...(options?.requestId && { requestId: options.requestId }),
  };
}
