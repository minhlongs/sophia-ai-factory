import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { encryptSecret } from '@/tree/crypto/encrypt-secret';
import { validateTrc20Address } from '@/land/payouts/usdt-addr-validator';
import type {
  AffiliatePartner,
  AffiliatePartnerRow,
} from '@/seed/types/affiliate';
import type {
  RecordClickInput,
} from './types';
import { rowToPartner } from './partner-registration';

export { getPartnerStats } from './partner-stats-queries';

/**
 * Retrieve partner profile by user ID.
 */
export async function getPartnerByUserId(userId: string): Promise<AffiliatePartner | null> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const row = await db
    .prepare('SELECT * FROM affiliate_partners WHERE user_id = ?')
    .bind(userId)
    .first<AffiliatePartnerRow>();

  return row ? rowToPartner(row) : null;
}

/**
 * Retrieve partner profile by partner referral code.
 */
export async function getPartnerByCode(code: string): Promise<AffiliatePartner | null> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const row = await db
    .prepare('SELECT * FROM affiliate_partners WHERE partner_code = ?')
    .bind(code.toUpperCase().trim())
    .first<AffiliatePartnerRow>();

  return row ? rowToPartner(row) : null;
}

/**
 * Record a referral click event for attribution.
 */
export async function recordPartnerClick(input: RecordClickInput): Promise<boolean> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const partner = await getPartnerByCode(input.partnerCode);
  if (!partner) {
    logger.warn('[AffiliatePartnerService] Click rejected: unknown partner code', {
      code: input.partnerCode,
    });
    return false;
  }

  const clickId = `clk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = Date.now();

  try {
    await db
      .prepare(
        `INSERT INTO affiliate_referral_clicks (
          id, affiliate_partner_id, partner_code, ip_hash, user_agent, referer_url, sub_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        clickId,
        partner.id,
        partner.partnerCode,
        input.ipHash ?? null,
        input.userAgent ? input.userAgent.slice(0, 120) : null,
        input.refererUrl ?? null,
        input.subId ?? null,
        now,
      )
      .run();

    return true;
  } catch (err) {
    logger.error('[AffiliatePartnerService] Failed to record click', err instanceof Error ? err : undefined, {
      partnerCode: input.partnerCode,
    });
    return false;
  }
}

/**
 * Update encrypted payout address.
 */
export async function updatePartnerPayoutAddress(
  partnerId: string,
  usdtTrc20Address: string,
): Promise<boolean> {
  const isValid = await validateTrc20Address(usdtTrc20Address);
  if (!isValid) {
    throw new Error(`Invalid TRC-20 USDT wallet address: ${usdtTrc20Address}`);
  }

  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const encrypted = await encryptSecret(usdtTrc20Address);
  const now = Date.now();

  const res = await db
    .prepare(
      `UPDATE affiliate_partners
       SET usdt_trc20_address_encrypted = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(encrypted, now, partnerId)
    .run();

  return (res.meta?.changes ?? 0) > 0;
}
