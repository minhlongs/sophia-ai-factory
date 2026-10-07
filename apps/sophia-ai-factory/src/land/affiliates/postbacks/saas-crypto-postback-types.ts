/**
 * SaaS & Crypto Affiliate Postback Types
 *
 * Defines contracts for real-time conversion ingestion from PartnerStack,
 * Rewardful, Binance Link, and Bybit affiliate networks.
 *
 * Layer: land/affiliates/postbacks (Business Workflow)
 * @module land/affiliates/postbacks/saas-crypto-postback-types
 */

export type SaasCryptoNetwork = 'partnerstack' | 'rewardful' | 'binance' | 'bybit';

export type ConversionEventType =
  | 'subscription_created'
  | 'commission_approved'
  | 'trading_rebate'
  | 'signup_bonus'
  | 'refund';

export interface NormalizedPostbackEvent {
  eventId: string;
  network: SaasCryptoNetwork;
  externalTxnId: string;
  affiliateId: string;
  subId: string | null;
  campaignId: string | null;
  grossAmountCents: number;
  commissionCents: number;
  currency: string;
  eventType: ConversionEventType;
  isRecurring: boolean;
  timestampMs: number;
  rawPayload: Record<string, unknown>;
}

export interface PostbackProcessingOutcome {
  success: boolean;
  eventId: string;
  network: SaasCryptoNetwork;
  commissionCents: number;
  isIdempotentDuplicate?: boolean;
  error?: string;
}
