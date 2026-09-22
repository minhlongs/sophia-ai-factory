/**
 * Cryptographic Single-Use Video Review Token Generator & Verifier
 *
 * Edge-runtime compliant using standard Web Crypto API:
 * - 256-bit CSPRNG entropy (32 random bytes -> 64 lowercase hex characters)
 * - SHA-256 digest computation for secure hash storage in D1
 * - 7-day default TTL expiration calculation
 * - Timing-safe hash comparison
 *
 * Layer: seed/security (Foundational - zero imports from upper layers)
 *
 * @module seed/security/review-token
 */

const ENC = new TextEncoder();
export const DEFAULT_REVIEW_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (604,800,000 ms)

/**
 * Computes a standard SHA-256 lowercase hex digest for the provided content string.
 */
export async function sha256Hex(content: string): Promise<string> {
  const data = ENC.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a high-entropy 256-bit CSPRNG video review token, its SHA-256 hash, and expiration timestamp.
 * The rawToken is 64 hex characters and must only be shared with the client reviewer.
 * The tokenHash must be stored in D1.
 */
export async function generateReviewToken(customTtlMs: number = DEFAULT_REVIEW_TOKEN_TTL_MS): Promise<{
  rawToken: string;
  tokenHash: string;
  expiresAt: string;
}> {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const rawToken = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + customTtlMs).toISOString();

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
}

/**
 * Determines whether a review token has expired based on its expires_at timestamp.
 */
export function isReviewTokenExpired(expiresAt: string | Date | number, now: number = Date.now()): boolean {
  const expiryTime = typeof expiresAt === 'number'
    ? expiresAt
    : typeof expiresAt === 'string'
      ? new Date(expiresAt).getTime()
      : expiresAt.getTime();

  if (Number.isNaN(expiryTime)) {
    return true;
  }

  return now > expiryTime;
}

/**
 * Performs a constant-time comparison of two strings to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
