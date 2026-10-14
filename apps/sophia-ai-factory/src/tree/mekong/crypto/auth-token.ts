/**
 * SHA-256 token hashing and constant-time verification.
 * @module tree/mekong/crypto/auth-token
 */

import { MekongKeyError } from './errors';
import { timingSafeEqual } from './encoding';

/**
 * Computes SHA-256 hexadecimal digest of a token string.
 */
export async function hashAuthToken(token: string): Promise<string> {
  if (!token || typeof token !== 'string') {
    throw new MekongKeyError('Token must be a non-empty string');
  }
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies an auth token against an expected SHA-256 hash in constant-time.
 */
export async function verifyAuthTokenHash(token: string, expectedHash: string): Promise<boolean> {
  if (!token || !expectedHash || typeof token !== 'string' || typeof expectedHash !== 'string') {
    return false;
  }
  try {
    let cleanHash = expectedHash.trim().toLowerCase();
    if (cleanHash.startsWith('sha256=')) {
      cleanHash = cleanHash.slice(7);
    }
    const computedHash = await hashAuthToken(token);
    return timingSafeEqual(computedHash, cleanHash);
  } catch {
    return false;
  }
}
