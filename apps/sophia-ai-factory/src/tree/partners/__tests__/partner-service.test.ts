import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import {
  calculateCommissionCents,
  determinePartnerTier,
  calculateNextTierProgress,
  isWithinAttributionWindow,
  generateReferralCode,
  generateDnsTxtVerificationToken,
  resolveWhitelabelTheme,
  registerPartner,
  getPartnerByUserId,
  getPartnerById,
  getPartnerByReferralCode,
  evaluatePartnerTierPromotion,
  accruePartnerCommission,
  upsertWhitelabelConfig,
  getWhitelabelConfigByPartnerId,
  verifyCustomDomainDns,
  resolveWhitelabelByDomain,
  requestCommissionPayout,
  requestPartnerPayout,
  getPartnerDashboardData,
  validateHexColor,
  sanitizeUrlForCss,
  queryDnsTxtRecords,
} from '../partner-service';
import type { D1Database } from '@cloudflare/workers-types';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

function createTestDb(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS partner_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      tenant_id TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      partner_type TEXT NOT NULL CHECK(partner_type IN ('agency', 'reseller', 'affiliate', 'integrator')),
      tier TEXT NOT NULL DEFAULT 'SILVER' CHECK(tier IN ('SILVER', 'GOLD', 'PLATINUM')),
      commission_rate_pct REAL NOT NULL DEFAULT 20.0,
      referral_code TEXT NOT NULL UNIQUE,
      custom_domain TEXT UNIQUE,
      whitelabel_enabled INTEGER NOT NULL DEFAULT 0,
      total_referred_customers INTEGER NOT NULL DEFAULT 0,
      total_mrr_cents INTEGER NOT NULL DEFAULT 0,
      total_earnings_cents INTEGER NOT NULL DEFAULT 0,
      pending_payout_cents INTEGER NOT NULL DEFAULT 0,
      payout_rail TEXT DEFAULT 'USDT' CHECK(payout_rail IN ('USDT', 'VIETQR', 'BANK_WIRE')),
      payout_destination_json TEXT DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'pending_approval')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partner_commissions (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      referred_user_id TEXT NOT NULL,
      referred_tenant_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      mrr_cents INTEGER NOT NULL,
      commission_rate_pct REAL NOT NULL,
      commission_cents INTEGER NOT NULL,
      tier_at_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'paid', 'clawed_back')),
      payout_batch_id TEXT,
      period_start INTEGER,
      period_end INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES partner_profiles(id),
      UNIQUE(partner_id, order_id)
    );

    CREATE TABLE IF NOT EXISTS partner_whitelabel_configs (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL UNIQUE,
      brand_name TEXT NOT NULL,
      logo_url TEXT,
      favicon_url TEXT,
      primary_color TEXT DEFAULT '#06b6d4',
      accent_color TEXT DEFAULT '#3b82f6',
      custom_domain TEXT UNIQUE,
      custom_email_sender TEXT,
      support_url TEXT,
      footer_html TEXT,
      is_ssl_active INTEGER NOT NULL DEFAULT 0,
      dns_txt_verification_token TEXT,
      dns_verified_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES partner_profiles(id)
    );
  `);

  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T>() => stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0) } };
            },
            all: async <T>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0 } };
            },
          };
        },
        first: async <T>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0) } };
        },
        all: async <T>() => {
          return { results: stmt.all() as T[], meta: { changes: 0 } };
        },
      };
    },
  } as unknown as D1Database;
}

describe('Partner Service - Commission Math & Zero Penny Leakage', () => {
  it('calculates pure integer cent commission with zero penny leakage', () => {
    // Basic $199.00 (19900 cents) at 20%
    expect(calculateCommissionCents(19900, 20.0)).toBe(3980);

    // Premium $399.00 (39900 cents) at 28%
    expect(calculateCommissionCents(39900, 28.0)).toBe(11172);

    // Enterprise $799.00 (79900 cents) at 35%
    expect(calculateCommissionCents(79900, 35.0)).toBe(27965);

    // Fractional cents test: 19999 cents * 20% = 3999.8 -> 3999 cents integer floor
    expect(calculateCommissionCents(19999, 20.0)).toBe(3999);

    // Zero or negative handling
    expect(calculateCommissionCents(0, 20.0)).toBe(0);
    expect(calculateCommissionCents(-5000, 20.0)).toBe(0);
    expect(calculateCommissionCents(10000, 0)).toBe(0);
    expect(calculateCommissionCents(10000, -10)).toBe(0);
  });
});

describe('Partner Service - Tier Qualification & Promotion', () => {
  it('determines SILVER tier for baseline partner', () => {
    const res = determinePartnerTier(0, 0);
    expect(res.tier).toBe('SILVER');
    expect(res.commissionRatePct).toBe(20.0);
    expect(res.whitelabelEnabled).toBe(false);
  });

  it('promotes to GOLD tier on 10 referrals or $5,000 MRR', () => {
    // 10 customers but low MRR
    const byCust = determinePartnerTier(10, 100_000);
    expect(byCust.tier).toBe('GOLD');
    expect(byCust.commissionRatePct).toBe(28.0);
    expect(byCust.whitelabelEnabled).toBe(false);

    // 5 customers but >= $5,000 MRR (500,000 cents)
    const byMrr = determinePartnerTier(5, 500_000);
    expect(byMrr.tier).toBe('GOLD');
    expect(byMrr.commissionRatePct).toBe(28.0);
    expect(byMrr.whitelabelEnabled).toBe(false);
  });

  it('promotes to PLATINUM tier on 30 referrals or $20,000 MRR and enables whitelabel', () => {
    // 30 customers
    const byCust = determinePartnerTier(30, 200_000);
    expect(byCust.tier).toBe('PLATINUM');
    expect(byCust.commissionRatePct).toBe(35.0);
    expect(byCust.whitelabelEnabled).toBe(true);

    // >= $20,000 MRR (2,000,000 cents)
    const byMrr = determinePartnerTier(15, 2_000_000);
    expect(byMrr.tier).toBe('PLATINUM');
    expect(byMrr.commissionRatePct).toBe(35.0);
    expect(byMrr.whitelabelEnabled).toBe(true);
  });

  it('calculates next tier progress correctly', () => {
    // Silver to Gold: needs 10 customers or 500,000 cents
    const p1 = calculateNextTierProgress('SILVER', 5, 200_000);
    expect(p1.targetTier).toBe('GOLD');
    expect(p1.customersRemaining).toBe(5);
    expect(p1.mrrRemainingCents).toBe(300_000);
    expect(p1.progressPct).toBe(50);

    // Gold to Platinum: needs 30 customers or 2,000,000 cents
    const p2 = calculateNextTierProgress('GOLD', 15, 1_500_000);
    expect(p2.targetTier).toBe('PLATINUM');
    expect(p2.customersRemaining).toBe(15);
    expect(p2.mrrRemainingCents).toBe(500_000);
    expect(p2.progressPct).toBe(75);

    // Platinum maxed out
    const p3 = calculateNextTierProgress('PLATINUM', 50, 5_000_000);
    expect(p3.targetTier).toBeNull();
    expect(p3.progressPct).toBe(100);
  });
});

describe('Partner Service - Attribution Window & Referral Code', () => {
  it('validates 90-day referral attribution window', () => {
    const baseTime = 1700000000000;
    const day45 = baseTime + 45 * 86_400 * 1000;
    const day89 = baseTime + 89 * 86_400 * 1000;
    const day91 = baseTime + 91 * 86_400 * 1000;

    expect(isWithinAttributionWindow(baseTime, day45)).toBe(true);
    expect(isWithinAttributionWindow(baseTime, day89)).toBe(true);
    expect(isWithinAttributionWindow(baseTime, day91)).toBe(false);
    expect(isWithinAttributionWindow(baseTime, baseTime - 1000)).toBe(false);
  });

  it('generates clean referral code with partner prefix', () => {
    const code = generateReferralCode('Alpha Marketing Agency');
    expect(code).toMatch(/^ALPHA-[A-Z0-9]{6}$/);
  });
});

describe('Partner Service - White-Label Theme & DNS Verification', () => {
  it('resolves CSS custom properties with fallback defaults', () => {
    const themeDefault = resolveWhitelabelTheme(null);
    expect(themeDefault.brandPrimary).toBe('#06b6d4');
    expect(themeDefault.brandAccent).toBe('#3b82f6');
    expect(themeDefault.customCssProperties['--brand-primary']).toBe('#06b6d4');

    const themeCustom = resolveWhitelabelTheme({
      primary_color: '#ff0055',
      accent_color: '#00ffcc',
      logo_url: 'https://cdn.partner.com/logo.png',
      brand_name: 'Nexus Media',
    });
    expect(themeCustom.brandPrimary).toBe('#ff0055');
    expect(themeCustom.brandAgencyName).toBe('Nexus Media');
    expect(themeCustom.customCssProperties['--brand-logo-url']).toBe('url("https://cdn.partner.com/logo.png")');
  });

  it('sanitizes malicious CSS injection and url() breakouts in white-label theme', () => {
    // 1. Hex color validation
    expect(validateHexColor('#123456', '#06b6d4')).toBe('#123456');
    expect(validateHexColor('#ABCDEF', '#06b6d4')).toBe('#ABCDEF');
    // Invalid formats fall back safely
    expect(validateHexColor('#fff', '#06b6d4')).toBe('#06b6d4'); // 3-digit rejected
    expect(validateHexColor('#12345678', '#06b6d4')).toBe('#06b6d4'); // 8-digit rejected
    expect(validateHexColor('red', '#06b6d4')).toBe('#06b6d4'); // named color rejected
    expect(validateHexColor('#06b6d4; } body { display:none } /*', '#06b6d4')).toBe('#06b6d4'); // injection rejected

    // 2. URL sanitization
    expect(sanitizeUrlForCss('https://example.com/logo.png')).toBe('https://example.com/logo.png');
    expect(sanitizeUrlForCss('/assets/logo.png')).toBe('/assets/logo.png');
    expect(sanitizeUrlForCss('https://attacker.com/logo.png"); background: url("leak')).toBe('');
    expect(sanitizeUrlForCss('javascript:alert(1)')).toBe('');
    expect(sanitizeUrlForCss('vbscript:msgbox(1)')).toBe('');

    // 3. Theme resolution integration
    const themeMalicious = resolveWhitelabelTheme({
      primary_color: '#06b6d4; } body { display: none } /*',
      accent_color: 'expression(alert(1))',
      logo_url: 'https://attacker.com/logo.png"); background-image: url("https://attacker.com/leak',
      support_url: 'javascript:alert("pwned")',
    });

    expect(themeMalicious.customCssProperties['--brand-primary']).toBe('#06b6d4');
    expect(themeMalicious.customCssProperties['--brand-accent']).toBe('#3b82f6');
    expect(themeMalicious.customCssProperties['--brand-primary']).not.toContain('display');
    expect(themeMalicious.customCssProperties['--brand-logo-url']).toBe('none');
    expect(themeMalicious.customCssProperties['--brand-support-url']).toBe('');
  });

  it('generates DNS TXT verification token with prefix', () => {
    const token = generateDnsTxtVerificationToken('ptn_12345', 'app.partner.com');
    expect(token).toMatch(/^sophia-verify=[0-9a-f]{8}[0-9a-f]{8}$/);
  });
});

describe('Partner Service - D1 Database Operations & Workflows', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('registers a partner and handles idempotency on user_id', async () => {
    const partner = await registerPartner(db, {
      userId: 'user_001',
      tenantId: 'tenant_001',
      partnerName: 'Apex Growth Agency',
      partnerType: 'agency',
    });

    expect(partner.id).toMatch(/^ptn_/);
    expect(partner.partner_name).toBe('Apex Growth Agency');
    expect(partner.tier).toBe('SILVER');
    expect(partner.commission_rate_pct).toBe(20.0);
    expect(partner.referral_code).toBeDefined();

    // Idempotent re-registration returns same partner
    const reRegister = await registerPartner(db, {
      userId: 'user_001',
      tenantId: 'tenant_001',
      partnerName: 'Apex Growth Agency Modified',
    });
    expect(reRegister.id).toBe(partner.id);
  });

  it('enforces anti-self-referral check: rejects if customer is the partner', async () => {
    const partner = await registerPartner(db, {
      userId: 'user_self_ref',
      tenantId: 'tenant_self_ref',
      partnerName: 'Solo Partner',
    });

    const result = await accruePartnerCommission(db, {
      partnerId: partner.id,
      referredUserId: 'user_self_ref', // Same as partner user_id!
      referredTenantId: 'tenant_customer',
      orderId: 'ord_self_1',
      mrrCents: 19900,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('SELF_REFERRAL_PROHIBITED');
  });

  it('enforces 90-day referral attribution window in commission accrual', async () => {
    const partner = await registerPartner(db, {
      userId: 'user_partner_att',
      tenantId: 'tenant_partner_att',
      partnerName: 'Attribution Partner',
    });

    const now = Date.now();
    const expiredAttributionTime = now - 95 * 86_400 * 1000;

    const result = await accruePartnerCommission(db, {
      partnerId: partner.id,
      referredUserId: 'user_customer_att',
      referredTenantId: 'tenant_customer_att',
      orderId: 'ord_expired_1',
      mrrCents: 19900,
      referredAtMs: expiredAttributionTime,
    }, now);

    expect(result.success).toBe(false);
    expect(result.error).toContain('ATTRIBUTION_WINDOW_EXPIRED');
  });

  it('accrues commission, promotes partner tier automatically, and is idempotent', async () => {
    const partner = await registerPartner(db, {
      userId: 'user_agency_pro',
      tenantId: 'tenant_agency_pro',
      partnerName: 'Velocity Media',
    });

    expect(partner.tier).toBe('SILVER');
    expect(partner.commission_rate_pct).toBe(20.0);

    // Order 1: $199 plan (19900 cents) -> $39.80 commission (3980 cents)
    const comm1 = await accruePartnerCommission(db, {
      partnerId: partner.id,
      referredUserId: 'user_cust_1',
      referredTenantId: 'tenant_cust_1',
      orderId: 'ord_001',
      mrrCents: 19900,
      isNewCustomer: true,
    });

    expect(comm1.success).toBe(true);
    expect(comm1.commissionCents).toBe(3980);
    expect(comm1.commissionRatePct).toBe(20.0);
    expect(comm1.tierAtTime).toBe('SILVER');
    expect(comm1.duplicate).toBeUndefined();

    // Idempotent call on same order
    const comm1Dup = await accruePartnerCommission(db, {
      partnerId: partner.id,
      referredUserId: 'user_cust_1',
      referredTenantId: 'tenant_cust_1',
      orderId: 'ord_001',
      mrrCents: 19900,
    });
    expect(comm1Dup.success).toBe(true);
    expect(comm1Dup.duplicate).toBe(true);
    expect(comm1Dup.commissionCents).toBe(3980);

    // Promote to GOLD by adding $5,000 MRR (500,000 cents)
    const comm2 = await accruePartnerCommission(db, {
      partnerId: partner.id,
      referredUserId: 'user_cust_2',
      referredTenantId: 'tenant_cust_2',
      orderId: 'ord_002',
      mrrCents: 500_000,
      isNewCustomer: true,
    });

    expect(comm2.success).toBe(true);
    expect(comm2.tierPromoted).toBe(true);
    expect(comm2.newTier).toBe('GOLD');

    const updatedProfile = await getPartnerById(db, partner.id);
    expect(updatedProfile?.tier).toBe('GOLD');
    expect(updatedProfile?.commission_rate_pct).toBe(28.0);
    expect(updatedProfile?.total_referred_customers).toBe(2);

    // Next commission now computes at GOLD 28% rate:
    // $1,000 (100000 cents) * 28% = 28000 cents
    const comm3 = await accruePartnerCommission(db, {
      partnerId: partner.id,
      referredUserId: 'user_cust_3',
      referredTenantId: 'tenant_cust_3',
      orderId: 'ord_003',
      mrrCents: 100_000,
      isNewCustomer: true,
    });
    expect(comm3.success).toBe(true);
    expect(comm3.commissionRatePct).toBe(28.0);
    expect(comm3.commissionCents).toBe(28000);

    // Promote to PLATINUM by reaching $20,000 MRR
    const comm4 = await accruePartnerCommission(db, {
      partnerId: partner.id,
      referredUserId: 'user_cust_4',
      referredTenantId: 'tenant_cust_4',
      orderId: 'ord_004',
      mrrCents: 1_500_000,
      isNewCustomer: true,
    });
    expect(comm4.success).toBe(true);
    expect(comm4.tierPromoted).toBe(true);
    expect(comm4.newTier).toBe('PLATINUM');

    const platinumProfile = await getPartnerById(db, partner.id);
    expect(platinumProfile?.tier).toBe('PLATINUM');
    expect(platinumProfile?.commission_rate_pct).toBe(35.0);
    expect(platinumProfile?.whitelabel_enabled).toBe(1);
  });

  it('restricts white-label config to PLATINUM tier and verifies custom domain DNS', async () => {
    const partner = await registerPartner(db, {
      userId: 'user_wl_tester',
      tenantId: 'tenant_wl_tester',
      partnerName: 'WhiteLabel Agency',
    });

    // Attempting white-label config on SILVER should fail
    await expect(
      upsertWhitelabelConfig(db, {
        partnerId: partner.id,
        brandName: 'Branded Agency AI',
      }),
    ).rejects.toThrow('WHITELABEL_NOT_PERMITTED');

    // Upgrade partner to PLATINUM
    await db
      .prepare("UPDATE partner_profiles SET tier = 'PLATINUM', whitelabel_enabled = 1 WHERE id = ?1")
      .bind(partner.id)
      .run();

    // Now configuring white-label succeeds
    const wlConfig = await upsertWhitelabelConfig(db, {
      partnerId: partner.id,
      brandName: 'Branded Agency AI',
      primaryColor: '#8b5cf6',
      accentColor: '#ec4899',
      customDomain: 'ai.brandedagency.com',
      logoUrl: 'https://brandedagency.com/logo.svg',
    });

    expect(wlConfig.id).toMatch(/^wlc_/);
    expect(wlConfig.brand_name).toBe('Branded Agency AI');
    expect(wlConfig.custom_domain).toBe('ai.brandedagency.com');
    expect(wlConfig.dns_txt_verification_token).toMatch(/^sophia-verify=/);
    expect(wlConfig.is_ssl_active).toBe(0);

    // Verify DNS TXT record
    const dnsResult = await verifyCustomDomainDns(
      db,
      partner.id,
      'ai.brandedagency.com',
      async (_domain, _expectedToken) => true,
    );
    expect(dnsResult.verified).toBe(true);

    // Check active white-label domain resolution
    const resolved = await resolveWhitelabelByDomain(db, 'ai.brandedagency.com');
    expect(resolved).not.toBeNull();
    expect(resolved?.theme.brandPrimary).toBe('#8b5cf6');
    expect(resolved?.theme.brandAgencyName).toBe('Branded Agency AI');
    expect(resolved?.theme.customCssProperties['--brand-accent']).toBe('#ec4899');
  });

  it('handles commission payout requests with minimum $50 check and balance deduction', async () => {
    const partner = await registerPartner(db, {
      userId: 'user_payout_tester',
      tenantId: 'tenant_payout_tester',
      partnerName: 'Payout Agency',
    });

    // Credit $100 (10,000 cents) pending payout
    await db
      .prepare('UPDATE partner_profiles SET pending_payout_cents = 10000 WHERE id = ?1')
      .bind(partner.id)
      .run();

    // Request below $50 threshold (4000 cents) fails
    const lowReq = await requestCommissionPayout(db, {
      partnerId: partner.id,
      amountCents: 4000,
      payoutRail: 'USDT',
      destinationDetails: { wallet: '0x1234567890abcdef' },
    });
    expect(lowReq.success).toBe(false);
    expect(lowReq.error).toContain('Payout amount must be at least $50.00');

    // Request exceeding available balance (15000 cents) fails
    const highReq = await requestCommissionPayout(db, {
      partnerId: partner.id,
      amountCents: 15000,
      payoutRail: 'USDT',
      destinationDetails: { wallet: '0x1234567890abcdef' },
    });
    expect(highReq.success).toBe(false);
    expect(highReq.error).toContain('Insufficient pending payout balance');

    // Valid $60 (6000 cents) payout succeeds
    const validReq = await requestCommissionPayout(db, {
      partnerId: partner.id,
      amountCents: 6000,
      payoutRail: 'VIETQR',
      destinationDetails: { bankBin: '970407', account: '123456789', name: 'NGUYEN VAN A' },
    });
    expect(validReq.success).toBe(true);
    expect(validReq.payoutBatchId).toMatch(/^payout_/);
    expect(validReq.remainingPendingCents).toBe(4000);

    const afterPayout = await getPartnerById(db, partner.id);
    expect(afterPayout?.pending_payout_cents).toBe(4000);
    expect(afterPayout?.payout_rail).toBe('VIETQR');
  });

  it('aggregates dashboard data accurately', async () => {
    const partner = await registerPartner(db, {
      userId: 'user_dash_tester',
      tenantId: 'tenant_dash_tester',
      partnerName: 'Dashboard Media',
    });

    await accruePartnerCommission(db, {
      partnerId: partner.id,
      referredUserId: 'user_cust_dash',
      referredTenantId: 'tenant_cust_dash',
      orderId: 'ord_dash_1',
      mrrCents: 39900,
      isNewCustomer: true,
    });

    const data = await getPartnerDashboardData(db, partner.id);
    expect(data.profile.partner_name).toBe('Dashboard Media');
    expect(data.recentCommissions.length).toBe(1);
    expect(data.recentCommissions[0]?.order_id).toBe('ord_dash_1');
    expect(data.nextTier.targetTier).toBe('GOLD');
  });

  it('enforces tenant-level anti-self-referral check: rejects if customer belongs to same tenant', async () => {
    const partner = await registerPartner(db, {
      userId: 'user_agency_boss',
      tenantId: 'tenant_agency_corp',
      partnerName: 'Corporate Agency',
    });

    // 1. Employee with different user ID but SAME tenant tries to generate commission for partner
    const collusiveRes = await accruePartnerCommission(db, {
      partnerId: partner.id,
      referredUserId: 'user_agency_subaccount',
      referredTenantId: 'tenant_agency_corp',
      orderId: 'ord_collusive_test',
      mrrCents: 50_000,
      isNewCustomer: true,
    });

    expect(collusiveRes.success).toBe(false);
    expect(collusiveRes.error).toContain('SELF_TENANT_REFERRAL_PROHIBITED');
    expect(collusiveRes.commissionCents).toBe(0);

    // 2. Legitimate referral from an external tenant succeeds
    const legitimateRes = await accruePartnerCommission(db, {
      partnerId: partner.id,
      referredUserId: 'user_legit_client',
      referredTenantId: 'tenant_external_client',
      orderId: 'ord_legit_test',
      mrrCents: 50_000,
      isNewCustomer: true,
    });

    expect(legitimateRes.success).toBe(true);
    expect(legitimateRes.commissionCents).toBe(10_000); // 20% of 50,000 cents
  });

  it('atomic payout balance deduction with CAS check prevents double-spend race conditions', async () => {
    const partner = await registerPartner(db, {
      userId: 'user_cas_tester',
      tenantId: 'tenant_cas_tester',
      partnerName: 'CAS Agency',
    });

    // Credit $100.00 (10,000 cents) pending balance
    await db
      .prepare('UPDATE partner_profiles SET pending_payout_cents = 10000 WHERE id = ?1')
      .bind(partner.id)
      .run();

    // First withdrawal of $60.00 (6,000 cents) succeeds
    const firstPayout = await requestPartnerPayout(db, {
      partnerId: partner.id,
      amountCents: 6000,
      payoutRail: 'USDT',
      destinationDetails: { wallet: '0x123' },
    });
    expect(firstPayout.success).toBe(true);
    expect(firstPayout.remainingPendingCents).toBe(4000);

    // Second concurrent-like withdrawal of $60.00 (6,000 cents) fails due to CAS balance constraint
    const secondPayout = await requestPartnerPayout(db, {
      partnerId: partner.id,
      amountCents: 6000,
      payoutRail: 'USDT',
      destinationDetails: { wallet: '0x123' },
    });
    expect(secondPayout.success).toBe(false);
    expect(secondPayout.error).toContain('Insufficient pending payout balance (4000 cents available, requested 6000 cents)');
    expect(secondPayout.remainingPendingCents).toBe(4000);

    // Final balance is strictly 4,000 cents (no negative balances or penny leaks)
    const verified = await getPartnerById(db, partner.id);
    expect(verified?.pending_payout_cents).toBe(4000);
  });

  it('verifyCustomDomainDns performs authentic verification and rejects mismatching tokens', async () => {
    const partner = await registerPartner(db, {
      userId: 'user_dns_worker',
      tenantId: 'tenant_dns_worker',
      partnerName: 'DNS Agency',
    });

    // Elevate to PLATINUM
    await db
      .prepare("UPDATE partner_profiles SET tier = 'PLATINUM', whitelabel_enabled = 1 WHERE id = ?1")
      .bind(partner.id)
      .run();

    const config = await upsertWhitelabelConfig(db, {
      partnerId: partner.id,
      brandName: 'Brand Portal',
      customDomain: 'portal.myagency.io',
    });

    // 1. Mismatching domain rejected
    const mismatchDomain = await verifyCustomDomainDns(db, partner.id, 'unrelated.com');
    expect(mismatchDomain.verified).toBe(false);
    expect(mismatchDomain.message).toContain('Domain does not match');

    // 2. DNS query when mock returns false (token not found) fails
    const mockFail = await verifyCustomDomainDns(
      db,
      partner.id,
      'portal.myagency.io',
      async (_domain, _expectedToken) => false,
    );
    expect(mockFail.verified).toBe(false);
    expect(mockFail.message).toContain('not detected in TXT records');

    // 3. DNS query when mock finds token succeeds
    const mockSuccess = await verifyCustomDomainDns(
      db,
      partner.id,
      'portal.myagency.io',
      async (_domain, expectedToken) => expectedToken === config.dns_txt_verification_token,
    );
    expect(mockSuccess.verified).toBe(true);
    expect(mockSuccess.verifiedAt).toBeDefined();

    // 4. queryDnsTxtRecords handles invalid/nonexistent domains safely without crashing
    const emptyRecords = await queryDnsTxtRecords('invalid-nonexistent-domain-test.local');
    expect(Array.isArray(emptyRecords)).toBe(true);
  });
});
