import { z } from 'zod';
import { ONE_TIME_SKUS } from '@/seed/config/one-time-skus';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

/** 30 minutes — window for detecting duplicate pending purchases. */
const DEDUPE_WINDOW_SECS = 30 * 60;

export const oneTimeCheckoutSchema = z.object({
  skuId: z.enum(Object.keys(ONE_TIME_SKUS) as [string, ...string[]]),
  userId: z.string().optional(),
  customerEmail: z.string().email().optional(),
});

interface PendingPurchaseRow {
  payment_id: string;
  invoice_id: string | null;
}

/**
 * Check if user already has a pending purchase for the given SKU created
 * within the last DEDUPE_WINDOW_SECS. Returns the invoice URL if found.
 * Silently returns null on any DB error (fail-open for UX resilience).
 */
export async function findPendingInvoiceUrl(
  userId: string,
  skuId: string,
): Promise<string | null> {
  try {
    const db = createServerClient();
    const cutoff = Math.floor(Date.now() / 1000) - DEDUPE_WINDOW_SECS;
    const { data } = await db
      .from('user_purchases')
      .select('payment_id, invoice_id')
      .eq('user_id', userId)
      .eq('sku', skuId)
      .eq('status', 'pending')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const row = data as PendingPurchaseRow | null;
    if (!row) return null;

    if (row.invoice_id) {
      return row.invoice_id;
    }
    return null;
  } catch (err) {
    logger.warn('[one-time-checkout] dedupe check failed (fail-open)', {
      userId,
      skuId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function resolveUserId(request: Request, override?: string): Promise<string | null> {
  if (override) return override;
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (user?.id) return user.id;
  } catch {
    /* auth failed */
  }
  return null;
}
