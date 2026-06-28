/**
 * Promo code data access layer (D1).
 * All mutations are atomic via D1 prepare/bind/run.
 * @module lib/promo/promo-repo
 */

import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  PromoCodeRow,
  RedemptionRow,
  CreatePromoInput,
  ListAdminFilters,
  RedemptionStatus,
} from './promo-types';

function genId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

/** Fetch promo code row by code string (case-insensitive). */
export async function getCodeByCode(code: string): Promise<PromoCodeRow | null> {
  const db = await getD1Raw();
  const row = await db
    .prepare(`SELECT * FROM promo_codes WHERE code = ?1 LIMIT 1`)
    .bind(code.toUpperCase())
    .first<PromoCodeRow>();
  return row ?? null;
}

/** Atomically increment used_count using CAS pattern. */
export async function incrementUsedCount(codeId: string): Promise<void> {
  const db = await getD1Raw();
  await db
    .prepare(`UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?1`)
    .bind(codeId)
    .run();
}

/**
 * Atomically increment used_count AND insert redemption row via D1 batch.
 * D1 batch executes both statements in a single round-trip, preventing
 * double-increment on concurrent requests (no partial state if one fails).
 */
export async function incrementAndRecord(input: {
  codeId: string;
  promoCode: string;
  userId: string;
  email?: string;
  appliedToTier?: string;
  appliedToSku?: string;
  discountAppliedCents: number;
  trialDaysGranted: number;
  paymentId?: string;
  handoverId?: string;
  status?: RedemptionStatus;
}): Promise<RedemptionRow> {
  const db = await getD1Raw();
  const id = genId();
  const nowSec = Math.floor(Date.now() / 1000);
  const status = input.status ?? 'redeemed';

  const incrementStmt = db
    .prepare(`UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?1`)
    .bind(input.codeId);

  const insertStmt = db
    .prepare(
      `INSERT INTO promo_code_redemptions
       (id, promo_code_id, promo_code, user_id, email, applied_to_tier, applied_to_sku,
        discount_applied_cents, trial_days_granted, redeemed_at, payment_id, handover_id, status)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)`,
    )
    .bind(
      id,
      input.codeId,
      input.promoCode.toUpperCase(),
      input.userId,
      input.email ?? null,
      input.appliedToTier ?? null,
      input.appliedToSku ?? null,
      input.discountAppliedCents,
      input.trialDaysGranted,
      nowSec,
      input.paymentId ?? null,
      input.handoverId ?? null,
      status,
    );

  await db.batch([incrementStmt, insertStmt]);

  return {
    id,
    promo_code_id: input.codeId,
    promo_code: input.promoCode.toUpperCase(),
    user_id: input.userId,
    email: input.email ?? null,
    applied_to_tier: input.appliedToTier ?? null,
    applied_to_sku: input.appliedToSku ?? null,
    discount_applied_cents: input.discountAppliedCents,
    trial_days_granted: input.trialDaysGranted,
    redeemed_at: nowSec,
    payment_id: input.paymentId ?? null,
    handover_id: input.handoverId ?? null,
    status,
  };
}

/** Count how many times a user has redeemed a specific promo code (non-reverted). */
export async function getRedemptionCount(codeId: string, userId: string): Promise<number> {
  const db = await getD1Raw();
  const row = await db
    .prepare(
      `SELECT COUNT(*) as cnt FROM promo_code_redemptions
       WHERE promo_code_id = ?1 AND user_id = ?2 AND status != 'reverted'`,
    )
    .bind(codeId, userId)
    .first<{ cnt: number }>();
  return row?.cnt ?? 0;
}

/** Record a new redemption. Returns the created row. */
export async function recordRedemption(input: {
  promoCodeId: string;
  promoCode: string;
  userId: string;
  email?: string;
  appliedToTier?: string;
  appliedToSku?: string;
  discountAppliedCents: number;
  trialDaysGranted: number;
  paymentId?: string;
  handoverId?: string;
  status?: RedemptionStatus;
}): Promise<RedemptionRow> {
  const db = await getD1Raw();
  const id = genId();
  const nowSec = Math.floor(Date.now() / 1000);
  const status = input.status ?? 'redeemed';

  await db
    .prepare(
      `INSERT INTO promo_code_redemptions
       (id, promo_code_id, promo_code, user_id, email, applied_to_tier, applied_to_sku,
        discount_applied_cents, trial_days_granted, redeemed_at, payment_id, handover_id, status)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)`,
    )
    .bind(
      id,
      input.promoCodeId,
      input.promoCode.toUpperCase(),
      input.userId,
      input.email ?? null,
      input.appliedToTier ?? null,
      input.appliedToSku ?? null,
      input.discountAppliedCents,
      input.trialDaysGranted,
      nowSec,
      input.paymentId ?? null,
      input.handoverId ?? null,
      status,
    )
    .run();

  return {
    id,
    promo_code_id: input.promoCodeId,
    promo_code: input.promoCode.toUpperCase(),
    user_id: input.userId,
    email: input.email ?? null,
    applied_to_tier: input.appliedToTier ?? null,
    applied_to_sku: input.appliedToSku ?? null,
    discount_applied_cents: input.discountAppliedCents,
    trial_days_granted: input.trialDaysGranted,
    redeemed_at: nowSec,
    payment_id: input.paymentId ?? null,
    handover_id: input.handoverId ?? null,
    status,
  };
}

/** Find a reserved redemption by userId and promoCode (for IPN finalization). */
export async function findReservedRedemption(
  userId: string,
  promoCode: string,
): Promise<RedemptionRow | null> {
  const db = await getD1Raw();
  const row = await db
    .prepare(
      `SELECT * FROM promo_code_redemptions
       WHERE user_id = ?1 AND promo_code = ?2 AND status = 'reserved'
       ORDER BY redeemed_at DESC LIMIT 1`,
    )
    .bind(userId, promoCode.toUpperCase())
    .first<RedemptionRow>();
  return row ?? null;
}

