/**
 * Contract tests for /api/payments/one-time-checkout — NOWPayments one-time invoice schema.
 * Schema imported from route — skuId enum reflects live ONE_TIME_SKUS catalog.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { oneTimeCheckoutSchema } from '../route';

type CheckoutInput = z.infer<typeof oneTimeCheckoutSchema>;

describe('contract: api/payments/one-time-checkout', () => {
  describe('oneTimeCheckoutSchema', () => {
    const validMinimal: CheckoutInput = { skuId: 'STARTER_BUNDLE' };

    it('parses minimal valid body with only skuId', () => {
      const result = oneTimeCheckoutSchema.parse(validMinimal);
      expect(result.skuId).toBe('STARTER_BUNDLE');
      expect(result.userId).toBeUndefined();
    });

    it('parses full body with userId and customerEmail', () => {
      const result = oneTimeCheckoutSchema.parse({
        skuId: 'STARTER_BUNDLE',
        userId: 'user_abc',
        customerEmail: 'buyer@example.com',
      });
      expect(result.userId).toBe('user_abc');
      expect(result.customerEmail).toBe('buyer@example.com');
    });

    it('rejects unknown skuId — issues[0].path = ["skuId"]', () => {
      const result = oneTimeCheckoutSchema.safeParse({ skuId: 'UNKNOWN_BUNDLE' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('skuId');
      }
    });

    it('rejects malformed customerEmail — issues[0].path = ["customerEmail"]', () => {
      const result = oneTimeCheckoutSchema.safeParse({
        skuId: 'STARTER_BUNDLE',
        customerEmail: 'not-an-email',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('customerEmail');
      }
    });

    it('rejects missing skuId entirely', () => {
      const result = oneTimeCheckoutSchema.safeParse({ userId: 'user_x' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('skuId');
      }
    });

    it('inferred type matches expected shape (compile-time assertion)', () => {
      const body: CheckoutInput = validMinimal;
      expect(body.skuId).toBeDefined();
    });
  });
});
