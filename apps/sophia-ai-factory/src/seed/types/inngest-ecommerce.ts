/**
 * Inngest E-Commerce and Affiliate Event Contracts
 *
 * Schemas and types for background catalog polling, product delta detection,
 * batch video mission dispatching, and affiliate conversion reconciliation.
 *
 * Layer: seed (foundational primitive, zero domain dependencies)
 * @module seed/types/inngest-ecommerce
 */

import { z } from 'zod';
import { unifiedProductItemSchema, type UnifiedProductItem } from './ecommerce';

export const commerceCatalogSyncRequestedSchema = z.object({
  syncId: z.string().min(1),
  workspaceId: z.string().min(1),
  platform: z.enum(['shopify', 'woocommerce']),
  storeHost: z.string().min(1),
  triggerSource: z.enum(['cron', 'webhook', 'manual']).default('cron'),
  limit: z.number().int().positive().optional(),
  query: z.string().optional(),
});

export type CommerceCatalogSyncRequestedData = z.infer<typeof commerceCatalogSyncRequestedSchema>;

export const commerceProductDeltaDetectedSchema = z.object({
  syncId: z.string().min(1),
  workspaceId: z.string().min(1),
  platform: z.enum(['shopify', 'woocommerce']),
  storeHost: z.string().min(1),
  productId: z.string().min(1),
  contentHash: z.string().min(8),
  product: unifiedProductItemSchema,
  autoRenderVideo: z.boolean().default(true),
});

export type CommerceProductDeltaDetectedData = z.infer<typeof commerceProductDeltaDetectedSchema>;

export const commerceVideoBatchDispatchSchema = z.object({
  batchId: z.string().min(1),
  workspaceId: z.string().min(1),
  storeHost: z.string().min(1),
  products: z.array(unifiedProductItemSchema),
  autonomyLevel: z.number().int().min(0).max(3).default(1),
  customChannels: z.array(z.string()).optional(),
});

export type CommerceVideoBatchDispatchData = z.infer<typeof commerceVideoBatchDispatchSchema>;

export const affiliateConversionReconciledSchema = z.object({
  reconciliationId: z.string().min(1),
  partnerId: z.string().min(1),
  commissionId: z.string().min(1),
  orderId: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  commissionCents: z.number().int().nonnegative(),
  provider: z.enum(['nowpayments', 'payos', 'direct']),
});

export type AffiliateConversionReconciledData = z.infer<typeof affiliateConversionReconciledSchema>;

export const affiliateConversionRecordedSchema = z.object({
  partnerCode: z.string().min(1),
  commissionCents: z.number().int().nonnegative(),
  paymentId: z.string().min(1),
  orderId: z.string().optional(),
  customerUserId: z.string().min(1),
});

export type AffiliateConversionRecordedData = z.infer<typeof affiliateConversionRecordedSchema>;

export type CommerceCatalogSyncEvent = {
  data: CommerceCatalogSyncRequestedData;
};

export type CommerceProductDeltaEvent = {
  data: CommerceProductDeltaDetectedData;
};

export type CommerceVideoBatchDispatchEvent = {
  data: CommerceVideoBatchDispatchData;
};

export type AffiliateConversionReconciledEvent = {
  data: AffiliateConversionReconciledData;
};

export type AffiliateConversionRecordedEvent = {
  data: AffiliateConversionRecordedData;
};
