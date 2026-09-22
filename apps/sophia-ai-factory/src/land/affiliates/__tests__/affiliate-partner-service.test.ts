import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generatePartnerCode,
  generateShareLink,
  calculatePartnerCommission,
  registerPartner,
  getPartnerByUserId,
  getPartnerByCode,
  recordPartnerClick,
  getPartnerStats,
} from '../affiliate-partner-service';
import * as dbClient from '@/seed/db/client';

describe('AffiliatePartnerService — Unit & Calculation Tests', () => {
  describe('generatePartnerCode', () => {
    it('generates standard SOPHIA_ prefix when no seed provided', () => {
      const code = generatePartnerCode();
      expect(code).toMatch(/^SOPHIA_[A-Z0-9]{6}$/);
    });

    it('generates code using sanitized uppercase seed', () => {
      const code = generatePartnerCode('my-affiliate-shop!');
      expect(code.startsWith('MYAFFILIATE')).toBe(true);
      expect(code.length).toBeGreaterThanOrEqual(10);
    });

    it('falls back to SOPHIA_ prefix when seed is too short after cleaning', () => {
      const code = generatePartnerCode('!!');
      expect(code).toMatch(/^SOPHIA_[A-Z0-9]{6}$/);
    });
  });

  describe('generateShareLink', () => {
    it('generates primary link with ref parameter', () => {
      const link = generateShareLink('SOPHIA88', {
        baseUrl: 'https://sophia.agencyos.network',
      });
      expect(link).toBe('https://sophia.agencyos.network/?ref=SOPHIA88');
    });

    it('appends sub_id when provided', () => {
      const link = generateShareLink('SOPHIA88', {
        baseUrl: 'https://sophia.agencyos.network',
        subId: 'tiktok_hook_1',
      });
      expect(link).toBe('https://sophia.agencyos.network/?ref=SOPHIA88&sub_id=tiktok_hook_1');
    });

    it('appends UTM tracking parameters correctly', () => {
      const link = generateShareLink('SOPHIA88', {
        baseUrl: 'https://sophia.agencyos.network',
        utmSource: 'youtube',
        utmCampaign: 'ai_automation',
        utmMedium: 'shorts_bio',
      });
      expect(link).toContain('ref=SOPHIA88');
      expect(link).toContain('utm_source=youtube');
      expect(link).toContain('utm_campaign=ai_automation');
      expect(link).toContain('utm_medium=shorts_bio');
    });

    it('strips trailing slash from baseUrl', () => {
      const link = generateShareLink('SOPHIA88', {
        baseUrl: 'https://sophia.agencyos.network/',
      });
      expect(link).toBe('https://sophia.agencyos.network/?ref=SOPHIA88');
    });
  });

  describe('calculatePartnerCommission', () => {
    it('returns zero commission when order amount is 0 or negative', () => {
      const res1 = calculatePartnerCommission({ orderAmountCents: 0, activeSalesCount: 10 });
      expect(res1.commissionCents).toBe(0);
      expect(res1.ratePct).toBe(0);

      const res2 = calculatePartnerCommission({ orderAmountCents: -500, activeSalesCount: 10 });
      expect(res2.commissionCents).toBe(0);
    });

    it('applies 20% default rate for standard partners (activeSalesCount <= 5)', () => {
      // Starter: $199 = 19,900 cents -> 20% = 3,980 cents ($39.80)
      const starter = calculatePartnerCommission({
        orderAmountCents: 19900,
        activeSalesCount: 3,
      });
      expect(starter.ratePct).toBe(20.0);
      expect(starter.commissionCents).toBe(3980);
      expect(starter.tier).toBe('STANDARD');
      expect(starter.isTier2).toBe(false);

      // Growth: $399 = 39,900 cents -> 20% = 7,980 cents ($79.80)
      const growth = calculatePartnerCommission({
        orderAmountCents: 39900,
        activeSalesCount: 5,
      });
      expect(growth.ratePct).toBe(20.0);
      expect(growth.commissionCents).toBe(7980);

      // Premium: $799 = 79,900 cents -> 20% = 15,980 cents ($159.80)
      const premium = calculatePartnerCommission({
        orderAmountCents: 79900,
        activeSalesCount: 0,
      });
      expect(premium.ratePct).toBe(20.0);
      expect(premium.commissionCents).toBe(15980);
    });

    it('escalates to 30% rate for high-volume partners (activeSalesCount > 5)', () => {
      // Starter: $199 = 19,900 cents -> 30% = 5,970 cents ($59.70)
      const starter = calculatePartnerCommission({
        orderAmountCents: 19900,
        activeSalesCount: 6,
      });
      expect(starter.ratePct).toBe(30.0);
      expect(starter.commissionCents).toBe(5970);
      expect(starter.tier).toBe('VIP');

      // Growth: $399 = 39,900 cents -> 30% = 11,970 cents ($119.70)
      const growth = calculatePartnerCommission({
        orderAmountCents: 39900,
        activeSalesCount: 12,
      });
      expect(growth.ratePct).toBe(30.0);
      expect(growth.commissionCents).toBe(11970);
      expect(growth.tier).toBe('VIP');

      // Super partner: >20 sales
      const superPartner = calculatePartnerCommission({
        orderAmountCents: 79900,
        activeSalesCount: 25,
      });
      expect(superPartner.ratePct).toBe(30.0);
      expect(superPartner.commissionCents).toBe(23970);
      expect(superPartner.tier).toBe('SUPER');
    });

    it('calculates 5% Tier 2 override correctly', () => {
      // Starter: $199 = 19,900 cents -> 5% = 995 cents ($9.95)
      const t2Starter = calculatePartnerCommission({
        orderAmountCents: 19900,
        activeSalesCount: 10,
        isTier2: true,
      });
      expect(t2Starter.ratePct).toBe(5.0);
      expect(t2Starter.commissionCents).toBe(995);
      expect(t2Starter.tier).toBe('TIER2');
      expect(t2Starter.isTier2).toBe(true);

      // Growth: $399 = 39,900 cents -> 5% = 1,995 cents ($19.95)
      const t2Growth = calculatePartnerCommission({
        orderAmountCents: 39900,
        activeSalesCount: 0,
        isTier2: true,
      });
      expect(t2Growth.ratePct).toBe(5.0);
      expect(t2Growth.commissionCents).toBe(1995);
    });

    it('respects customRatePct if higher than default tier rate', () => {
      const custom = calculatePartnerCommission({
        orderAmountCents: 10000,
        activeSalesCount: 2,
        customRatePct: 25.0,
      });
      expect(custom.ratePct).toBe(25.0);
      expect(custom.commissionCents).toBe(2500);
    });
  });

  describe('D1 Database Operations (register, get, click, stats)', () => {
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        prepare: vi.fn(),
      };
      vi.spyOn(dbClient, 'getD1').mockResolvedValue(mockDb);
    });

    it('registerPartner returns existing partner if already registered', async () => {
      const existingRow = {
        id: 'aff_123',
        user_id: 'user_1',
        partner_code: 'EXISTING_CODE',
        tier: 'STANDARD',
        commission_rate_pct: 20.0,
        tier2_rate_pct: 5.0,
        parent_partner_id: null,
        usdt_trc20_address_encrypted: null,
        status: 'active',
        total_earnings_cents: 1000,
        pending_payout_cents: 500,
        created_at: 1700000000000,
        updated_at: 1700000000000,
      };

      const stmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(existingRow),
        run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      };
      mockDb.prepare.mockReturnValue(stmt);

      const partner = await registerPartner({ userId: 'user_1' });
      expect(partner.id).toBe('aff_123');
      expect(partner.partnerCode).toBe('EXISTING_CODE');
      expect(partner.totalEarningsCents).toBe(1000);
    });

    it('getPartnerByCode returns null if code not found', async () => {
      const stmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      };
      mockDb.prepare.mockReturnValue(stmt);

      const partner = await getPartnerByCode('NON_EXISTENT');
      expect(partner).toBeNull();
    });

    it('recordPartnerClick rejects unknown partner codes', async () => {
      const stmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      };
      mockDb.prepare.mockReturnValue(stmt);

      const success = await recordPartnerClick({ partnerCode: 'UNKNOWN' });
      expect(success).toBe(false);
    });

    it('getPartnerStats aggregates clicks and ledger correctly', async () => {
      const partnerRow = {
        id: 'aff_abc',
        user_id: 'usr_xyz',
        partner_code: 'SUPER88',
        tier: 'VIP',
        commission_rate_pct: 30.0,
        tier2_rate_pct: 5.0,
        parent_partner_id: null,
        usdt_trc20_address_encrypted: null,
        status: 'active',
        total_earnings_cents: 50000,
        pending_payout_cents: 10000,
        created_at: 1700000000000,
        updated_at: 1700000000000,
      };

      const ledgerAggregate = {
        total_conversions: 8,
        total_earnings_cents: 50000,
        pending_payout_cents: 10000,
        available_payout_cents: 40000,
        lifetime_paid_cents: 25000,
      };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM affiliate_partners')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(partnerRow),
          };
        }
        if (sql.includes('SELECT COUNT(*) as count FROM affiliate_referral_clicks')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ count: 100 }),
          };
        }
        if (sql.includes('FROM commission_ledger')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(ledgerAggregate),
          };
        }
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
        };
      });

      const stats = await getPartnerStats('SUPER88');
      expect(stats).not.toBeNull();
      expect(stats?.totalClicks).toBe(100);
      expect(stats?.totalConversions).toBe(8);
      expect(stats?.conversionRatePct).toBe(8.0);
      expect(stats?.totalEarningsCents).toBe(50000);
      expect(stats?.pendingPayoutCents).toBe(10000);
      expect(stats?.availablePayoutCents).toBe(40000);
      expect(stats?.lifetimePaidCents).toBe(25000);
    });
  });
});
