/**
 * E-Commerce Product-to-Video Engine — Barrel Export
 *
 * @module land/commerce
 */

export {
  mapShopifyProductToUnified,
  mapWooCommerceProductToUnified,
  buildProductVideoPrompt,
  stripHtml,
} from './catalog-mapper';

export {
  triggerProductVideoMission,
} from './mission-trigger';

export type {
  TriggerProductMissionInput,
  TriggerProductMissionResult,
} from './mission-trigger';

export type {
  CommercePlatform,
  ShopifyStoreConfig,
  WooCommerceStoreConfig,
  UnifiedProductItem,
  ProductVideoGenerationPrompt,
  CatalogSyncResult,
  CommerceClientError,
} from '@/seed/types/ecommerce';
