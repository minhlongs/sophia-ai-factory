/**
 * Sensitive API routes configuration
 *
 * These prefixes require MFA verification even for authenticated users.
 * Used by middleware to enforce MFA gate for high-risk operations.
 *
 * @see src/middleware/mfa.ts - MFA gate implementation
 */

export const SENSITIVE_API_PREFIXES = [
  '/api/account',
  '/api/checkout',
  '/api/admin',
  '/api/billing',
  '/api/v1/settings',
] as const;

/**
 * Check if a given pathname matches any sensitive API prefix.
 */
export function isSensitiveApiRoute(pathname: string): boolean {
  return SENSITIVE_API_PREFIXES.some(prefix => pathname.startsWith(prefix));
}
