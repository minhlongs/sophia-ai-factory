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

import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { redis } from './redis';
import { logger } from './utils/logger-utility';

/**
 * Supported subscription tiers
 */
export type Tier = 'basic' | 'premium' | 'enterprise' | 'master';

/**
 * Parsed license key components
 */
export interface ParsedLicenseKey {
  tier: Tier;
  timestamp: number;
  nonce: string;
  hmac: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  tier?: Tier;
}

/**
 * Validation options
 */
export interface ValidateOptions {
  redisClient?: typeof redis;
  bypassExpirationCheck?: boolean;
}

/**
 * License key pattern
 * Matches: raas_{tier}_{timestamp}_{nonce}_{hmac}
 */
const LICENSE_KEY_PATTERN = /^raas_(basic|premium|enterprise|master)_(\d{10})_([a-f0-9]{32})_([a-f0-9]{64})$/;

/**
 * Redis key prefixes
 */
const REDIS_KEYS = {
  NONCE: 'raas:nonce:',
  REVOKED: 'raas:revoked:',
};

/**
 * Default Redis TTL for nonce tracking (1 hour)
 */
const DEFAULT_REDIS_TTL = 3600;

/**
 * Parse license key string into components
 *
 * @param key - License key string
 * @returns Parsed components or null if invalid format
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
 *
 * @param key - Full license key string
 * @param secret - HMAC secret key
 * @returns true if signature valid, false otherwise
 */
export function verifyHmac(key: string, secret: string): boolean {
  try {
    const parsed = parseLicenseKey(key);
    if (!parsed) {
      return false;
    }

    // Recreate HMAC from components
    const data = `${parsed.tier}:${parsed.timestamp}:${parsed.nonce}`;
    const expectedHmac = createHmac('sha256', secret)
      .update(data)
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    const keyBuffer = Buffer.from(parsed.hmac);
    const expectedBuffer = Buffer.from(expectedHmac);

    // Ensure both buffers are same length
    if (keyBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(keyBuffer, expectedBuffer);
  } catch (error) {
    logger.error('[RaaS Service] HMAC verification failed', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Check if license key has expired
 *
 * @param timestamp - Expiration timestamp (Unix seconds)
 * @param tier - License tier (master tier has no expiration)
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
 * @param nonce - Unique nonce string
 * @param redisClient - Redis client instance
 * @returns true if nonce already used (replay attack), false if new
 */
export async function checkNonce(
  nonce: string,
  redisClient: typeof redis
): Promise<boolean> {
  const ttl = parseInt(process.env.RAAS_REDIS_TTL || String(DEFAULT_REDIS_TTL), 10);
  const key = `${REDIS_KEYS.NONCE}${nonce}`;

  try {
    // Check if nonce exists
    const exists = await redisClient.get(key);
    if (exists) {
      logger.warn('[RaaS Service] Replay attack detected - nonce reused', { nonce });
      return true; // Nonce already used = replay attack
    }

    // Store nonce with TTL
    await redisClient.set(key, '1', { ex: ttl });
    return false; // Nonce is new
  } catch (error) {
    // Redis unavailable - log warning but don't block
    logger.error('[RaaS Service] Redis nonce check failed', error instanceof Error ? error : new Error(String(error)));
    return false; // Fail open in production
  }
}

/**
 * Check if license key has been revoked
 *
 * @param key - Full license key string
 * @param redisClient - Redis client instance
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
 * Main license key validation function
 *
 * Validation flow:
 * 1. Parse key format
 * 2. Verify HMAC signature
 * 3. Check expiration
 * 4. Check nonce (replay prevention)
 * 5. Check revocation
 *
 * @param key - License key string
 * @param options - Validation options
 * @returns Validation result
 */
export async function validateLicenseKey(
  key: string,
  options: ValidateOptions = {}
): Promise<ValidationResult> {
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
 *
 * @param key - License key to revoke
 * @param redisClient - Redis client instance
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

/**
 * Generate a random nonce for license key creation
 *
 * @returns 32-character hex string
 */
export function generateNonce(): string {
  return randomBytes(16).toString('hex');
}
