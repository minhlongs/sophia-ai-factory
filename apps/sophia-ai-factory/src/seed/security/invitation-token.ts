/**
 * Cryptographic Single-Use Invitation Token Generator & Verifier
 *
 * Edge-runtime compliant using standard Web Crypto API:
 * - 256-bit CSPRNG entropy (32 random bytes -> 64 lowercase hex characters)
 * - SHA-256 digest computation for secure hash storage in database
 * - 7-day TTL expiration calculation
 *
 * Layer: seed/security (Foundational)
 *
 * @module seed/security/invitation-token
 */

const ENC = new TextEncoder();
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (604,800,000 ms)

/**
 * Computes a standard SHA-256 lowercase hex digest for the provided input string.
 */
export async function sha256Hex(content: string): Promise<string> {
  const data = ENC.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a high-entropy 256-bit CSPRNG invitation token, its SHA-256 hash, and 7-day expiration.
 * The raw token is 64 hex characters. Only the tokenHash must be stored in D1.
 */
export async function generateInvitationToken(customTtlMs: number = INVITATION_TTL_MS): Promise<{
  rawToken: string;
  tokenHash: string;
  expiresAt: number;
}> {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const rawToken = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = Date.now() + customTtlMs;

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
}

/**
 * Determines whether an invitation has expired based on its expires_at timestamp.
 */
export function isTokenExpired(expiresAt: number, now: number = Date.now()): boolean {
  return now > expiresAt;
}
