/**
 * Affiliate Actions Submodule: Utilities & Helpers.
 * Layer: forest (Server Actions / Orchestrators)
 *
 * @module forest/actions/affiliate/utils
 */

/**
 * Generate cryptographically secure 256-bit entropy token (64 hex chars).
 */
export async function generateSecureInviteToken(): Promise<string> {
  const bytes = new Uint8Array(32); // 32 bytes = 256 bits of entropy
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate RFC 5322 compliant email format.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Sanitize and clamp commission rate override between 5.0% and 80.0%.
 */
export function clampCommissionRate(rate: number | undefined | null): number {
  if (typeof rate !== 'number' || isNaN(rate)) return 20.0;
  return Math.min(Math.max(rate, 5.0), 80.0);
}

/**
 * Resolve canonical application base URL for invite links.
 */
export function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://sophia.agencyos.network'
  ).replace(/\/+$/, '');
}
