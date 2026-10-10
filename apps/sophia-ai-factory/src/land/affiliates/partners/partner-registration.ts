import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { encryptSecret } from '@/tree/crypto/encrypt-secret';
import { validateTrc20Address } from '@/land/payouts/usdt-addr-validator';
import type {
  AffiliatePartner,
  AffiliatePartnerRow,
  PartnerTier,
  PartnerStatus,
} from '@/seed/types/affiliate';
import type {
  RegisterPartnerInput,
} from './types';
import { generatePartnerCode } from './commission-calculator';

/**
 * Convert DB row to domain model.
 */
export function rowToPartner(row: AffiliatePartnerRow): AffiliatePartner {
  return {
    id: row.id,
    userId: row.user_id,
    partnerCode: row.partner_code,
    tier: row.tier,
    commissionRatePct: Number(row.commission_rate_pct),
    tier2RatePct: Number(row.tier2_rate_pct),
    parentPartnerId: row.parent_partner_id,
    usdtTrc20AddressEncrypted: row.usdt_trc20_address_encrypted,
    status: row.status,
    totalEarningsCents: Number(row.total_earnings_cents),
    pendingPayoutCents: Number(row.pending_payout_cents),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/**
 * Register a new affiliate partner profile.
 */
export async function registerPartner(input: RegisterPartnerInput): Promise<AffiliatePartner> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  // Check if partner profile already exists for user
  const existing = await db
    .prepare('SELECT * FROM affiliate_partners WHERE user_id = ?')
    .bind(input.userId)
    .first<AffiliatePartnerRow>();

  if (existing) {
    return rowToPartner(existing);
  }

  // Validate or generate partner code
  let code = input.requestedCode?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9_-]{3,30}$/.test(code)) {
    code = generatePartnerCode();
  }

  // Ensure code uniqueness
  const duplicate = await db
    .prepare('SELECT id FROM affiliate_partners WHERE partner_code = ?')
    .bind(code)
    .first<{ id: string }>();

  if (duplicate) {
    code = generatePartnerCode(code);
  }

  let encryptedAddress: string | null = null;
  if (input.usdtTrc20Address) {
    const isValid = await validateTrc20Address(input.usdtTrc20Address);
    if (!isValid) {
      throw new Error(`Invalid TRC-20 USDT wallet address: ${input.usdtTrc20Address}`);
    }
    encryptedAddress = await encryptSecret(input.usdtTrc20Address);
  }

  const id = `aff_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = Date.now();
  const tier: PartnerTier = input.tier || 'STANDARD';
  const commissionRatePct = 20.0;
  const tier2RatePct = 5.0;
  const status: PartnerStatus = 'active';

  await db
    .prepare(
      `INSERT INTO affiliate_partners (
        id, user_id, partner_code, tier, commission_rate_pct, tier2_rate_pct,
        parent_partner_id, usdt_trc20_address_encrypted, status,
        total_earnings_cents, pending_payout_cents, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`
    )
    .bind(
      id,
      input.userId,
      code,
      tier,
      commissionRatePct,
      tier2RatePct,
      input.parentPartnerId ?? null,
      encryptedAddress,
      status,
      now,
      now
    )
    .run();

  logger.info('[AffiliatePartnerService] Partner registered', {
    partnerId: id,
    userId: input.userId,
    partnerCode: code,
  });

  return {
    id,
    userId: input.userId,
    partnerCode: code,
    tier,
    commissionRatePct,
    tier2RatePct,
    parentPartnerId: input.parentPartnerId,
    usdtTrc20AddressEncrypted: encryptedAddress,
    status,
    totalEarningsCents: 0,
    pendingPayoutCents: 0,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
}
