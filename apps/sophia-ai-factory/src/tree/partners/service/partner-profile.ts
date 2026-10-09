/**
 * Partner Profile Data Management & Lookups.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/service/partner-profile
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerProfile,
  PartnerType,
  RegisterPartnerInput,
} from '@/tree/partners/types';

/**
 * Generates a clean URL-friendly referral code for a partner.
 */
export function generateReferralCode(partnerName: string): string {
  const firstWord = partnerName.trim().split(/\s+/)[0] || 'PARTNER';
  const cleanPrefix = firstWord
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'PARTNER';
  const randomSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `${cleanPrefix}-${randomSuffix}`;
}

/**
 * Fetch partner profile by user ID.
 */
export async function getPartnerByUserId(
  db: D1Database,
  userId: string,
): Promise<PartnerProfile | null> {
  const row = await db
    .prepare('SELECT * FROM partner_profiles WHERE user_id = ?1 LIMIT 1')
    .bind(userId)
    .first<PartnerProfile>();
  return row ?? null;
}

/**
 * Fetch partner profile by partner ID.
 */
export async function getPartnerById(
  db: D1Database,
  partnerId: string,
): Promise<PartnerProfile | null> {
  const row = await db
    .prepare('SELECT * FROM partner_profiles WHERE id = ?1 LIMIT 1')
    .bind(partnerId)
    .first<PartnerProfile>();
  return row ?? null;
}

/**
 * Fetch partner profile by referral code.
 */
export async function getPartnerByReferralCode(
  db: D1Database,
  referralCode: string,
): Promise<PartnerProfile | null> {
  const row = await db
    .prepare('SELECT * FROM partner_profiles WHERE referral_code = ?1 LIMIT 1')
    .bind(referralCode.trim().toUpperCase())
    .first<PartnerProfile>();
  return row ?? null;
}

/**
 * Register a new partner profile in D1.
 */
export async function registerPartner(
  db: D1Database,
  input: RegisterPartnerInput,
  nowMs = Date.now(),
): Promise<PartnerProfile> {
  const existing = await getPartnerByUserId(db, input.userId);
  if (existing) {
    return existing;
  }

  const id = `ptn_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const partnerType: PartnerType = input.partnerType || 'agency';
  const referralCode = input.referralCode?.trim().toUpperCase() || generateReferralCode(input.partnerName);
  const payoutRail = input.payoutRail || 'USDT';
  const payoutDestination = input.payoutDestinationJson || '{}';

  await db
    .prepare(
      `INSERT INTO partner_profiles (
        id, user_id, tenant_id, partner_name, partner_type, tier, commission_rate_pct,
        referral_code, custom_domain, whitelabel_enabled, total_referred_customers,
        total_mrr_cents, total_earnings_cents, pending_payout_cents, payout_rail,
        payout_destination_json, status, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, 'SILVER', 20.0, ?6, NULL, 0, 0, 0, 0, 0, ?7, ?8, 'active', ?9, ?9)`
    )
    .bind(
      id,
      input.userId,
      input.tenantId,
      input.partnerName.trim(),
      partnerType,
      referralCode,
      payoutRail,
      payoutDestination,
      nowMs,
    )
    .run();

  const created = await getPartnerById(db, id);
  if (!created) {
    throw new Error('Failed to retrieve newly registered partner profile');
  }
  return created;
}
