import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTierFromProductName, getProductIdByTier, getPolarProducts, getPolarProductsSubscription, getPolarProductsMaster } from './polar-config';

describe('polar-config', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getPolarProductsSubscription', () => {
    it('returns 3 subscription products', () => {
      const products = getPolarProductsSubscription();
      expect(products).toHaveLength(3);
    });

    it('has correct tier assignments', () => {
      const products = getPolarProductsSubscription();
      expect(products[0].tier).toBe('BASIC');
      expect(products[1].tier).toBe('PREMIUM');
      expect(products[2].tier).toBe('ENTERPRISE');
    });

    it('all have subscription billing type', () => {
      const products = getPolarProductsSubscription();
      products.forEach(p => expect(p.billingType).toBe('subscription'));
    });

    it('has correct pricing (cents)', () => {
      const products = getPolarProductsSubscription();
      expect(products[0].prices[0].priceAmount).toBe(19900);  // $199
      expect(products[1].prices[0].priceAmount).toBe(39900);  // $399
      expect(products[2].prices[0].priceAmount).toBe(79900);  // $799
    });
  });

  describe('getPolarProductsMaster', () => {
    it('returns 1 master product', () => {
      const products = getPolarProductsMaster();
      expect(products).toHaveLength(1);
    });

    it('is one-time billing', () => {
      const products = getPolarProductsMaster();
      expect(products[0].billingType).toBe('one-time');
      expect(products[0].tier).toBe('MASTER');
    });

    it('has correct pricing ($4,999)', () => {
      const products = getPolarProductsMaster();
      expect(products[0].prices[0].priceAmount).toBe(499900);
    });
  });

  describe('getPolarProducts', () => {
    it('returns all 4 products', () => {
      expect(getPolarProducts()).toHaveLength(4);
    });
  });

  describe('getTierFromProductName', () => {
    it('matches exact product name (case-insensitive)', () => {
      expect(getTierFromProductName('sophia ai factory - starter')).toBe('BASIC');
      expect(getTierFromProductName('Sophia AI Factory - Starter')).toBe('BASIC');
    });

    it('matches Growth to PREMIUM', () => {
      expect(getTierFromProductName('Sophia AI Factory - Growth')).toBe('PREMIUM');
    });

    it('matches Premium to ENTERPRISE', () => {
      expect(getTierFromProductName('Sophia AI Factory - Premium')).toBe('ENTERPRISE');
    });

    it('matches Master to MASTER', () => {
      expect(getTierFromProductName('Sophia AI Factory - Master')).toBe('MASTER');
    });

    it('falls back to heuristic for unknown names with premium keyword', () => {
      expect(getTierFromProductName('Some Premium Plan')).toBe('ENTERPRISE');
    });

    it('falls back to heuristic for unknown names with growth keyword', () => {
      expect(getTierFromProductName('My Growth Package')).toBe('PREMIUM');
    });

    it('defaults to BASIC for completely unknown names', () => {
      expect(getTierFromProductName('Unknown Product XYZ')).toBe('BASIC');
    });
  });

  describe('getProductIdByTier', () => {
    it('returns undefined when env vars not set', () => {
      const result = getProductIdByTier('BASIC');
      expect(result === '' || result === undefined).toBe(true);
    });

    it('returns product ID for matching tier', () => {
      vi.stubEnv('POLAR_PRODUCT_ID_STARTER', 'prod_starter_123');
      const products = getPolarProducts();
      const starter = products.find(p => p.tier === 'BASIC');
      expect(starter?.productId).toBe('prod_starter_123');
    });
  });
});
