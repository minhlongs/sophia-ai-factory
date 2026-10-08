/**
 * @file b2b-warmup-engine.ts
 * @description Pure calculations for B2B email warmup ramp, CAN-SPAM HMAC headers & corporate domain validation
 * @layer tree
 */

import crypto from 'crypto';

const PERSONAL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'mail.com',
]);

/**
 * Checks if domain is corporate / professional (rejects generic webmail)
 */
export function isCorporateDomain(domain: string): boolean {
  if (!domain || domain.trim() === '') return false;
  const clean = domain.toLowerCase().trim();
  return !PERSONAL_DOMAINS.has(clean) && clean.includes('.');
}

export interface WarmupRampConfig {
  initialDailyVolume: number;
  rampRate: number;
  maxDailyVolume: number;
}

const DEFAULT_RAMP_CONFIG: WarmupRampConfig = {
  initialDailyVolume: 5,
  rampRate: 0.2, // 20% daily ramp
  maxDailyVolume: 50,
};

/**
 * Calculates daily sending quota for a given ramp day:
 * V_d = min(V_max, V_0 * (1 + r)^d)
 */
export function calculateWarmupDailyVolume(
  day: number,
  config: WarmupRampConfig = DEFAULT_RAMP_CONFIG
): number {
  if (day <= 0) return 0;
  const raw = config.initialDailyVolume * Math.pow(1 + config.rampRate, day - 1);
  return Math.min(config.maxDailyVolume, Math.floor(raw));
}

/**
 * Generates HMAC-SHA256 signature for one-click CAN-SPAM unsubscribe header
 */
export function generateUnsubscribeSignature(
  leadId: string,
  userId: string,
  secretKey: string
): string {
  const payload = `${leadId}:${userId}`;
  return crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
}

/**
 * Verifies HMAC-SHA256 signature for one-click unsubscribe
 */
export function verifyUnsubscribeSignature(
  leadId: string,
  userId: string,
  providedSignature: string,
  secretKey: string
): boolean {
  const expected = generateUnsubscribeSignature(leadId, userId, secretKey);
  if (expected.length !== providedSignature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(providedSignature));
}
