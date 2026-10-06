import { describe, it, expect } from 'vitest';
import * as ecommerceTree from '../index';

describe('tree/ecommerce barrel exports', () => {
  it('exports shopify and woocommerce clients', () => {
    expect(typeof ecommerceTree.fetchShopifyProducts).toBe('function');
    expect(typeof ecommerceTree.fetchWooCommerceProducts).toBe('function');
  });
});
