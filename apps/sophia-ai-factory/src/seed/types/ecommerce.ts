/**
 * E-Commerce Data Models and Schemas
 *
 * Types and schemas for Shopify, WooCommerce, and Unified Catalog items
 * supporting autonomous product-to-video creative missions.
 *
 * Layer: seed (foundational primitive, zero domain dependencies)
 * @module seed/types/ecommerce
 */

import { z } from 'zod';

export type CommercePlatform = 'shopify' | 'woocommerce';

export const shopifyStoreConfigSchema = z.object({
  shopDomain: z.string().min(1, 'Shop domain is required'),
  accessToken: z.string().min(1, 'Shopify access token is required'),
  apiVersion: z.string().default('2024-04'),
});

export type ShopifyStoreConfig = z.infer<typeof shopifyStoreConfigSchema>;

export const wooCommerceStoreConfigSchema = z.object({
  storeUrl: z.string().url('Valid store URL is required'),
  consumerKey: z.string().min(1, 'WooCommerce Consumer Key is required'),
  consumerSecret: z.string().min(1, 'WooCommerce Consumer Secret is required'),
  version: z.string().default('wc/v3'),
});

export type WooCommerceStoreConfig = z.infer<typeof wooCommerceStoreConfigSchema>;

export const unifiedProductItemSchema = z.object({
  id: z.string().min(1),
  platform: z.enum(['shopify', 'woocommerce']),
  title: z.string().min(1),
  description: z.string().default(''),
  vendor: z.string().optional(),
  productType: z.string().optional(),
  tags: z.array(z.string()).default([]),
  price: z.number().nonnegative().default(0),
  currency: z.string().default('USD'),
  images: z.array(z.string().url()).default([]),
  handle: z.string().optional(),
  url: z.string().url().optional(),
  status: z.enum(['active', 'draft', 'archived']).default('active'),
  rawMetadata: z.record(z.string(), z.unknown()).default({}),
});

export type UnifiedProductItem = z.infer<typeof unifiedProductItemSchema>;

export interface ProductVideoGenerationPrompt {
  productId: string;
  productTitle: string;
  headlineHook: string;
  sellingPoints: string[];
  callToAction: string;
  recommendedDurationSeconds: number;
  visualAssetUrls: string[];
  targetAudience: string;
  suggestedChannels: string[];
}

export interface CatalogSyncResult {
  platform: CommercePlatform;
  totalFetched: number;
  products: UnifiedProductItem[];
  errors: string[];
  syncedAt: number;
}

export interface CommerceClientError {
  kind: string;
  message: string;
  status?: number;
  retryAfterSeconds?: number;
}
