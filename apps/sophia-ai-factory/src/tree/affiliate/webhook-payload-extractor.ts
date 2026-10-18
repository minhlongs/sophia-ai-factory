/**
 * Affiliate Webhook Payload Money & Conversion ID Extractor
 * Pure Domain Layer (Tree)
 *
 * @module tree/affiliate/webhook-payload-extractor
 */

import type { AffiliateNetwork } from './attribution-parser';

export interface ExtractedWebhookValues {
  conversionId: string;
  commissionCents: number;
  orderValueCents: number;
}

/**
 * Extracts normalized conversion ID, commission cents, and order value cents
 * from multi-network affiliate webhook payloads.
 */
export function extractWebhookMoneyValues(
  payload: Record<string, unknown>,
  network: AffiliateNetwork,
  attributedOrderId?: string | null,
): ExtractedWebhookValues {
  const conversionId =
    attributedOrderId ||
    (payload.conversionId as string) ||
    (payload.order_id as string) ||
    (payload.orderId as string) ||
    `conv_${network}_${Math.random().toString(36).substring(2, 9)}`;

  let commissionCents = 0;
  if (typeof payload.commissionCents === 'number') {
    commissionCents = payload.commissionCents;
  } else if (typeof payload.commission_amount === 'number') {
    commissionCents = Math.round(payload.commission_amount * 100);
  } else if (typeof payload.commission === 'number') {
    commissionCents = Math.round(payload.commission * 100);
  } else if (typeof payload.commissionUsd === 'number') {
    commissionCents = Math.round(payload.commissionUsd * 100);
  }

  let orderValueCents = 0;
  if (typeof payload.orderValueCents === 'number') {
    orderValueCents = payload.orderValueCents;
  } else if (typeof payload.settlement_amount === 'number') {
    orderValueCents = Math.round(payload.settlement_amount * 100);
  } else if (typeof payload.revenue === 'number') {
    orderValueCents = Math.round(payload.revenue * 100);
  } else if (typeof payload.order_value === 'number') {
    orderValueCents = Math.round(payload.order_value * 100);
  } else if (typeof payload.sale_amount === 'number') {
    orderValueCents = Math.round(payload.sale_amount * 100);
  } else if (typeof payload.orderValueUsd === 'number') {
    orderValueCents = Math.round(payload.orderValueUsd * 100);
  }

  return { conversionId, commissionCents, orderValueCents };
}
