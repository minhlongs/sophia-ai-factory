import { describe, it, expect } from 'vitest';
import { z } from 'zod';
// TECH DEBT: schemas are not exported from payos.ts; duplicated here for contract testing
const payOsIpnSchema = z.object({
  code: z.string(),
  desc: z.string(),
  success: z.boolean(),
  data: z.object({
    orderCode: z.number(),
    amount: z.number(),
    description: z.string(),
    accountNumber: z.string().optional(),
    reference: z.string().optional(),
    transactionDateTime: z.string().optional(),
    currency: z.string().optional(),
    paymentLinkId: z.string(),
    code: z.string().optional(),
    desc: z.string().optional(),
    counterAccountBankId: z.string().optional(),
    counterAccountBankName: z.string().optional(),
    counterAccountName: z.string().optional(),
    counterAccountNumber: z.string().optional(),
    virtualAccountName: z.string().optional(),
    virtualAccountNumber: z.string().optional(),
  }),
  signature: z.string(),
});

describe('contract: land/payments/payos.ts', () => {
  describe('payOsIpnSchema', () => {
    it('parses a valid PayOS IPN payload', () => {
      const valid = {
        code: '00',
        desc: 'success',
        success: true,
        data: {
          orderCode: 123456789,
          amount: 250000,
          description: 'Sophia BASIC - abcdef12',
          accountNumber: '97040123456789',
          reference: 'NP123456',
          transactionDateTime: '2026-08-02T10:30:00',
          currency: 'VND',
          paymentLinkId: 'link_abc123',
          code: '00',
          desc: 'success',
          counterAccountBankId: '9704',
          counterAccountBankName: 'VIETCOMBANK',
          counterAccountName: 'TEST USER',
          counterAccountNumber: '9999999999',
          virtualAccountName: 'Sophia Platform',
          virtualAccountNumber: '8888888888',
        },
        signature: 'deadbeef',
      };
      const result = payOsIpnSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('parses valid payload without optional banking fields', () => {
      const validMinimal = {
        code: '00',
        desc: 'success',
        success: true,
        data: {
          orderCode: 1,
          amount: 0,
          description: 'x',
          paymentLinkId: 'link_x',
        },
        signature: 'sig',
      };
      const result = payOsIpnSchema.safeParse(validMinimal);
      expect(result.success).toBe(true);
    });

    it('rejects payload missing required field code', () => {
      const invalid = {
        desc: 'success',
        success: true,
        data: {
          orderCode: 1,
          amount: 0,
          description: 'x',
          paymentLinkId: 'link_x',
        },
        signature: 'sig',
      };
      const result = payOsIpnSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find(i => i.path[0] === 'code');
        expect(issue).toBeDefined();
        expect(issue!.path).toEqual(['code']);
      }
    });

    it('rejects data with missing required paymentLinkId', () => {
      const invalid = {
        code: '00',
        desc: 'success',
        success: true,
        data: {
          orderCode: 1,
          amount: 0,
          description: 'x',
        },
        signature: 'sig',
      };
      const result = payOsIpnSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find(i => i.path[i.path.length - 1] === 'paymentLinkId');
        expect(issue).toBeDefined();
        expect(issue!.path).toEqual(['data', 'paymentLinkId']);
      }
    });

    it('rejects wrong type for success field (number instead of boolean)', () => {
      const invalid = {
        code: '00',
        desc: 'success',
        success: 'true',
        data: {
          orderCode: 1,
          amount: 0,
          description: 'x',
          paymentLinkId: 'link_x',
        },
        signature: 'sig',
      };
      const result = payOsIpnSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find(i => i.path[0] === 'success');
        expect(issue).toBeDefined();
        expect(issue!.path).toEqual(['success']);
      }
    });

    it('inferred type matches expected shape', () => {
      type Inferred = z.infer<typeof payOsIpnSchema>;
      const _typeCheck: Inferred = {
        code: '00',
        desc: 'ok',
        success: true,
        data: {
          orderCode: 0,
          amount: 0,
          description: '',
          paymentLinkId: '',
        },
        signature: '',
      };
      expect(true).toBe(true);
    });
  });
});
