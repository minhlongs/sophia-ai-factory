/**
 * POST /api/payments/one-time-checkout
 *
 * Creates a NOWPayments invoice URL for one-time bundle purchase.
 *
 * P0.5: Backend dedupe guard — if user already has a pending purchase
 * for the same SKU created in the last 30 minutes, return the EXISTING
 * invoice URL instead of creating a new one. Prevents double-invoice on
 * rapid re-clicks or page refresh.
 *
 * @module app/api/payments/one-time-checkout
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createOneTimeInvoiceUrl } from '@/tree/clients/nowpayments-client';
import { getOneTimeSkuById, ONE_TIME_SKUS } from '@/seed/config/one-time-skus';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

/** 30 minutes — window for detecting duplicate pending purchases. */
const DEDUPE_WINDOW_SECS = 30 * 60

export const oneTimeCheckoutSchema = z.object({
  skuId: z.enum(Object.keys(ONE_TIME_SKUS) as [string, ...string[]]),
  userId: z.string().optional(),
  customerEmail: z.string().email().optional(),
});

interface PendingPurchaseRow {
  payment_id: string
  invoice_id: string | null
}

/**
 * Check if user already has a pending purchase for the given SKU created
 * within the last DEDUPE_WINDOW_SECS. Returns the invoice URL if found.
 * Silently returns null on any DB error (fail-open for UX resilience).
 */
async function findPendingInvoiceUrl(
  userId: string,
  skuId: string,
): Promise<string | null> {
  try {
    const db = createServerClient()
    const cutoff = Math.floor(Date.now() / 1000) - DEDUPE_WINDOW_SECS
    const { data } = await db
      .from('user_purchases')
      .select('payment_id, invoice_id')
      .eq('user_id', userId)
      .eq('sku', skuId)
      .eq('status', 'pending')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const row = data as PendingPurchaseRow | null
    if (!row) return null

    // Reconstruct the invoice URL from the invoice_id stored during creation
    // invoice_id for NOWPayments one-time is the NOWPayments invoice URL path
    if (row.invoice_id) {
      return row.invoice_id
    }
    return null
  } catch (err) {
    logger.warn('[one-time-checkout] dedupe check failed (fail-open)', {
      userId,
      skuId,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

async function resolveUserId(request: Request, override?: string): Promise<string | null> {
  if (override) return override;
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (user?.id) return user.id;
  } catch { /* auth failed */ }
  return null;
}

export const POST = withRateLimit(async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = oneTimeCheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const sku = getOneTimeSkuById(parsed.data.skuId);
    if (!sku) {
      return NextResponse.json({ error: `Unknown SKU: ${parsed.data.skuId}` }, { status: 400 });
    }

    const userId = await resolveUserId(request, parsed.data.userId);
    if (!userId) {
      return NextResponse.json(
        { error: 'Login required before checkout. Please sign in first.' },
        { status: 401 }
      );
    }

    // P0.5: Backend dedupe — return existing pending invoice if within window
    const existingUrl = await findPendingInvoiceUrl(userId, sku.id)
    if (existingUrl) {
      logger.info('[one-time-checkout] Returning existing pending invoice (dedupe)', {
        userId,
        skuId: sku.id,
      })
      return NextResponse.json({ url: existingUrl, deduplicated: true });
    }

    const url = createOneTimeInvoiceUrl(sku, userId, parsed.data.customerEmail);
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to create one-time checkout: ${message}` },
      { status: 500 }
    );
  }
}, { addHeaders: true, config: { intervalMs: 60000, maxRequests: 10 } });
