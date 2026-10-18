/**
 * Usage Metering Credit Calculator, License Key Hasher & Timer
 *
 * Layer: tree/usage-metering
 *
 * @module tree/usage-metering/tracker-credit-calculator
 */

import { sha256 } from '@/tree/audit/crypto-utils';
import { CREDIT_RULES } from './constants';

/**
 * Get tier rate multiplier
 */
function getTierMultiplier(tier: string): number {
  const multipliers: Record<string, number> = {
    BASIC: 1.0,
    PREMIUM: 0.8,
    ENTERPRISE: 0.6,
    MASTER: 0.5,
  };
  return multipliers[tier] ?? 1.0;
}

/**
 * Calculate credits based on service rules
 */
export function calculateCredits(
  service: string,
  action: string,
  tokensTotal?: number,
  tier: string = 'BASIC'
): number {
  const rules = CREDIT_RULES[service];
  if (!rules) return 1;

  const rule = rules[action] || rules.default;

  let baseCredits: number;

  if (rule.type === 'per-call') {
    baseCredits = rule.credits ?? 1;
  } else if (rule.type === 'per-1k-tokens' && tokensTotal) {
    baseCredits = Math.ceil(tokensTotal / 1000) * (rule.creditsPer1k ?? 1);
  } else {
    baseCredits = 1;
  }

  const tierMultiplier = getTierMultiplier(tier);
  return Math.ceil(baseCredits / tierMultiplier);
}

/**
 * Generate license key hash
 */
export function hashLicenseKey(key: string): string {
  return sha256(key);
}

/**
 * Start a timer for response time tracking
 */
export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}
