/**
 * user_purchases repository — CRUD for one-time bundle purchases.
 * All writes are idempotent via payment_id UNIQUE constraint.
 *
 * @module lib/db/repositories/user-purchases-repo
 */

import { createServerClient, getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import type { UserPurchase, PurchaseKind, PurchaseStatus } from '@/seed/types'

// ── Insert ─────────────────────────────────────────────────────────────────────

export interface InsertPurchaseInput {
  userId: string
  kind: PurchaseKind
  sku: string
  paymentId: string
  invoiceId?: string | null
  amountCents: number
  creditsTotal: number
  expiresAt?: number | null
  status?: PurchaseStatus
}

/**
 * Insert a new purchase row.
 * Idempotent: if payment_id already exists (UNIQUE constraint), returns null gracefully.
 * Returns the inserted row id, or null if already exists / error.
 */
export async function insertPurchase(
  input: InsertPurchaseInput,
): Promise<string | null> {
  // Check for existing row first (idempotency guard)
  const existing = await getByPaymentId(input.paymentId)
  if (existing) {
    logger.info('[UserPurchasesRepo] Purchase already exists, skipping insert', {
      paymentId: input.paymentId,
      existingId: existing.id,
    })
    return existing.id
  }

  const db = createServerClient()
  const now = Math.floor(Date.now() / 1000)

  try {
    const { data, error } = await db
      .from('user_purchases')
      .insert({
        user_id: input.userId,
        kind: input.kind,
        sku: input.sku,
        payment_id: input.paymentId,
        invoice_id: input.invoiceId ?? null,
        amount_cents: input.amountCents,
        credits_total: input.creditsTotal,
        credits_remaining: input.creditsTotal,
        expires_at: input.expiresAt ?? null,
        status: input.status ?? 'pending',
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single()

    if (error) {
      logger.warn('[UserPurchasesRepo] Insert error', {
        paymentId: input.paymentId,
        error: getErrorMessage(error),
      })
      return null
    }

    const row = data as { id?: string } | null
    return row?.id ?? null
  } catch (err) {
    logger.error('[UserPurchasesRepo] insertPurchase failed', err instanceof Error ? err : undefined, {
      paymentId: input.paymentId,
    })
    return null
  }
}

// ── Lookups ────────────────────────────────────────────────────────────────────

/** Fetch a purchase row by NOWPayments payment_id. */
export async function getByPaymentId(paymentId: string): Promise<UserPurchase | null> {
  const db = createServerClient()
  const { data } = await db
    .from('user_purchases')
    .select('*')
    .eq('payment_id', paymentId)
    .single()
  return (data as UserPurchase | null) ?? null
}

/** Fetch all purchases for a user (ordered latest first). */
export async function listByUser(userId: string): Promise<UserPurchase[]> {
  const db = createServerClient()
  const { data } = await db
    .from('user_purchases')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data as UserPurchase[] | null) ?? []
}

/** Fetch remaining credits for a user's active one-time purchases. */
export async function getUserCredits(
  userId: string,
): Promise<{ creditsRemaining: number; expiresAt: number | null }> {
  const db = createServerClient()
  const now = Math.floor(Date.now() / 1000)

  const { data } = await db
    .from('user_purchases')
    .select('credits_remaining, expires_at')
    .eq('user_id', userId)
    .eq('kind', 'one_time')
    .eq('status', 'paid')
    .gte('expires_at', now)

  const rows = (data as Array<{ credits_remaining: number; expires_at: number | null }> | null) ?? []
  const total = rows.reduce((sum, r) => sum + (r.credits_remaining ?? 0), 0)
  const nearestExpiry = rows.reduce<number | null>((min, r) => {
    if (!r.expires_at) return min
    if (min === null || r.expires_at < min) return r.expires_at
    return min
  }, null)

  return { creditsRemaining: total, expiresAt: nearestExpiry }
}

// ── Status mutations ───────────────────────────────────────────────────────────

/** Mark a purchase as paid and set credits_remaining. Atomic. */
export async function markPaid(
  paymentId: string,
  creditsGranted: number,
  expiresAt?: number | null,
): Promise<void> {
  const db = createServerClient()
  const now = Math.floor(Date.now() / 1000)

  await db
    .from('user_purchases')
    .update({
      status: 'paid',
      credits_total: creditsGranted,
      credits_remaining: creditsGranted,
      expires_at: expiresAt ?? null,
      paid_at: now,
      updated_at: now,
    })
    .eq('payment_id', paymentId)
}

/** Mark a purchase as refunded and zero out credits. */
export async function markRefunded(paymentId: string): Promise<void> {
  const db = createServerClient()
  const now = Math.floor(Date.now() / 1000)

  await db
    .from('user_purchases')
    .update({
      status: 'refunded',
      credits_remaining: 0,
      refunded_at: now,
      updated_at: now,
    })
    .eq('payment_id', paymentId)
}

/**
 * Atomically decrement credits_remaining by 1 (for 1-credit = 1 video render).
 * Uses a single atomic UPDATE with CAS guard to prevent over-consumption.
 * Returns true if decrement succeeded (credits were available and purchase valid), false otherwise.
 *
 * Verification includes:
 * - status = 'paid' (excludes pending, refunded, failed)
 * - credits_remaining > 0
 * - (expires_at IS NULL OR expires_at > current_timestamp) — not expired
 *
 * This implementation eliminates the TOCTOU race in the previous SELECT-then-UPDATE pattern.
 */
export async function decrementCredits(purchaseId: string): Promise<boolean> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000);

  // Atomic UPDATE with all necessary guards in the WHERE clause.
  // The UPDATE affects exactly 1 row if and only if the purchase is valid and has credits.
  const result = await db
    .prepare(
      `UPDATE user_purchases
       SET credits_remaining = credits_remaining - 1,
           updated_at = ?2
       WHERE id = ?1
         AND status = 'paid'
         AND credits_remaining > 0
         AND (expires_at IS NULL OR expires_at > ?2)`,
    )
    .bind(purchaseId, now)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}
