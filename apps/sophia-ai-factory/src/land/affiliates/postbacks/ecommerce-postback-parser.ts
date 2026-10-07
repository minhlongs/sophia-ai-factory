/**
 * E-commerce Postback Parser
 *
 * Normalizes webhook payloads from TikTok Shop Affiliate and Shopee Open API
 * into NormalizedEcommercePostbackEvent schema.
 *
 * Layer: land/affiliates/postbacks (Business Workflow)
 * @module land/affiliates/postbacks/ecommerce-postback-parser
 */

import type {
  NormalizedEcommercePostbackEvent,
  EcommerceOrderStatus,
} from './ecommerce-postback-types';

export function parseTikTokShopWebhook(
  payload: Record<string, unknown>,
): NormalizedEcommercePostbackEvent {
  const data = (payload.data as Record<string, unknown>) || payload;
  const orderId = String(data.order_id || payload.order_id || `tt_${Date.now()}`);
  const rawStatus = String(data.order_status || payload.status || 'SETTLED').toUpperCase();

  let status: EcommerceOrderStatus = 'ORDER_PLACED';
  if (rawStatus.includes('SETTLE') || rawStatus.includes('COMPLETED')) {
    status = 'ORDER_SETTLED';
  } else if (rawStatus.includes('CANCEL')) {
    status = 'ORDER_CANCELLED';
  } else if (rawStatus.includes('REFUND') || rawStatus.includes('RETURN')) {
    status = 'ORDER_REFUNDED';
  }

  const commissionAmt = Number(data.estimated_commission || payload.commission || 0);
  const commissionCents = Math.round(commissionAmt * 100);
  const itemPriceAmt = Number(data.item_price || payload.price || 0);
  const itemPriceCents = Math.round(itemPriceAmt * 100);
  const now = Date.now();
  // 14 days clearance window for physical goods return policy
  const clearanceDaysMs = 14 * 24 * 60 * 60 * 1000;

  return {
    eventId: `tiktok_shop_${orderId}_${status.toLowerCase()}`,
    network: 'tiktok_shop',
    orderId,
    creatorId: String(data.creator_id || payload.creator_id || 'system'),
    campaignId: data.campaign_id ? String(data.campaign_id) : null,
    subId: data.sub_id ? String(data.sub_id) : null,
    productSku: String(data.product_sku || payload.sku || 'SKU_UNKNOWN'),
    productTitle: String(data.product_title || payload.title || 'TikTok Shop Product'),
    itemCount: Number(data.quantity || payload.quantity || 1),
    itemPriceCents,
    commissionCents,
    currency: String(data.currency || payload.currency || 'USD').toUpperCase(),
    status,
    clearanceDueMs: now + clearanceDaysMs,
    isClearanceMatured: false,
    timestampMs: now,
    rawPayload: payload,
  };
}

export function parseShopeeWebhook(
  payload: Record<string, unknown>,
): NormalizedEcommercePostbackEvent {
  const orderSn = String(payload.order_sn || payload.order_id || `shp_${Date.now()}`);
  const rawStatus = Number(payload.order_status ?? 3); // 3 = Completed/Settled in Shopee API

  let status: EcommerceOrderStatus = 'ORDER_PLACED';
  if (rawStatus === 3 || rawStatus === 4) {
    status = 'ORDER_SETTLED';
  } else if (rawStatus === 5) {
    status = 'ORDER_CANCELLED';
  } else if (rawStatus === 6) {
    status = 'ORDER_REFUNDED';
  }

  const commission = Number(payload.commission_amount || payload.commission || 0);
  const commissionCents = Math.round(commission * 100);
  const itemPrice = Number(payload.item_price || payload.amount || 0);
  const itemPriceCents = Math.round(itemPrice * 100);
  const now = Date.now();
  // 7 days return policy window for Shopee Mall/Standard
  const clearanceDaysMs = 7 * 24 * 60 * 60 * 1000;

  return {
    eventId: `shopee_${orderSn}_${status.toLowerCase()}`,
    network: 'shopee',
    orderId: orderSn,
    creatorId: String(payload.partner_id || payload.affiliate_id || 'system'),
    campaignId: payload.campaign_id ? String(payload.campaign_id) : null,
    subId: payload.sub_id ? String(payload.sub_id) : null,
    productSku: String(payload.item_id || payload.sku || 'SHOPEE_ITEM'),
    productTitle: String(payload.item_name || payload.title || 'Shopee Product'),
    itemCount: Number(payload.item_count || 1),
    itemPriceCents,
    commissionCents,
    currency: String(payload.currency || 'VND').toUpperCase(),
    status,
    clearanceDueMs: now + clearanceDaysMs,
    isClearanceMatured: false,
    timestampMs: now,
    rawPayload: payload,
  };
}
