/**
 * Affiliate Partner Referrer Resolution
 *
 * Resolves the active affiliate partner behind a payment using, in priority order:
 * an explicit partner code override, the `ref` query parameter carried by an
 * affiliate link, an existing referral binding, a pending-order promo code, and
 * finally the user profile's referred_by value.
 *
 * Layer: tree (domain business logic, edge-compatible)
 *
 * @module tree/affiliates/attribution/partner-code-resolver
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  AttributionParams,
  AffiliatePartnerRow,
  AffiliateReferralRow,
} from '@/seed/types/affiliate';
import type { ReferrerResolution } from './types';
import { extractReferredByFromSettings } from './referred-by-extractor';

/**
 * Looks up an active partner by code, user id, or partner id.
 * Never throws: D1 errors surface as "not found" and resolution falls through.
 */
async function findActivePartner(
  d1: D1Database,
  idOrCode: string,
): Promise<AffiliatePartnerRow | null> {
  return d1
    .prepare(
      `SELECT * FROM affiliate_partners
       WHERE (partner_code = ?1 OR user_id = ?1 OR id = ?1) AND status = 'active'
       LIMIT 1`
    )
    .bind(idOrCode)
    .first<AffiliatePartnerRow>()
    .catch(() => null);
}

/** Looks up an active partner by its exact partner_code column. */
async function findActivePartnerByCode(
  d1: D1Database,
  partnerCode: string,
): Promise<AffiliatePartnerRow | null> {
  return d1
    .prepare(
      `SELECT * FROM affiliate_partners WHERE partner_code = ?1 AND status = 'active' LIMIT 1`
    )
    .bind(partnerCode)
    .first<AffiliatePartnerRow>()
    .catch(() => null);
}

/** Convenience wrapper turning a partner hit into a referral-free resolution. */
function asCodeResolution(partner: AffiliatePartnerRow | null): ReferrerResolution | null {
  return partner ? { partner, referral: null } : null;
}

/** Source A: an explicit partner code supplied by the caller. */
async function resolveFromCodeOverride(
  d1: D1Database,
  params: AttributionParams,
): Promise<ReferrerResolution | null> {
  if (!params.partnerCodeOverride) return null;
  return asCodeResolution(await findActivePartnerByCode(d1, params.partnerCodeOverride));
}

/**
 * Source B: the `ref` query parameter of an affiliate link.
 * The cookie-free fallback used when marketing consent was declined.
 */
async function resolveFromLinkParameter(
  d1: D1Database,
  params: AttributionParams,
): Promise<ReferrerResolution | null> {
  const code = params.refParam?.trim();
  if (!code) return null;
  return asCodeResolution(await findActivePartner(d1, code));
}

/** Source C: an existing pending or converted referral binding for the customer. */
async function resolveFromReferralBinding(
  d1: D1Database,
  params: AttributionParams,
): Promise<ReferrerResolution | null> {
  if (!params.customerId) return null;

  const referral = await d1
    .prepare(
      `SELECT * FROM affiliate_referrals
       WHERE referred_user_id = ?1 AND status IN ('pending', 'converted')
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(params.customerId)
    .first<AffiliateReferralRow>();

  if (!referral) return null;
  const partner = await findActivePartner(d1, referral.partner_id);
  return partner ? { partner, referral } : null;
}

/** Source D: the promo code recorded on the pending order for this payment. */
async function resolveFromPendingOrder(
  d1: D1Database,
  params: AttributionParams,
): Promise<ReferrerResolution | null> {
  if (!params.orderId) return null;

  const order = await d1
    .prepare(`SELECT promo_code FROM pending_orders WHERE order_id = ?1 LIMIT 1`)
    .bind(params.orderId)
    .first<{ promo_code?: string | null }>()
    .catch(() => null);

  if (!order?.promo_code) return null;
  return asCodeResolution(await findActivePartner(d1, order.promo_code));
}

/** Source E: the referred_by value stored on the customer's user profile. */
async function resolveFromUserProfile(
  d1: D1Database,
  params: AttributionParams,
): Promise<ReferrerResolution | null> {
  if (!params.customerId) return null;

  const userProfile = await d1
    .prepare(`SELECT settings FROM user_profiles WHERE user_id = ?1 LIMIT 1`)
    .bind(params.customerId)
    .first<{ settings?: string | null }>()
    .catch(() => null);

  const referredBy = extractReferredByFromSettings(userProfile?.settings);
  if (!referredBy) return null;
  return asCodeResolution(await findActivePartner(d1, referredBy));
}

/**
 * Resolves active affiliate partner from explicit code, the `ref` link parameter,
 * referral bindings, order promo, or user profile.
 */
export async function resolveReferrerPartner(
  d1: D1Database,
  params: AttributionParams,
): Promise<ReferrerResolution> {
  const sources = [
    resolveFromCodeOverride,
    resolveFromLinkParameter,
    resolveFromReferralBinding,
    resolveFromPendingOrder,
    resolveFromUserProfile,
  ];

  for (const source of sources) {
    const resolved = await source(d1, params);
    if (resolved) return resolved;
  }

  return { partner: null, referral: null };
}
