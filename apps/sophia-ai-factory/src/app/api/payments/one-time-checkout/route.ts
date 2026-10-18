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
import { createOneTimeInvoiceUrl, createOneTimeCheckout } from '@/tree/clients/nowpayments-client';
import { getOneTimeSkuById } from '@/seed/config/one-time-skus';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { logger } from '@/seed/utils/logger-utility';
import { errorResponse, handleThrownError } from '@/seed/api';
import {
  oneTimeCheckoutSchema,
  findPendingInvoiceUrl,
  resolveUserId,
} from './one-time-checkout-helpers';

export { oneTimeCheckoutSchema };

export const POST = withRateLimit(async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = oneTimeCheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Invalid request', 'VALIDATION_ERROR', 400);
    }

    const sku = getOneTimeSkuById(parsed.data.skuId);
    if (!sku) {
      return errorResponse('Invalid SKU', 'INVALID_SKU', 400);
    }

    const userId = await resolveUserId(request, parsed.data.userId);
    if (!userId) {
      return NextResponse.json(
        { error: 'Login required before checkout. Please sign in first.' },
        { status: 401 }
      );
    }

    // P0.5: Backend dedupe — return existing pending invoice if within window
    const existingUrl = await findPendingInvoiceUrl(userId, sku.id);
    if (existingUrl) {
      logger.info('[one-time-checkout] Returning existing pending invoice (dedupe)', {
        userId,
        skuId: sku.id,
      });
      return NextResponse.json({ url: existingUrl, deduplicated: true });
    }

    let url: string;
    const orderId = `sophia_${userId}_${Date.now()}`;
    try {
      const result = await createOneTimeCheckout({
        skuId: sku.id,
        userId,
        customerEmail: parsed.data.customerEmail,
        orderId,
      });
      url = result.invoiceUrl;
    } catch (sdkErr) {
      logger.warn('[one-time-checkout] SDK checkout failed, falling back to pre-created invoice', {
        error: sdkErr instanceof Error ? sdkErr.message : String(sdkErr),
        skuId: sku.id,
      });
      url = createOneTimeInvoiceUrl(sku, userId, parsed.data.customerEmail, orderId);
    }
    return NextResponse.json({ url });
  } catch (error) {
    return handleThrownError(error, 'Failed to create checkout', 'CHECKOUT_FAILED');
  }
}, { addHeaders: true, config: { intervalMs: 60000, maxRequests: 10 } });
