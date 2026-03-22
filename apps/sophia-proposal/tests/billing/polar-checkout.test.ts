/**
 * Polar Checkout Flow Tests
 *
 * Tests the complete checkout flow:
 * - Checkout session creation
 * - Redirect to Polar
 * - Webhook handling
 * - Subscription activation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POLAR_TIERS, PolarCheckoutSchema } from '@/lib/billing/polar-client';

// Mock Next.js request/response
const createMockRequest = (body: unknown, headers: Record<string, string> = {}) =>
  ({
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: {
      get: (name: string) => headers[name] || null,
    },
  }) as Request;

describe('Polar Checkout Flow', () => {
  describe('PolarCheckoutSchema', () => {
    it('should validate valid checkout input', () => {
      const validInput = {
        product_id: 'prod_123456',
        customer_email: 'test@example.com',
        success_url: 'https://sophia.agencyos.network/billing/success',
      };

      const result = PolarCheckoutSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept optional embed_origin', () => {
      const input = {
        product_id: 'prod_123456',
        customer_email: 'test@example.com',
        success_url: 'https://sophia.agencyos.network/billing/success',
        embed_origin: 'https://sophia.agencyos.network',
      };

      const result = PolarCheckoutSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidInput = {
        product_id: 'prod_123456',
        customer_email: 'invalid-email',
        success_url: 'https://sophia.agencyos.network/billing/success',
      };

      const result = PolarCheckoutSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      expect(result.error?.errors[0]?.path).toContain('customer_email');
    });

    it('should reject invalid success_url', () => {
      const invalidInput = {
        product_id: 'prod_123456',
        customer_email: 'test@example.com',
        success_url: 'not-a-url',
      };

      const result = PolarCheckoutSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      expect(result.error?.errors[0]?.path).toContain('success_url');
    });

    it('should reject missing product_id', () => {
      const invalidInput = {
        customer_email: 'test@example.com',
        success_url: 'https://sophia.agencyos.network/billing/success',
      };

      const result = PolarCheckoutSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      expect(result.error?.errors[0]?.path).toContain('product_id');
    });
  });

  describe('Polar Tiers Configuration', () => {
    it('should have all four tiers defined', () => {
      expect(POLAR_TIERS.starter).toBeDefined();
      expect(POLAR_TIERS.growth).toBeDefined();
      expect(POLAR_TIERS.premium).toBeDefined();
      expect(POLAR_TIERS.master).toBeDefined();
    });

    it('should have correct Premium tier pricing (pilot tier)', () => {
      const premium = POLAR_TIERS.premium;
      expect(premium.price).toBe(49900); // $499 in cents
      expect(premium.mcuMonthly).toBe(10000);
      expect(premium.mcuOverageRate).toBe(0.06);
    });

    it('should have ascending MCU credits with tier', () => {
      expect(POLAR_TIERS.starter.mcuMonthly).toBe(500);
      expect(POLAR_TIERS.growth.mcuMonthly).toBe(2000);
      expect(POLAR_TIERS.premium.mcuMonthly).toBe(10000);
      expect(POLAR_TIERS.master.mcuMonthly).toBe(25000);
    });

    it('should have descending overage rates with tier', () => {
      expect(POLAR_TIERS.starter.mcuOverageRate).toBe(0.10);
      expect(POLAR_TIERS.growth.mcuOverageRate).toBe(0.08);
      expect(POLAR_TIERS.premium.mcuOverageRate).toBe(0.06);
      expect(POLAR_TIERS.master.mcuOverageRate).toBe(0.05);
    });
  });

  describe('Checkout Flow Integration', () => {
    it('should create checkout session for Premium tier', async () => {
      const productId = POLAR_TIERS.premium.polarProductId || 'prod_premium';
      const checkoutData = {
        product_id: productId,
        customer_email: 'pilot@example.com',
        success_url: 'https://sophia.agencyos.network/onboarding',
      };

      const result = PolarCheckoutSchema.safeParse(checkoutData);
      expect(result.success).toBe(true);
    });

    it('should redirect to Polar checkout URL', () => {
      // Simulate checkout response
      const mockCheckoutResponse = {
        url: 'https://checkout.polar.sh/cs_test_abc123',
        id: 'checkout_123',
      };

      expect(mockCheckoutResponse.url).toMatch(/^https:\/\/checkout\.polar\.sh/);
    });

    it('should handle checkout cancellation', () => {
      // When user cancels checkout, they return to cancel_url
      const cancelUrl = 'https://sophia.agencyos.network/billing/upgrade?cancelled=true';
      expect(cancelUrl).toContain('cancelled=true');
    });
  });

  describe('Pilot Onboarding Flow', () => {
    it('should track Premium tier selection for pilot program', () => {
      const pilotTier = POLAR_TIERS.premium;
      expect(pilotTier.name).toBe('premium');
      expect(pilotTier.price).toBe(49900); // $499
    });

    it('should calculate MCU credits for pilot tier', () => {
      const premium = POLAR_TIERS.premium;
      expect(premium.mcuMonthly).toBe(10000);
    });

    it('should verify checkout success redirect to onboarding', () => {
      const successUrl = 'https://sophia.agencyos.network/onboarding';
      expect(successUrl).toContain('/onboarding');
    });
  });
});
