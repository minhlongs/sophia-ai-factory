/**
 * RaaS (ROI-as-a-Service) License Validation Service
 *
 * Core validation service for ROIaaS license key gating.
 * Implements HMAC-SHA256 validation, timestamp expiration,
 * nonce tracking for replay prevention, and revocation checks.
 *
 * License Key Format:
 * raas_{tier}_{timestamp}_{nonce}_{hmac}
 * Example: raas_premium_1735689600_a1b2c3d4e5f6_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 */

import { redis } from '@/land/redis';
import { logger } from '@/seed/utils/logger-utility';
import {
  parseLicenseKey,
  verifyHmac,
  checkExpiration,
  checkNonce,
  checkRevocation,
  generateNonce,
} from './raas-service-key-operations';
import { REDIS_KEYS } from './raas-service-types-and-constants';

// Re-export types and primitives for consumers
export type { Tier, ParsedLicenseKey, ValidationResult, ValidateOptions } from './raas-service-types-and-constants';
export { parseLicenseKey, verifyHmac, checkExpiration, checkNonce, checkRevocation, generateNonce } from './raas-service-key-operations';

/**
 * Main license key validation function
 *
 * Validation flow:
 * 1. Parse key format
 * 2. Verify HMAC signature
 * 3. Check expiration
 * 4. Check nonce (replay prevention)
 * 5. Check revocation
 */
export async function validateLicenseKey(
  key: string,
  options: { redisClient?: typeof redis; bypassExpirationCheck?: boolean } = {}
): Promise<{ valid: boolean; reason?: string; tier?: import('./raas-service-types-and-constants').Tier }> {
  const {
    redisClient = redis,
    bypassExpirationCheck = false,
  } = options;

  // Check for development bypass
  const bypassDev = process.env.RAAS_BYPASS_DEV === 'true';
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev && bypassDev) {
    logger.info('[RaaS Service] Development bypass enabled');
    return { valid: true, reason: 'dev-bypass' };
  }

  // Step 1: Parse key format
  const parsed = parseLicenseKey(key);
  if (!parsed) {
    return { valid: false, reason: 'invalid-format' };
  }

  // Step 2: Verify HMAC signature
  const secret = process.env.RAAS_LICENSE_SECRET;
  if (!secret) {
    logger.error('[RaaS Service] RAAS_LICENSE_SECRET not configured');
    return { valid: false, reason: 'missing-secret' };
  }

  if (!verifyHmac(key, secret)) {
    return { valid: false, reason: 'invalid-signature' };
  }

  // Step 3: Check expiration (unless bypassed)
  if (!bypassExpirationCheck && checkExpiration(parsed.timestamp, parsed.tier)) {
    return { valid: false, reason: 'expired' };
  }

  // Step 4: Check nonce (replay attack prevention)
  const isReplay = await checkNonce(parsed.nonce, redisClient);
  if (isReplay) {
    return { valid: false, reason: 'replay-attack' };
  }

  // Step 5: Check revocation
  const isRevoked = await checkRevocation(key, redisClient);
  if (isRevoked) {
    return { valid: false, reason: 'revoked' };
  }

  logger.info('[RaaS Service] License key validated successfully', {
    tier: parsed.tier,
    timestamp: parsed.timestamp,
  });

  return { valid: true, tier: parsed.tier };
}

/**
 * Revoke a license key (add to revocation set)
 */
export async function revokeLicenseKey(
  key: string,
  redisClient: typeof redis
): Promise<void> {
  const cacheKey = `${REDIS_KEYS.REVOKED}${key}`;

  try {
    // Store revoked key with 1 year TTL
    await redisClient.set(cacheKey, '1', { ex: 31536000 });
    logger.info('[RaaS Service] License key revoked', { key });
  } catch (error) {
    logger.error('[RaaS Service] Failed to revoke key', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
