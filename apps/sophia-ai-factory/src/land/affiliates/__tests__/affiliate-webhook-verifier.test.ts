import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculatePayableTimestamp,
  verifyPostbackSignature,
  validateAntiFraudRules,
  processAffiliateCommissionWebhook,
  HOLD_PERIOD_DAYS,
  HOLD_PERIOD_MS,
} from '../affiliate-webhook-verifier';
import { generateAffiliateHmac } from '@/tree/affiliate/hmac-verifier';
import * as dbClient from '@/seed/db/client';

describe('AffiliateWebhookVerifier — Anti-Fraud & 14-Day Hold Tests', () => {
  describe('Hold Period Calculation', () => {
    it('enforces exactly 14 days in milliseconds', () => {
      expect(HOLD_PERIOD_DAYS).toBe(14);
      expect(HOLD_PERIOD_MS).toBe(14 * 86400 * 1000);
      expect(HOLD_PERIOD_MS).toBe(1209600000);

      const now = 1700000000000;
      const payableAt = calculatePayableTimestamp(now);
      expect(payableAt - now).toBe(HOLD_PERIOD_MS);
    });
  });

  describe('HMAC-SHA256 Signature Verification', () => {
    const secret = 'super_secret_affiliate_webhook_key_2026';
    const payload = JSON.stringify({
      conversionEventId: 'conv_123',
      partnerCode: 'TOPCREATOR',
      orderAmountCents: 19900,
    });

    it('verifies genuine HMAC-SHA256 signature', async () => {
      const validSig = await generateAffiliateHmac(payload, secret, 'SHA-256');
      const isValid = await verifyPostbackSignature({
        rawBody: payload,
        signature: validSig,
        secret,
        algorithm: 'SHA-256',
      });
      expect(isValid).toBe(true);
    });

    it('verifies signature with sha256= prefix', async () => {
      const validSig = await generateAffiliateHmac(payload, secret, 'SHA-256');
      const isValid = await verifyPostbackSignature({
        rawBody: payload,
        signature: `sha256=${validSig}`,
        secret,
      });
      expect(isValid).toBe(true);
    });

    it('rejects tampered payload', async () => {
      const validSig = await generateAffiliateHmac(payload, secret, 'SHA-256');
      const tamperedPayload = payload.replace('19900', '99900');
      const isValid = await verifyPostbackSignature({
        rawBody: tamperedPayload,
        signature: validSig,
        secret,
      });
      expect(isValid).toBe(false);
    });

    it('rejects wrong secret or empty signature', async () => {
      const validSig = await generateAffiliateHmac(payload, secret, 'SHA-256');
      const isValid = await verifyPostbackSignature({
        rawBody: payload,
        signature: validSig,
        secret: 'wrong_secret',
      });
      expect(isValid).toBe(false);

      const emptyCheck = await verifyPostbackSignature({
        rawBody: payload,
        signature: '',
        secret,
      });
      expect(emptyCheck).toBe(false);
    });
  });

  describe('validateAntiFraudRules', () => {
    it('blocks self-referral when partnerUserId matches buyerUserId', () => {
      const result = validateAntiFraudRules({
        partnerUserId: 'usr_creator_88',
        buyerUserId: 'usr_creator_88',
        orderAmountCents: 39900,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('SELF_REFERRAL_DETECTED');
    });

    it('blocks self-referral when partnerEmail matches buyerEmail (case-insensitive)', () => {
      const result = validateAntiFraudRules({
        partnerUserId: 'usr_1',
        buyerUserId: 'usr_2',
        partnerEmail: 'Creator@Example.com',
        buyerEmail: 'creator@example.com',
        orderAmountCents: 39900,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('SELF_REFERRAL_DETECTED');
    });

    it('blocks non-positive order amounts', () => {
      const zeroCheck = validateAntiFraudRules({
        partnerUserId: 'usr_1',
        buyerUserId: 'usr_2',
        orderAmountCents: 0,
      });
      expect(zeroCheck.allowed).toBe(false);
      expect(zeroCheck.reason).toContain('INVALID_ORDER_AMOUNT');

      const negativeCheck = validateAntiFraudRules({
        partnerUserId: 'usr_1',
        buyerUserId: 'usr_2',
        orderAmountCents: -500,
      });
      expect(negativeCheck.allowed).toBe(false);

      const nanCheck = validateAntiFraudRules({
        partnerUserId: 'usr_1',
        buyerUserId: 'usr_2',
        orderAmountCents: Number.NaN,
      });
      expect(nanCheck.allowed).toBe(false);
      expect(nanCheck.reason).toContain('INVALID_ORDER_AMOUNT');
    });

    it('allows valid referral purchase from different user', () => {
      const result = validateAntiFraudRules({
        partnerUserId: 'partner_123',
        buyerUserId: 'buyer_456',
        partnerEmail: 'partner@domain.com',
        buyerEmail: 'customer@other.com',
        orderAmountCents: 39900,
      });
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('processAffiliateCommissionWebhook (Multi-Tier & 14-Day Hold Ledgering)', () => {
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        prepare: vi.fn(),
      };
      vi.spyOn(dbClient, 'getD1').mockResolvedValue(mockDb);
    });

    it('rejects on invalid HMAC signature when verification options provided', async () => {
      const res = await processAffiliateCommissionWebhook(
        {
          conversionEventId: 'evt_1',
          partnerCode: 'SOPHIA_TEST',
          orderAmountCents: 19900,
        },
        {
          rawBody: '{"tampered":true}',
          signature: 'bad_sig',
          secret: 'test_secret',
        }
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe('INVALID_SIGNATURE');
    });

    it('rejects if partner code does not exist in database', async () => {
      const stmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      };
      mockDb.prepare.mockReturnValue(stmt);

      const res = await processAffiliateCommissionWebhook({
        conversionEventId: 'evt_2',
        partnerCode: 'NOT_FOUND_CODE',
        orderAmountCents: 19900,
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('PARTNER_NOT_FOUND');
    });

    it('successfully ledgers Tier 1 commission with exact 14-day hold and updates partner balance', async () => {
      const partnerRow = {
        id: 'aff_partner_1',
        user_id: 'usr_p1',
        partner_code: 'TOPLEAD',
        tier: 'STANDARD',
        commission_rate_pct: 20.0,
        tier2_rate_pct: 5.0,
        parent_partner_id: null,
        status: 'active',
        total_earnings_cents: 0,
        pending_payout_cents: 0,
      };

      const now = 1710000000000;
      const expectedPayableAt = now + 14 * 86400 * 1000;

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM commission_ledger WHERE conversion_event_id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null),
          };
        }
        if (sql.includes('SELECT * FROM affiliate_partners WHERE partner_code = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(partnerRow),
          };
        }
        if (sql.includes('SELECT COUNT(*) as count FROM commission_ledger')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ count: 2 }), // standard tier
          };
        }
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        };
      });

      const res = await processAffiliateCommissionWebhook({
        conversionEventId: 'conv_starter_order',
        partnerCode: 'TOPLEAD',
        orderAmountCents: 19900, // $199.00 -> 20% = $39.80 = 3,980 cents
        buyerUserId: 'usr_customer_1',
        timestamp: now,
      });

      expect(res.success).toBe(true);
      expect(res.entries).toHaveLength(1);

      const entry = res.entries![0];
      expect(entry.affiliateId).toBe('aff_partner_1');
      expect(entry.ratePct).toBe(20.0);
      expect(entry.commissionCents).toBe(3980);
      expect(entry.payableAt).toBe(expectedPayableAt);
      expect(entry.status).toBe('pending');
      expect(entry.isTier2).toBe(false);
    });

    it('creates both Tier 1 and Tier 2 override entries when parent partner exists', async () => {
      const childPartnerRow = {
        id: 'aff_child_1',
        user_id: 'usr_c1',
        partner_code: 'SUB_PARTNER',
        tier: 'VIP',
        commission_rate_pct: 30.0,
        tier2_rate_pct: 5.0,
        parent_partner_id: 'aff_parent_mentor',
        status: 'active',
      };

      const parentPartnerRow = {
        id: 'aff_parent_mentor',
        user_id: 'usr_parent_mentor',
        partner_code: 'MASTER_MENTOR',
        tier: 'SUPER',
        commission_rate_pct: 30.0,
        tier2_rate_pct: 5.0,
        parent_partner_id: null,
        status: 'active',
      };

      const now = 1710000000000;

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM commission_ledger WHERE conversion_event_id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null),
          };
        }
        if (sql.includes('WHERE partner_code = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(childPartnerRow),
          };
        }
        if (sql.includes('SELECT') && sql.includes('WHERE id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(parentPartnerRow),
          };
        }
        if (sql.includes('SELECT COUNT(*) as count FROM commission_ledger')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ count: 10 }), // VIP 30%
          };
        }
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        };
      });

      const res = await processAffiliateCommissionWebhook({
        conversionEventId: 'conv_growth_plan',
        partnerCode: 'SUB_PARTNER',
        orderAmountCents: 39900, // $399.00: 30% Tier 1 = 11,970 cents, 5% Tier 2 = 1,995 cents
        buyerUserId: 'usr_buyer_real',
        timestamp: now,
      });

      expect(res.success).toBe(true);
      expect(res.entries).toHaveLength(2);

      const t1Entry = res.entries!.find((e) => !e.isTier2);
      expect(t1Entry).toBeDefined();
      expect(t1Entry?.affiliateId).toBe('aff_child_1');
      expect(t1Entry?.ratePct).toBe(30.0);
      expect(t1Entry?.commissionCents).toBe(11970);
      expect(t1Entry?.payableAt).toBe(now + 14 * 86400 * 1000);

      const t2Entry = res.entries!.find((e) => e.isTier2);
      expect(t2Entry).toBeDefined();
      expect(t2Entry?.affiliateId).toBe('aff_parent_mentor');
      expect(t2Entry?.ratePct).toBe(5.0);
      expect(t2Entry?.commissionCents).toBe(1995);
      expect(t2Entry?.tier).toBe('TIER2');
      expect(t2Entry?.payableAt).toBe(now + 14 * 86400 * 1000);
    });

    it('handles duplicate conversion event idempotently without re-crediting', async () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM commission_ledger WHERE conversion_event_id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ id: 'existing_ledger_entry_123' }),
          };
        }
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
        };
      });

      const res = await processAffiliateCommissionWebhook({
        conversionEventId: 'conv_repeat_123',
        partnerCode: 'TOPLEAD',
        orderAmountCents: 19900,
      });

      expect(res.success).toBe(true);
      expect(res.entries).toHaveLength(0);
    });
  });
});
