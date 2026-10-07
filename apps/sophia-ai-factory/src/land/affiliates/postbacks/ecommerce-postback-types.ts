/**
 * E-commerce Affiliate Postback Types (TikTok Shop & Shopee)
 *
 * Defines contracts for real-time conversion ingestion from TikTok Shop Open API
 * and Shopee Affiliate Partner Network.
 *
 * Layer: land/affiliates/postbacks (Business Workflow)
 * @module land/affiliates/postbacks/ecommerce-postback-types
 */

export type EcommerceNetwork = 'tiktok_shop' | 'shopee';

export type EcommerceOrderStatus =
  | 'ORDER_PLACED'
  | 'ORDER_SETTLED'
  | 'ORDER_CANCELLED'
  | 'ORDER_REFUNDED';

export interface NormalizedEcommercePostbackEvent {
  eventId: string;
  network: EcommerceNetwork;
  orderId: string;
  creatorId: string;
  campaignId: string | null;
  subId: string | null;
  productSku: string;
  productTitle: string;
  itemCount: number;
  itemPriceCents: number;
  commissionCents: number;
  currency: string;
  status: EcommerceOrderStatus;
  clearanceDueMs: number;
  isClearanceMatured: boolean;
  timestampMs: number;
  rawPayload: Record<string, unknown>;
}

export interface EcommerceProcessingOutcome {
  success: boolean;
  eventId: string;
  network: EcommerceNetwork;
  commissionCents: number;
  status: EcommerceOrderStatus;
  isIdempotentDuplicate?: boolean;
  error?: string;
}
