/**
 * RaaS Service - Key Parsing, HMAC Verification, and Nonce/Revocation Checks
 *
 * Low-level key operations: parse, verify, expiration check, nonce tracking,
 * revocation, and nonce generation.
 */

import { hmacSha256, timingSafeEqual } from '@/tree/audit/crypto-utils';
import { logger } from '@/seed/utils/logger-utility';
import { redis } from '@/lib/redis';
import {
  LICENSE_KEY_PATTERN,
  REDIS_KEYS,
  DEFAULT_REDIS_TTL,
} from './raas-service-types-and-constants';
import type { Tier, ParsedLicenseKey } from './raas-service-types-and-constants';

/**
 * Parse license key string into components
 */
export function parseLicenseKey(key: string): ParsedLicenseKey | null {
  const match = key.match(LICENSE_KEY_PATTERN);

  if (!match) {
    return null;
  }

  return {
    tier: match[1] as Tier,
    timestamp: parseInt(match[2], 10),
    nonce: match[3],
    hmac: match[4],
  };
}

/**
 * Verify HMAC signature using timing-safe comparison
 */
export function verifyHmac(key: string, secret: string): boolean {
  try {
    const parsed = parseLicenseKey(key);
    if (!parsed) {
      return false;
    }

    const data = `${parsed.tier}:${parsed.timestamp}:${parsed.nonce}`;
    const expectedHmac = hmacSha256(data, secret);

    return timingSafeEqual(parsed.hmac, expectedHmac);
  } catch (error) {
    logger.error('[RaaS Service] HMAC verification failed', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Check if license key has expired
 *
 * @returns true if expired, false if valid
 */
export function checkExpiration(timestamp: number, tier: Tier): boolean {
  // Master tier: perpetual license (no expiration)
  if (tier === 'master') {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  return now > timestamp;
}

/**
 * Check if nonce has been used before (replay attack prevention)
 *
 * @returns true if nonce already used (replay attack), false if new
 */
export async function checkNonce(
  nonce: string,
  redisClient: typeof redis
): Promise<boolean> {
  const ttl = parseInt(process.env.RAAS_REDIS_TTL || String(DEFAULT_REDIS_TTL), 10);
  const key = `${REDIS_KEYS.NONCE}${nonce}`;

  try {
    const exists = await redisClient.get(key);
    if (exists) {
      logger.warn('[RaaS Service] Replay attack detected - nonce reused', { nonce });
      return true;
    }

    await redisClient.set(key, '1', { ex: ttl });
    return false;
  } catch (error) {
    logger.error('[RaaS Service] Redis nonce check failed', error instanceof Error ? error : new Error(String(error)));
    return false; // Fail open in production
  }
}

/**
 * Check if license key has been revoked
 *
 * @returns true if revoked, false if active
 */
export async function checkRevocation(
  key: string,
  redisClient: typeof redis
): Promise<boolean> {
  const cacheKey = `${REDIS_KEYS.REVOKED}${key}`;

  try {
    const exists = await redisClient.get(cacheKey);
    return !!exists;
  } catch (error) {
    logger.error('[RaaS Service] Redis revocation check failed', error instanceof Error ? error : new Error(String(error)));
    return false; // Fail open in production
  }
}

/**
 * Generate a random nonce for license key creation
 *
 * @returns 32-character hex string
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