/** Finalize a reserved redemption to 'redeemed' and link payment/handover. */
export async function finalizeRedemption(
  redemptionId: string,
  paymentId: string,
  handoverId?: string,
): Promise<void> {
  const db = await getD1Raw();
  await db
    .prepare(
      `UPDATE promo_code_redemptions
       SET status='redeemed', payment_id=?2, handover_id=?3
       WHERE id=?1 AND status='reserved'`,
    )
    .bind(redemptionId, paymentId, handoverId ?? null)
    .run();
}

/** List promo codes for admin panel with optional filters. */
export async function listAdminCodes(filters: ListAdminFilters = {}): Promise<PromoCodeRow[]> {
  const db = await getD1Raw();
  const parts: string[] = ['SELECT * FROM promo_codes WHERE 1=1'];
  const bindings: (string | number)[] = [];
  let idx = 1;

  if (filters.status) {
    parts.push(`AND status = ?${idx++}`);
    bindings.push(filters.status);
  }
  if (filters.discountType) {
    parts.push(`AND discount_type = ?${idx++}`);
    bindings.push(filters.discountType);
  }
  if (filters.appliesToTier) {
    parts.push(`AND (applies_to_tier = ?${idx++} OR applies_to_tier IS NULL)`);
    bindings.push(filters.appliesToTier);
  }

  parts.push(`ORDER BY created_at DESC`);
  parts.push(`LIMIT ?${idx++} OFFSET ?${idx++}`);
  bindings.push(filters.limit ?? 50);
  bindings.push(filters.offset ?? 0);

  const stmt = db.prepare(parts.join(' ')).bind(...bindings);
  const { results } = await stmt.all<PromoCodeRow>();
  return results ?? [];
}

/** Create a new promo code. Returns the created row. */
export async function createCode(
  input: CreatePromoInput,
  adminId: string,
): Promise<PromoCodeRow> {
  const db = await getD1Raw();
  const id = genId();
  const nowSec = Math.floor(Date.now() / 1000);
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null;

  await db
    .prepare(
      `INSERT INTO promo_codes
       (id, code, description, discount_type, discount_value, applies_to_tier, applies_to_sku,
        max_uses, max_uses_per_user, valid_from, valid_until, status, created_by_admin_id, created_at, metadata)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'active',?12,?13,?14)`,
    )
    .bind(
      id,
      input.code.toUpperCase(),
      input.description ?? null,
      input.discountType,
      input.discountValue,
      input.appliesToTier ?? null,
      input.appliesToSku ?? null,
      input.maxUses ?? null,
      input.maxUsesPerUser ?? 1,
      nowSec,
      input.validUntil ?? null,
      adminId,
      nowSec,
      metadata,
    )
    .run();

  return {
    id,
    code: input.code.toUpperCase(),
    description: input.description ?? null,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    applies_to_tier: input.appliesToTier ?? null,
    applies_to_sku: input.appliesToSku ?? null,
    max_uses: input.maxUses ?? null,
    used_count: 0,
    max_uses_per_user: input.maxUsesPerUser ?? 1,
    valid_from: nowSec,
    valid_until: input.validUntil ?? null,
    status: 'active',
    created_by_admin_id: adminId,
    created_at: nowSec,
    metadata,
  };
}

/** Update status of a promo code (active/disabled/expired). */
export async function updateCodeStatus(
  codeId: string,
  status: 'active' | 'disabled' | 'expired',
): Promise<void> {
  const db = await getD1Raw();
  await db
    .prepare(`UPDATE promo_codes SET status = ?1 WHERE id = ?2`)
    .bind(status, codeId)
    .run();
}

/** List redemptions for a specific promo code (admin view). */
export async function listRedemptionsByCode(
  codeId: string,
  limit = 50,
  offset = 0,
): Promise<RedemptionRow[]> {
  const db = await getD1Raw();
  const { results } = await db
    .prepare(
      `SELECT * FROM promo_code_redemptions
       WHERE promo_code_id = ?1
       ORDER BY redeemed_at DESC
       LIMIT ?2 OFFSET ?3`,
    )
    .bind(codeId, limit, offset)
    .all<RedemptionRow>();
  return results ?? [];
}

/** Set trial expiry for a user subscription. */
export async function setUserTrialExpiry(
  userId: string,
  trialEndsAt: number,
): Promise<void> {
  const db = await getD1Raw();
  const nowSec = Math.floor(Date.now() / 1000);
  try {
    await db
      .prepare(
        `UPDATE subscriptions SET trial_ends_at = ?1, updated_at = ?2 WHERE user_id = ?3`,
      )
      .bind(trialEndsAt, nowSec, userId)
      .run();
  } catch (err) {
    logger.warn('[PromoRepo] setUserTrialExpiry failed', { userId, error: err instanceof Error ? err.message : String(err) });
  }
}

/** Get users with expired trials (trial_ends_at <= now and status still active). */
export async function getExpiredTrialUsers(nowSec: number): Promise<{ user_id: string; email: string | null }[]> {
  const db = await getD1Raw();
  const { results } = await db
    .prepare(
      `SELECT s.user_id, u.email
       FROM subscriptions s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.trial_ends_at IS NOT NULL
         AND s.trial_ends_at <= ?1
         AND s.status = 'active'
       LIMIT 100`,
    )
    .bind(nowSec)
    .all<{ user_id: string; email: string | null }>();
  return results ?? [];
}
