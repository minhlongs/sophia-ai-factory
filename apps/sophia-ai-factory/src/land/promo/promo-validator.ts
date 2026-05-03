/**
 * Promo code validation logic.
 * Checks all constraints: status, time window, usage limits, tier/sku restrictions.
 * @module lib/promo/promo-validator
 */

import { getCodeByCode, getRedemptionCount } from './promo-repo';
import type { ValidateResult } from './promo-types';

export interface ValidateOptions {
  /** User ID — required for per-user limit check. Pass undefined for public pre-check. */
  userId?: string;
  /** Target tier to validate against applies_to_tier. */
  tier?: string;
  /** Target SKU to validate against applies_to_sku. */
  sku?: string;
}

/**
 * Validate a promo code against all constraints.
 * Returns ValidateResult with valid=true and details, or valid=false with reason.
 */
export async function validatePromoCode(
  code: string,
  opts: ValidateOptions = {},
): Promise<ValidateResult> {
  if (!code || typeof code !== 'string') {
    return { valid: false, reason: 'not_found' };
  }

  const row = await getCodeByCode(code.trim().toUpperCase());

  if (!row) {
    return { valid: false, reason: 'not_found' };
  }

  if (row.status !== 'active') {
    return { valid: false, reason: 'expired' };
  }

  const nowSec = Math.floor(Date.now() / 1000);

  if (row.valid_from > nowSec) {
    return { valid: false, reason: 'not_started' };
  }

  if (row.valid_until !== null && row.valid_until < nowSec) {
    return { valid: false, reason: 'expired' };
  }

  if (row.max_uses !== null && row.used_count >= row.max_uses) {
    return { valid: false, reason: 'max_uses' };
  }

  if (row.applies_to_tier !== null && opts.tier) {
    if (row.applies_to_tier.toUpperCase() !== opts.tier.toUpperCase()) {
      return { valid: false, reason: 'wrong_tier' };
    }
  }

  if (row.applies_to_sku !== null && opts.sku) {
    if (row.applies_to_sku !== opts.sku) {
      return { valid: false, reason: 'wrong_sku' };
    }
  }

  if (opts.userId) {
    const userCount = await getRedemptionCount(row.id, opts.userId);
    if (userCount >= row.max_uses_per_user) {
      return { valid: false, reason: 'user_limit' };
    }
  }

  return {
    valid: true,
    code: row.code,
    codeId: row.id,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    appliesToTier: row.applies_to_tier,
    appliesToSku: row.applies_to_sku,
    description: row.description,
  };
}
