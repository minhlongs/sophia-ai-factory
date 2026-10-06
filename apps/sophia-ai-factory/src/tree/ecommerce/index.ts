/**
 * Barrel exports for E-Commerce domain clients
 * Layer: tree (domain-specific reusable logic)
 * @module tree/ecommerce
 */

export {
  fetchShopifyProducts,
  type ShopifyProductNode,
} from './shopify-client';

export {
  fetchWooCommerceProducts,
  type WooCommerceProductPayload,
} from './woocommerce-client';
