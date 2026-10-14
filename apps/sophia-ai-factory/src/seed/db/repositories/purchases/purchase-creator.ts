/**
 * User Purchases Insertion and Creation
 * Layer: SEED (Foundational Primitives)
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { InsertPurchaseInput } from './types';
import { getByPaymentId } from './purchase-queries';

/**
 * Insert a new purchase row.
 * Idempotent: if payment_id already exists (UNIQUE constraint), returns null gracefully.
 * Returns the inserted row id, or null if already exists / error.
 */
export async function insertPurchase(
  input: InsertPurchaseInput,
): Promise<string | null> {
  // Check for existing row first (idempotency guard)
  const existing = await getByPaymentId(input.paymentId);
  if (existing) {
    logger.info('[UserPurchasesRepo] Purchase already exists, skipping insert', {
      paymentId: input.paymentId,
      existingId: existing.id,
    });
    return existing.id;
  }

  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);

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
      .single();

    if (error) {
      // H10 fix (2026-07-01): On UNIQUE violation, a concurrent request already
      // inserted this purchase. Re-fetch and return the existing ID instead of null.
      const isDuplicate =
        typeof error === 'object' && error !== null &&
        ('code' in error || 'message' in error) &&
        (String((error as { code?: string }).code ?? '').includes('23505') ||
         String((error as { message?: string }).message ?? '').toLowerCase().includes('unique') ||
         String((error as { message?: string }).message ?? '').toLowerCase().includes('duplicate'));

      if (isDuplicate) {
        logger.warn('[UserPurchasesRepo] Duplicate purchase, re-fetching', {
          paymentId: input.paymentId,
        });
        const existingRow = await getByPaymentId(input.paymentId);
        if (existingRow) return existingRow.id;
      }

      logger.warn('[UserPurchasesRepo] Insert error', {
        paymentId: input.paymentId,
        error: getErrorMessage(error),
      });
      return null;
    }

    const row = data as { id?: string } | null;
    return row?.id ?? null;
  } catch (err) {
    logger.error('[UserPurchasesRepo] insertPurchase failed', err instanceof Error ? err : undefined, {
      paymentId: input.paymentId,
    });
    return null;
  }
}
