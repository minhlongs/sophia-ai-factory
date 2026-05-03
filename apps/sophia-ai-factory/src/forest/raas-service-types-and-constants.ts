/**
 * RaaS Service - Types, Constants, and Pattern Definitions
 *
 * Shared types and constants for RaaS license validation.
 * Imported by raas-service-key-operations and raas-service.
 */

import { redis } from '@/lib/redis';

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
export const LICENSE_KEY_PATTERN = /^raas_(basic|premium|enterprise|master)_(\d{10})_([a-f0-9]{32})_([a-f0-9]{64})$/;

/**
 * Redis key prefixes
 */
export const REDIS_KEYS = {
  NONCE: 'raas:nonce:',
  REVOKED: 'raas:revoked:',
} as const;

/**
 * Default Redis TTL for nonce tracking (1 hour)
 */
export const DEFAULT_REDIS_TTL = 3600;
