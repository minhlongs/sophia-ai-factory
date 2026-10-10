/**
 * Top-Up Invoice Creation Service
 *
 * Layer: land (Business domain workflows)
 * @module land/billing/topup/topup-invoice-creator
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { createNowPaymentsSDK } from '@/tree/clients/nowpayments-client';
import type { TopupInvoice } from './types';
import { calculateTopupPrice } from './topup-calculator';

/**
 * Create a top-up invoice for the given user.
 * Creates a NOWPayments invoice and stores a pending_topups row.
 */
export async function createTopupInvoice(
  userId: string,
  mcuAmount: number,
): Promise<TopupInvoice | null> {
  if (!userId || mcuAmount <= 0) {
    logger.error('[OverageTopup] Invalid input', { userId, mcuAmount });
    return null;
  }

  const { priceCents, priceUsd, orderId, expiresAt } = calculateTopupPrice(userId, mcuAmount);

  try {
    const sdk = createNowPaymentsSDK();
    const result = await sdk.createCheckout({
      priceAmount: priceUsd,
      priceCurrency: 'USD',
      orderId,
      orderDescription: `Top-up ${mcuAmount} MCU credits`,
    });

    if (!result || !result.id) {
      logger.error('[OverageTopup] Failed to create NOWPayments checkout', { userId, mcuAmount, priceUsd });
      return null;
    }

    const invoiceId = String(result.id);
    const invoiceUrl =
      result.invoice_url ??
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network'}/dashboard/billing`;

    const db = createServerClient();
    await db.from('pending_topups').insert({
      id: `topup_${invoiceId}`,
      user_id: userId,
      invoice_id: invoiceId,
      mcu_amount: mcuAmount,
      price_cents: priceCents,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    logger.info('[OverageTopup] Invoice created', {
      userId,
      mcuAmount,
      priceUsd,
      invoiceId,
      orderId,
    });

    return {
      invoiceId,
      invoiceUrl,
      mcuAmount,
      priceCents,
      expiresAt,
    };
  } catch (error) {
    logger.error('[OverageTopup] Invoice creation failed', toError(error));
    return null;
  }
}
