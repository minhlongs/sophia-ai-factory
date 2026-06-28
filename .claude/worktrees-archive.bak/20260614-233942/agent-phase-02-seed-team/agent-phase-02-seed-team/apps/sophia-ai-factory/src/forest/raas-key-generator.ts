/**
 * RaaS License Key Generator
 * Tạo và quản lý license keys cho ROIaaS gating system
 *
 * Key format: raas_{tier}_{timestamp}_{nonce}_{hmac}
 * - tier: basic | premium | enterprise | master
 * - timestamp: Unix timestamp (seconds) - expiration time
 * - nonce: crypto.randomBytes(16).toString('hex') - 32 chars
 * - hmac: HMAC-SHA256(tier:timestamp:nonce, SECRET) - 64 chars
 *
 * @example
 * ```typescript
 * const key = generateLicenseKey(
 *   'premium',
 *   new Date('2027-01-01'),
 *   process.env.RAAS_LICENSE_SECRET!
 * );
 * // Output: raas_premium_1735689600_a1b2c3d4e5f6_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 * ```
 */

import { createHmac, randomBytes } from 'crypto';
import { Tier, TierLowercase } from '@/seed/types';
import { getErrorMessage } from '@/seed/utils/to-error';

/**
 * Generate license key với HMAC-SHA256 signature
 *
 * @param tier - Subscription tier (basic | premium | enterprise | master)
 * @param expiresAt - Expiration date (key will be invalid after this date)
 * @param secret - HMAC secret key (RAAS_LICENSE_SECRET env var)
 * @returns License key string in format: raas_{tier}_{timestamp}_{nonce}_{hmac}
 *
 * @example
 * ```typescript
 * // Generate 1-year premium key
 * const key = generateLicenseKey(
 *   'premium',
 *   new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
 *   process.env.RAAS_LICENSE_SECRET!
 * );
 * ```
 */
export function generateLicenseKey(
  tier: TierLowercase,
  expiresAt: Date,
  secret: string
): string {
  // Validate secret
  if (!secret || secret.length < 16) {
    throw new Error('RAAS_LICENSE_SECRET must be at least 16 characters');
  }

  // Convert tier to lowercase for key format
  const tierLower = tier.toLowerCase();

  // Calculate timestamp (Unix seconds)
  const timestamp = Math.floor(expiresAt.getTime() / 1000);

  // Generate random nonce (32 hex chars = 16 bytes)
  const nonce = randomBytes(16).toString('hex');

  // Create HMAC signature
  // Data format: tier:timestamp:nonce
  const data = `${tierLower}:${timestamp}:${nonce}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(data);
  const signature = hmac.digest('hex');

  // Assemble key: raas_{tier}_{timestamp}_{nonce}_{hmac}
  return `raas_${tierLower}_${timestamp}_${nonce}_${signature}`;
}

/**
 * Generate master key - perpetual license không expiration
 * Dùng cho master tier hoặc admin testing
 *
 * @param tier - Subscription tier (thường là 'master')
 * @param secret - HMAC secret key
 * @returns Perpetual license key (timestamp = 0)
 *
 * @example
 * ```typescript
 * const masterKey = generateMasterKey(
 *   'master',
 *   process.env.RAAS_LICENSE_SECRET!
 * );
 * ```
 */
export function generateMasterKey(
  tier: TierLowercase,
  secret: string
): string {
  // Validate secret
  if (!secret || secret.length < 16) {
    throw new Error('RAAS_LICENSE_SECRET must be at least 16 characters');
  }

  const tierLower = tier.toLowerCase();

  // Master key: timestamp = 0 (perpetual)
  const timestamp = 0;

  // Generate random nonce
  const nonce = randomBytes(16).toString('hex');

  // HMAC signature
  const data = `${tierLower}:${timestamp}:${nonce}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(data);
  const signature = hmac.digest('hex');

  return `raas_${tierLower}_${timestamp}_${nonce}_${signature}`;
}

/**
 * Revoke license key - thêm key vào Redis REVOKED_KEYS set
 * Key bị revoke sẽ bị từ chối bởi raas-gate.ts middleware
 *
 * @param key - License key to revoke
 * @param redisClient - Redis client instance
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * const redis = createClient({ url: process.env.REDIS_URL });
 * await revokeKey('raas_premium_1735689600_abc123_...', redis);
 * ```
 */
export async function revokeKey(
  key: string,
  redisClient: {
    sAdd: (key: string, value: string) => Promise<number>;
  }
): Promise<void> {
  const REVOKED_KEYS_SET = 'raas:revoked_keys';

  try {
    await redisClient.sAdd(REVOKED_KEYS_SET, key);
  } catch (error) {
    throw new Error(
      `Failed to revoke key: ${getErrorMessage(error)}`
    );
  }
}

/**
 * Utility: Parse license key thành components
 * Dùng cho debugging và testing
 *
 * @param key - License key string
 * @returns Parsed components hoặc null nếu invalid format
 *
 * @example
 * ```typescript
 * const parsed = parseKey('raas_premium_1735689600_abc123_...');
 * // { tier: 'premium', timestamp: 1735689600, nonce: 'abc123', hmac: '...' }
 * ```
 */
export function parseKey(key: string): {
  tier: string;
  timestamp: number;
  nonce: string;
  hmac: string;
} | null {
  const parts = key.split('_');

  // Valid key has 6 parts: raas, {tier}, {timestamp}, {nonce}, {hmac}
  // But hmac itself contains no underscores, so we expect exactly 5 parts after split
  if (parts.length !== 5 || parts[0] !== 'raas') {
    return null;
  }

  const [, tier, timestampStr, nonce, hmac] = parts;
  const timestamp = parseInt(timestampStr, 10);

  if (isNaN(timestamp) || nonce.length !== 32 || hmac.length !== 64) {
    return null;
  }

  return { tier, timestamp, nonce, hmac };
}
