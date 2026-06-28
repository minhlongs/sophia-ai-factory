/**
 * Contract tests for NOWPayments IPN payload schema.
 * Schema is exported from @/land/billing/ipn-payload-schema — no route.ts import.
 * Tests verify parse boundaries only; no HTTP handlers or side-effects.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ipnPayloadSchema } from '@/land/billing/ipn-payload-schema';

type IpnPayload = z.infer<typeof ipnPayloadSchema>;

describe('contract: api/webhooks/nowpayments', () => {
  describe('ipnPayloadSchema', () => {
    const validBase: IpnPayload = {
      payment_id: 'pay_abc123',
      payment_status: 'finished',
      price_amount: 49.99,
      price_currency: 'USD',
    };

    it('parses minimal valid payload', () => {
      const result = ipnPayloadSchema.parse(validBase);
      expect(result.payment_id).toBe('pay_abc123');
      expect(result.payment_status).toBe('finished');
    });

    it('parses full payload with all optional fields', () => {
      const full: IpnPayload = {
        ...validBase,
        pay_address: '0xabc',
        pay_amount: 0.02,
        pay_currency: 'ETH',
        order_id: 'order_user123_1',
        order_description: 'Sophia Growth Plan',
        invoice_id: 'ENTERPRISE',
        actually_paid: 0.02,
        outcome_amount: 49.99,
        outcome_currency: 'USD',
        customer_email: 'user@example.com',
      };
      const result = ipnPayloadSchema.parse(full);
      expect(result.order_id).toBe('order_user123_1');
      expect(result.invoice_id).toBe('ENTERPRISE');
    });

    it('rejects missing payment_id — issues[0].code = invalid_type', () => {
      const bad = { ...validBase, payment_id: undefined };
      const result = ipnPayloadSchema.safeParse(bad);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_type');
        expect(result.error.issues[0].path).toContain('payment_id');
      }
    });

    it('rejects invalid payment_status enum — issues[0].code = invalid_enum_value', () => {
      const bad = { ...validBase, payment_status: 'unknown_status' };
      const result = ipnPayloadSchema.safeParse(bad);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue.path).toContain('payment_status');
        // Zod 4 uses 'invalid_value' for enum failures (not 'invalid_enum_value')
        expect(issue.code).toBe('invalid_value');
      }
    });

    it('rejects negative price_amount — issues[0].path = ["price_amount"]', () => {
      const bad = { ...validBase, price_amount: -5 };
      const result = ipnPayloadSchema.safeParse(bad);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('price_amount');
      }
    });

    it('rejects invalid customer_email format', () => {
      const bad = { ...validBase, customer_email: 'not-an-email' };
      const result = ipnPayloadSchema.safeParse(bad);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('customer_email');
      }
    });

    it('inferred type matches expected shape (compile-time assertion)', () => {
      const payload: IpnPayload = validBase;
      expect(payload.payment_id).toBeDefined();
    });
  });
});
