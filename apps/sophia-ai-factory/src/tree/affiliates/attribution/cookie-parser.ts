/**
 * Cookie and Referrer Parser Utilities
 * Layer: tree (domain business logic, edge-compatible)
 *
 * @module tree/affiliates/attribution/cookie-parser
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  AttributionParams,
  AffiliatePartnerRow,
  AffiliateReferralRow,
} from '@/seed/types/affiliate';
import type { ReferrerResolution } from './types';

/**
 * Extracts referred_by string from user settings raw data.
 */
export function extractReferredByFromSettings(raw: unknown): string | undefined {
  if (!raw) return undefined;
  try {
    const settings = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>;
    return typeof settings.referred_by === 'string' ? settings.referred_by : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolves active affiliate partner from explicit code, referral cookie bindings, order promo, or user profile.
 */
export async function resolveReferrerPartner(
  d1: D1Database,
  params: AttributionParams,
): Promise<ReferrerResolution> {
  // A. Explicit partner code override passed in params
  if (params.partnerCodeOverride) {
    const partner = await d1
      .prepare(`SELECT * FROM affiliate_partners WHERE partner_code = ?1 AND status = 'active' LIMIT 1`)
      .bind(params.partnerCodeOverride)
      .first<AffiliatePartnerRow>();
    if (partner) return { partner, referral: null };
  }

  // B. Referral binding table check (e.g. from cookie tracking)
  if (params.customerId) {
    const referral = await d1
      .prepare(
        `SELECT * FROM affiliate_referrals
         WHERE referred_user_id = ?1 AND status IN ('pending', 'converted')
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(params.customerId)
      .first<AffiliateReferralRow>();

    if (referral) {
      const partner = await d1
        .prepare(`SELECT * FROM affiliate_partners WHERE id = ?1 AND status = 'active' LIMIT 1`)
        .bind(referral.partner_id)
        .first<AffiliatePartnerRow>();
      if (partner) return { partner, referral };
    }
  }

  // C. Pending order referral / promo code fallback
  if (params.orderId) {
    const order = await d1
      .prepare(`SELECT promo_code FROM pending_orders WHERE order_id = ?1 LIMIT 1`)
      .bind(params.orderId)
      .first<{ promo_code?: string | null }>()
      .catch(() => null);

    if (order?.promo_code) {
      const partner = await d1
        .prepare(`SELECT * FROM affiliate_partners WHERE (partner_code = ?1 OR id = ?1) AND status = 'active' LIMIT 1`)
        .bind(order.promo_code)
        .first<AffiliatePartnerRow>()
        .catch(() => null);
      if (partner) return { partner, referral: null };
    }
  }

  // D. User profile settings fallback (referred_by)
  if (params.customerId) {
    const userProfile = await d1
      .prepare(`SELECT settings FROM user_profiles WHERE user_id = ?1 LIMIT 1`)
      .bind(params.customerId)
      .first<{ settings?: string | null }>()
      .catch(() => null);

    const referredBy = extractReferredByFromSettings(userProfile?.settings);
    if (referredBy) {
      const partner = await d1
        .prepare(
          `SELECT * FROM affiliate_partners
           WHERE (partner_code = ?1 OR user_id = ?1 OR id = ?1) AND status = 'active'
           LIMIT 1`
        )
        .bind(referredBy)
        .first<AffiliatePartnerRow>()
        .catch(() => null);
      if (partner) return { partner, referral: null };
    }
  }

  return { partner: null, referral: null };
}
