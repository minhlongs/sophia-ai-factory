/**
 * Challenger 2 Empirical Adversarial Stress Test Suite:
 * Milestones M3 & M4 (Sophia AI Factory Q3 2027 Milestone - $400K MRR)
 *
 * M3 Focus:
 * 1. Partner tier promotion exact boundary conditions (29 vs 30 referrals, $19,999 vs $20,000 MRR; 9 vs 10 referrals, $4,999 vs $5,000 MRR).
 * 2. Anti-self-referral cycles and attribution expiration (>90 days).
 * 3. White-label domain injection and CSS theme variable security (escaping, valid hex colors).
 * 4. Commission zero penny leakage and idempotency under repeated order IDs.
 *
 * M4 Focus:
 * 1. Edge CDN cache headers across dynamic HLS, static chunks, and discovery route.
 * 2. Multi-aspect-ratio thumbnail dimensions (9:16, 16:9, 1:1, 4:5) and format metadata calculations.
 * 3. Cache tag purge mesh simulation and KV invalidator state tracking.
 * 4. Edge discovery route latency simulation and POP routing algorithm.
 *
 * Enforces strict 0 ':any' policy.
 * Layer: tests/adversarial/
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { NextRequest } from 'next/server';
import type { D1Database } from '@cloudflare/workers-types';

// M3 Partner Imports
import {
  calculateCommissionCents,
  determinePartnerTier,
  calculateNextTierProgress,
  isWithinAttributionWindow,
  generateReferralCode,
  generateDnsTxtVerificationToken,
  resolveWhitelabelTheme,
  registerPartner,
  getPartnerById,
  evaluatePartnerTierPromotion,
  accruePartnerCommission,
  upsertWhitelabelConfig,
  getWhitelabelConfigByPartnerId,
  verifyCustomDomainDns,
  resolveWhitelabelByDomain,
  requestCommissionPayout,
  getPartnerDashboardData,
} from '@/tree/partners/partner-service';
import {
  PARTNER_TIERS,
  ATTRIBUTION_WINDOW_MS,
  MIN_PAYOUT_THRESHOLD_CENTS,
  type PartnerTier,
  type PartnerProfile,
  type PartnerCommission,
  type PartnerWhitelabelConfig,
} from '@/tree/partners/types';

// M4 CDN Imports
import {
  buildCacheControlHeader,
  getHlsManifestCacheControl,
  getStaticChunkCacheControl,
  getEdgeDiscoveryCacheControl,
  getCacheControlForAssetType,
  buildCacheTagHeader,
  getCacheTagVersion,
  incrementCacheTagVersion,
  registerCacheTag,
  purgeCacheTag,
  purgeCacheByTenant,
  purgeCacheByAsset,
  getCacheTagsForResource,
  isTagPurged,
  getActiveCacheTagsCount,
  getPurgedCacheTagsCount,
  calculateHaversineDistanceKm,
  resolveNearestPopColo,
  discoverEdgeEndpoint,
  getAssetDeliveryMetrics,
  type KvTagStore,
} from '@/tree/cdn/cache-mesh-service';
import {
  getDimensionsForAspectRatio,
  isValidAspectRatio,
  isValidThumbnailFormat,
  calculateCropAndScale,
  calculateEstimatedSizeBytes,
  encodeBase83,
  decodeBase83,
  generateBlurHash,
  isValidBlurHash,
  generateThumbnailVariantSpecs,
  saveThumbnailVariants,
  getThumbnailVariantsByAsset,
  selectOptimalVariant,
} from '@/tree/cdn/thumbnail-generator';
import {
  ASPECT_RATIOS,
  EDGE_POP_CATALOG,
  type AspectRatio,
  type ThumbnailFormat,
} from '@/tree/cdn/types';
import { GET as cdnDiscoverRoute } from '@/app/api/cdn/discover/route';

/**
 * Creates an in-memory SQLite D1Database mock implementing full schemas for M3 & M4.
 */
function createAdversarialTestDb(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
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

    CREATE TABLE IF NOT EXISTS cdn_edge_cache_tags (
      id TEXT PRIMARY KEY,
      tag_name TEXT NOT NULL,
      resource_url TEXT NOT NULL,
      asset_type TEXT NOT NULL CHECK(asset_type IN ('video', 'thumbnail', 'template', 'preview', 'hls_manifest')),
      tenant_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      edge_ttl_seconds INTEGER NOT NULL DEFAULT 86400,
      stale_while_revalidate_seconds INTEGER NOT NULL DEFAULT 604800,
      is_purged INTEGER NOT NULL DEFAULT 0,
      purged_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS asset_thumbnail_variants (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      aspect_ratio TEXT NOT NULL CHECK(aspect_ratio IN ('9:16', '16:9', '1:1', '4:5')),
      format TEXT NOT NULL CHECK(format IN ('webp', 'avif', 'jpeg')),
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      size_bytes INTEGER NOT NULL,
      cdn_url TEXT NOT NULL,
      blur_hash TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(asset_id, aspect_ratio, format)
    );
  `);

  return {
    prepare(sql: string) {
      let bound: (string | number | null | undefined | bigint)[] = [];
      return {
        bind(...vals: (string | number | null | undefined | bigint)[]) {
          bound = vals.map((p) => (p === undefined ? null : p));
          return this;
        },
        async run(...vals: (string | number | null | undefined | bigint)[]) {
          const params = vals.length > 0 ? vals.map((p) => (p === undefined ? null : p)) : bound;
          const stmt = sqlite.prepare(sql);
          const res = stmt.run(...params);
          return {
            success: true,
            meta: { changes: Number(res.changes ?? 0), duration: 1 },
            changes: Number(res.changes ?? 0),
            lastInsertRowid: Number(res.lastInsertRowid ?? 0),
          };
        },
        async all<T = Record<string, unknown>>(...vals: (string | number | null | undefined | bigint)[]) {
          const params = vals.length > 0 ? vals.map((p) => (p === undefined ? null : p)) : bound;
          const stmt = sqlite.prepare(sql);
          const results = stmt.all(...params) as T[];
          return { results, meta: { changes: 0, duration: 1 } };
        },
        async first<T = Record<string, unknown>>(...vals: (string | number | null | undefined | bigint)[]) {
          const params = vals.length > 0 ? vals.map((p) => (p === undefined ? null : p)) : bound;
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...params);
          return (row as T) ?? null;
        },
      };
    },
  } as unknown as D1Database;
}

describe('Challenger 2 Empirical Adversarial Suite: Milestone M3 (Partner Portal & White-Label)', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createAdversarialTestDb();
  });

  describe('1. Exact Partner Tier Promotion Boundary Conditions', () => {
    it('empirically verifies 29 vs 30 referrals and $19,999 vs $20,000 MRR thresholds', () => {
      // 29 referrals and $19,999.00 MRR (1,999,900 cents) -> strictly GOLD
      const justBelowPlatinum = determinePartnerTier(29, 1_999_900);
      expect(justBelowPlatinum.tier).toBe('GOLD');
      expect(justBelowPlatinum.commissionRatePct).toBe(28.0);
      expect(justBelowPlatinum.whitelabelEnabled).toBe(false);

      // 29 referrals and $19,999.99 MRR (1,999,999 cents) -> strictly GOLD
      const fractionalBelowPlatinum = determinePartnerTier(29, 1_999_999);
      expect(fractionalBelowPlatinum.tier).toBe('GOLD');
      expect(fractionalBelowPlatinum.commissionRatePct).toBe(28.0);
      expect(fractionalBelowPlatinum.whitelabelEnabled).toBe(false);

      // 30 referrals and $19,999.00 MRR -> strictly PLATINUM (meets customer threshold)
      const hit30Customers = determinePartnerTier(30, 1_999_900);
      expect(hit30Customers.tier).toBe('PLATINUM');
      expect(hit30Customers.commissionRatePct).toBe(35.0);
      expect(hit30Customers.whitelabelEnabled).toBe(true);

      // 29 referrals and $20,000.00 MRR (2,000,000 cents) -> strictly PLATINUM (meets MRR threshold)
      const hit20kMrr = determinePartnerTier(29, 2_000_000);
      expect(hit20kMrr.tier).toBe('PLATINUM');
      expect(hit20kMrr.commissionRatePct).toBe(35.0);
      expect(hit20kMrr.whitelabelEnabled).toBe(true);
    });

    it('empirically verifies 9 vs 10 referrals and $4,999 vs $5,000 MRR thresholds', () => {
      // 9 referrals and $4,999.00 MRR (499,900 cents) -> strictly SILVER
      const justBelowGold = determinePartnerTier(9, 499_900);
      expect(justBelowGold.tier).toBe('SILVER');
      expect(justBelowGold.commissionRatePct).toBe(20.0);
      expect(justBelowGold.whitelabelEnabled).toBe(false);

      // 9 referrals and $4,999.99 MRR (499,999 cents) -> strictly SILVER
      const fractionalBelowGold = determinePartnerTier(9, 499_999);
      expect(fractionalBelowGold.tier).toBe('SILVER');
      expect(fractionalBelowGold.commissionRatePct).toBe(20.0);
      expect(fractionalBelowGold.whitelabelEnabled).toBe(false);

      // 10 referrals and $4,999.00 MRR -> strictly GOLD (meets customer threshold)
      const hit10Customers = determinePartnerTier(10, 499_900);
      expect(hit10Customers.tier).toBe('GOLD');
      expect(hit10Customers.commissionRatePct).toBe(28.0);
      expect(hit10Customers.whitelabelEnabled).toBe(false);

      // 9 referrals and $5,000.00 MRR (500,000 cents) -> strictly GOLD (meets MRR threshold)
      const hit5kMrr = determinePartnerTier(9, 500_000);
      expect(hit5kMrr.tier).toBe('GOLD');
      expect(hit5kMrr.commissionRatePct).toBe(28.0);
      expect(hit5kMrr.whitelabelEnabled).toBe(false);
    });

    it('validates step-by-step tier promotion in database and whitelabel activation', async () => {
      const partner = await registerPartner(db, {
        userId: 'usr_tier_boundary',
        tenantId: 'tnt_tier_boundary',
        partnerName: 'Boundary Agency',
      });
      expect(partner.tier).toBe('SILVER');
      expect(partner.whitelabel_enabled).toBe(0);

      // Set partner exactly at 29 referrals and $19,999 MRR
      await db.prepare(`
        UPDATE partner_profiles
        SET total_referred_customers = 29, total_mrr_cents = 1999900
        WHERE id = ?
      `).bind(partner.id).run();

      const promo1 = await evaluatePartnerTierPromotion(db, partner.id);
      expect(promo1.currentTier).toBe('SILVER');
      expect(promo1.newTier).toBe('GOLD');
      expect(promo1.promoted).toBe(true);
      expect(promo1.whitelabelEnabled).toBe(false);

      // Now add 1 customer to hit 30 referrals -> promotes to PLATINUM
      await db.prepare(`
        UPDATE partner_profiles
        SET total_referred_customers = 30
        WHERE id = ?
      `).bind(partner.id).run();

      const promo2 = await evaluatePartnerTierPromotion(db, partner.id);
      expect(promo2.currentTier).toBe('GOLD');
      expect(promo2.newTier).toBe('PLATINUM');
      expect(promo2.promoted).toBe(true);
      expect(promo2.whitelabelEnabled).toBe(true);

      const updated = await getPartnerById(db, partner.id);
      expect(updated?.tier).toBe('PLATINUM');
      expect(updated?.commission_rate_pct).toBe(35.0);
      expect(updated?.whitelabel_enabled).toBe(1);
    });

    it('handles gamified tier progress calculation across all boundary tiers', () => {
      // Silver with 0 customers & 0 MRR
      const pZero = calculateNextTierProgress('SILVER', 0, 0);
      expect(pZero.targetTier).toBe('GOLD');
      expect(pZero.customersRemaining).toBe(10);
      expect(pZero.mrrRemainingCents).toBe(500_000);
      expect(pZero.progressPct).toBe(0);

      // Silver near Gold: 9 customers, $4,999 MRR
      const pNearGold = calculateNextTierProgress('SILVER', 9, 499_900);
      expect(pNearGold.targetTier).toBe('GOLD');
      expect(pNearGold.customersRemaining).toBe(1);
      expect(pNearGold.mrrRemainingCents).toBe(100);
      expect(pNearGold.progressPct).toBe(99);

      // Gold near Platinum: 29 customers, $19,999 MRR
      const pNearPlat = calculateNextTierProgress('GOLD', 29, 1_999_900);
      expect(pNearPlat.targetTier).toBe('PLATINUM');
      expect(pNearPlat.customersRemaining).toBe(1);
      expect(pNearPlat.mrrRemainingCents).toBe(100);
      expect(pNearPlat.progressPct).toBe(99);

      // Platinum reached: progress is 100%, targetTier is null
      const pMax = calculateNextTierProgress('PLATINUM', 45, 3_000_000);
      expect(pMax.targetTier).toBeNull();
      expect(pMax.progressPct).toBe(100);
      expect(pMax.customersRemaining).toBe(0);
      expect(pMax.mrrRemainingCents).toBe(0);
    });
  });

  describe('2. Anti-Self-Referral Cycles & Attribution Expiration (>90 Days)', () => {
    it('blocks direct self-referral attempts where partner.user_id matches referredUserId', async () => {
      const partner = await registerPartner(db, {
        userId: 'usr_adversary_self',
        tenantId: 'tnt_adversary_self',
        partnerName: 'Self-Dealing Agency',
      });

      const attempt = await accruePartnerCommission(db, {
        partnerId: partner.id,
        referredUserId: 'usr_adversary_self', // Direct self-referral
        referredTenantId: 'tnt_victim',
        orderId: 'ord_self_direct',
        mrrCents: 200_000,
      });

      expect(attempt.success).toBe(false);
      expect(attempt.commissionCents).toBe(0);
      expect(attempt.error).toContain('SELF_REFERRAL_PROHIBITED');

      // Verify no row created in partner_commissions
      const rows = await db.prepare('SELECT COUNT(*) as cnt FROM partner_commissions WHERE order_id = ?')
        .bind('ord_self_direct')
        .first<{ cnt: number }>();
      expect(rows?.cnt).toBe(0);
    });

    it('ADVERSARIAL CHALLENGE: exposes tenant-level self-referral vulnerability', async () => {
      // Security defect identification:
      // When a partner creates a second user account under the SAME tenant,
      // partner-service only compares partner.user_id === input.referredUserId.
      // It does NOT check partner.tenant_id === input.referredTenantId!
      const partner = await registerPartner(db, {
        userId: 'usr_agency_owner',
        tenantId: 'tnt_agency_corp',
        partnerName: 'Agency Corp',
      });

      // Employee / sub-account in the SAME tenant places an order
      const res = await accruePartnerCommission(db, {
        partnerId: partner.id,
        referredUserId: 'usr_agency_employee_alt', // Different user ID!
        referredTenantId: 'tnt_agency_corp', // SAME tenant ID!
        orderId: 'ord_collusive_tenant',
        mrrCents: 100_000,
      });

      // Remediated: verifies tenant-level self-referral collusion is strictly prohibited
      expect(res.success).toBe(false);
      expect(res.error).toContain('SELF_TENANT_REFERRAL_PROHIBITED');
      expect(res.commissionCents).toBe(0);
    });

    it('ADVERSARIAL CHALLENGE: explores mutual referral cycle (A refers B, B refers A)', async () => {
      // Partner A
      const partnerA = await registerPartner(db, {
        userId: 'usr_partner_A',
        tenantId: 'tnt_A',
        partnerName: 'Agency A',
      });
      // Partner B
      const partnerB = await registerPartner(db, {
        userId: 'usr_partner_B',
        tenantId: 'tnt_B',
        partnerName: 'Agency B',
      });

      // Partner A refers Partner B
      const orderAtoB = await accruePartnerCommission(db, {
        partnerId: partnerA.id,
        referredUserId: 'usr_partner_B',
        referredTenantId: 'tnt_B',
        orderId: 'ord_A_to_B',
        mrrCents: 50_000,
      });
      expect(orderAtoB.success).toBe(true);

      // Partner B refers Partner A (reciprocal cycle)
      const orderBtoA = await accruePartnerCommission(db, {
        partnerId: partnerB.id,
        referredUserId: 'usr_partner_A',
        referredTenantId: 'tnt_A',
        orderId: 'ord_B_to_A',
        mrrCents: 50_000,
      });
      // System permits cyclic referrals because attribution is evaluated per-order without a graph cycle check
      expect(orderBtoA.success).toBe(true);
    });

    it('empirically stress-tests 90-day referral attribution expiration window', async () => {
      const now = Date.now();
      const exact90DaysMs = 90 * 86_400 * 1000;

      // 1. Within window: exactly 90 days ago
      expect(isWithinAttributionWindow(now - exact90DaysMs, now)).toBe(true);

      // 2. Within window: 89 days, 23 hours ago
      expect(isWithinAttributionWindow(now - (exact90DaysMs - 3_600_000), now)).toBe(true);

      // 3. Expired: 90 days + 1 millisecond ago
      expect(isWithinAttributionWindow(now - (exact90DaysMs + 1), now)).toBe(false);

      // 4. Expired: 91 days ago
      expect(isWithinAttributionWindow(now - (exact90DaysMs + 86_400_000), now)).toBe(false);

      // 5. Future attributed timestamp (clock skew or malicious future timestamp)
      expect(isWithinAttributionWindow(now + 10_000, now)).toBe(false);

      // Verify integration in accruePartnerCommission
      const partner = await registerPartner(db, {
        userId: 'usr_partner_window',
        tenantId: 'tnt_partner_window',
        partnerName: 'Window Agency',
      });

      const expiredAccrual = await accruePartnerCommission(
        db,
        {
          partnerId: partner.id,
          referredUserId: 'usr_late_customer',
          referredTenantId: 'tnt_late_customer',
          orderId: 'ord_expired_90d',
          mrrCents: 100_000,
          referredAtMs: now - (exact90DaysMs + 5000),
        },
        now
      );

      expect(expiredAccrual.success).toBe(false);
      expect(expiredAccrual.error).toContain('ATTRIBUTION_WINDOW_EXPIRED');
    });
  });

  describe('3. White-Label Domain Injection & CSS Theme Security', () => {
    it('ADVERSARIAL CHALLENGE: detects CSS property injection and url() breakout vulnerabilities', () => {
      // Attack Vector 1: CSS Injection via primary_color
      const maliciousColorConfig = {
        primary_color: '#06b6d4; } body { display:none } /*',
        accent_color: 'expression(alert(1))',
      };
      const theme1 = resolveWhitelabelTheme(maliciousColorConfig);
      // Remediated: verifies invalid hex color payload is sanitized to default and does not inject CSS
      expect(theme1.customCssProperties['--brand-primary']).toBe('#06b6d4');
      expect(theme1.customCssProperties['--brand-accent']).toBe('#3b82f6');
      expect(theme1.customCssProperties['--brand-primary']).not.toContain('display:none');

      // Attack Vector 2: CSS url() breakout in logo_url
      const maliciousLogoConfig = {
        logo_url: 'https://attacker.com/logo.png"); background-image: url("https://attacker.com/leak',
      };
      const theme2 = resolveWhitelabelTheme(maliciousLogoConfig);
      // Remediated: verifies url() breakout payload is neutralized to 'none'
      expect(theme2.customCssProperties['--brand-logo-url']).toBe('none');
    });

    it('ADVERSARIAL CHALLENGE: investigates lack of FQDN domain validation in white-label config', async () => {
      const partner = await registerPartner(db, {
        userId: 'usr_plat_hacker',
        tenantId: 'tnt_plat_hacker',
        partnerName: 'Platinum Hacker',
      });

      // Elevate to PLATINUM
      await db.prepare("UPDATE partner_profiles SET tier = 'PLATINUM', whitelabel_enabled = 1 WHERE id = ?")
        .bind(partner.id)
        .run();

      // Passing non-domain strings or URI schemes:
      const config = await upsertWhitelabelConfig(db, {
        partnerId: partner.id,
        brandName: 'Injected Agency',
        customDomain: 'invalid-domain-without-tld',
      });

      // Demonstrates that any string without FQDN check is currently accepted
      expect(config.custom_domain).toBe('invalid-domain-without-tld');
      expect(config.dns_txt_verification_token).toBeDefined();
    });

    it('strictly enforces tier gating: blocks SILVER and GOLD from configuring white-label', async () => {
      const partner = await registerPartner(db, {
        userId: 'usr_silver_blocked',
        tenantId: 'tnt_silver_blocked',
        partnerName: 'Silver Agency',
      });

      // Silver tier configuration attempt
      await expect(
        upsertWhitelabelConfig(db, {
          partnerId: partner.id,
          brandName: 'Unauthorized Agency',
        })
      ).rejects.toThrow('WHITELABEL_NOT_PERMITTED');

      // Elevate to GOLD
      await db.prepare("UPDATE partner_profiles SET tier = 'GOLD', whitelabel_enabled = 0 WHERE id = ?")
        .bind(partner.id)
        .run();

      // Gold tier configuration attempt also blocked
      await expect(
        upsertWhitelabelConfig(db, {
          partnerId: partner.id,
          brandName: 'Still Unauthorized Agency',
        })
      ).rejects.toThrow('WHITELABEL_NOT_PERMITTED');
    });

    it('verifies custom domain DNS verification state transitions and SSL provisioning', async () => {
      const partner = await registerPartner(db, {
        userId: 'usr_dns_test',
        tenantId: 'tnt_dns_test',
        partnerName: 'DNS Verified Agency',
      });
      await db.prepare("UPDATE partner_profiles SET tier = 'PLATINUM', whitelabel_enabled = 1 WHERE id = ?")
        .bind(partner.id)
        .run();

      const config = await upsertWhitelabelConfig(db, {
        partnerId: partner.id,
        brandName: 'Branded Portal',
        customDomain: 'portal.agency.com',
      });

      expect(config.is_ssl_active).toBe(0);
      expect(config.dns_txt_verification_token).toMatch(/^sophia-verify=[0-9a-f]{16}$/);

      // DNS verification with mismatching domain fails
      const failDns = await verifyCustomDomainDns(db, partner.id, 'wrong.domain.com');
      expect(failDns.verified).toBe(false);

      // DNS verification with matching domain succeeds and activates SSL
      const successDns = await verifyCustomDomainDns(
        db,
        partner.id,
        'portal.agency.com',
        async () => true
      );
      expect(successDns.verified).toBe(true);

      const resolved = await resolveWhitelabelByDomain(db, 'portal.agency.com');
      expect(resolved).not.toBeNull();
      expect(resolved?.config.is_ssl_active).toBe(1);
    });
  });

  describe('4. Commission Zero Penny Leakage & Order ID Idempotency', () => {
    it('mathematically certifies ZERO penny leakage across 10,000 randomized micro-transactions', () => {
      const rates = [20.0, 28.0, 35.0];

      // Test extreme fractions
      // $199.99 (19,999 cents) at 20%: 3,999.8 -> 3,999 cents (0.8c platform retained)
      expect(calculateCommissionCents(19999, 20.0)).toBe(3999);
      // $199.99 at 28%: 5,599.72 -> 5,599 cents (0.72c platform retained)
      expect(calculateCommissionCents(19999, 28.0)).toBe(5599);
      // $199.99 at 35%: 6,999.65 -> 6,999 cents (0.65c platform retained)
      expect(calculateCommissionCents(19999, 35.0)).toBe(6999);

      // Micro-amount 1 cent at 20% -> 0 cents
      expect(calculateCommissionCents(1, 20.0)).toBe(0);

      // Randomized stress testing over 10,000 iterations
      for (let i = 0; i < 10000; i++) {
        const randomMrr = Math.floor(Math.random() * 10_000_000) + 1; // 1 cent to $100,000
        const rate = rates[i % rates.length]!;
        const commission = calculateCommissionCents(randomMrr, rate);

        // INVARIANT 1: Zero penny leakage (integer cents strictly <= theoretical exact value)
        const theoretical = (randomMrr * rate) / 100;
        expect(commission).toBeLessThanOrEqual(theoretical);

        // INVARIANT 2: Commission is always an exact integer
        expect(Number.isInteger(commission)).toBe(true);

        // INVARIANT 3: Platform retains any fractional cent
        expect(theoretical - commission).toBeLessThan(1.0);
        expect(theoretical - commission).toBeGreaterThanOrEqual(0.0);
      }
    });

    it('enforces strict idempotency on repeated order IDs, preventing duplicate payouts', async () => {
      const partner = await registerPartner(db, {
        userId: 'usr_idempotent_order',
        tenantId: 'tnt_idempotent_order',
        partnerName: 'Idempotent Agency',
      });

      const orderInput = {
        partnerId: partner.id,
        referredUserId: 'usr_client_abc',
        referredTenantId: 'tnt_client_abc',
        orderId: 'ord_replay_attack_001',
        mrrCents: 50_000, // $500 MRR -> $100 commission at 20%
        isNewCustomer: true,
      };

      // 1st delivery
      const res1 = await accruePartnerCommission(db, orderInput);
      expect(res1.success).toBe(true);
      expect(res1.duplicate).toBeUndefined();
      expect(res1.commissionCents).toBe(10000);

      const profileAfter1 = await getPartnerById(db, partner.id);
      expect(profileAfter1?.total_earnings_cents).toBe(10000);
      expect(profileAfter1?.pending_payout_cents).toBe(10000);
      expect(profileAfter1?.total_referred_customers).toBe(1);

      // Repeated delivery 2 through 10 (simulate webhook replay / retry storm)
      for (let i = 2; i <= 10; i++) {
        const resDup = await accruePartnerCommission(db, orderInput);
        expect(resDup.success).toBe(true);
        expect(resDup.duplicate).toBe(true);
        expect(resDup.commissionId).toBe(res1.commissionId);
        expect(resDup.commissionCents).toBe(10000);
      }

      // Assert partner balances DID NOT increment
      const profileAfter10 = await getPartnerById(db, partner.id);
      expect(profileAfter10?.total_earnings_cents).toBe(10000);
      expect(profileAfter10?.pending_payout_cents).toBe(10000);
      expect(profileAfter10?.total_referred_customers).toBe(1);

      // Verify exactly 1 commission record in D1
      const count = await db.prepare('SELECT COUNT(*) as cnt FROM partner_commissions WHERE partner_id = ? AND order_id = ?')
        .bind(partner.id, 'ord_replay_attack_001')
        .first<{ cnt: number }>();
      expect(count?.cnt).toBe(1);
    });

    it('enforces minimum $50.00 payout threshold and balance deduction integrity', async () => {
      const partner = await registerPartner(db, {
        userId: 'usr_payout_guard',
        tenantId: 'tnt_payout_guard',
        partnerName: 'Payout Guard Agency',
      });

      // Set balance to $75.00 (7,500 cents)
      await db.prepare('UPDATE partner_profiles SET pending_payout_cents = 7500 WHERE id = ?')
        .bind(partner.id)
        .run();

      // Payout of $49.99 (4,999 cents) -> REJECTED
      const failLow = await requestCommissionPayout(db, {
        partnerId: partner.id,
        amountCents: 4999,
        payoutRail: 'USDT',
        destinationDetails: { wallet: '0x123' },
      });
      expect(failLow.success).toBe(false);
      expect(failLow.error).toContain('Payout amount must be at least $50.00');

      // Payout of $75.01 (7,501 cents) -> REJECTED (exceeds balance)
      const failHigh = await requestCommissionPayout(db, {
        partnerId: partner.id,
        amountCents: 7501,
        payoutRail: 'USDT',
        destinationDetails: { wallet: '0x123' },
      });
      expect(failHigh.success).toBe(false);
      expect(failHigh.error).toContain('Insufficient pending payout balance');

      // Valid payout of $50.00 (5,000 cents) -> APPROVED
      const successPayout = await requestCommissionPayout(db, {
        partnerId: partner.id,
        amountCents: 5000,
        payoutRail: 'VIETQR',
        destinationDetails: { bank: 'MB', account: '987654321' },
      });
      expect(successPayout.success).toBe(true);
      expect(successPayout.remainingPendingCents).toBe(2500);

      const finalProfile = await getPartnerById(db, partner.id);
      expect(finalProfile?.pending_payout_cents).toBe(2500);
      expect(finalProfile?.payout_rail).toBe('VIETQR');
    });
  });
});

describe('Challenger 2 Empirical Adversarial Suite: Milestone M4 (Global Edge CDN Mesh)', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createAdversarialTestDb();
  });

  describe('1. Edge CDN Cache Headers across Dynamic HLS, Static Chunks, and Discovery Route', () => {
    it('guarantees RFC 5861 Cache-Control compliance for all asset tiers', () => {
      // Dynamic HLS manifest: s-maxage=60, stale-while-revalidate=300
      const hlsHeader = getHlsManifestCacheControl();
      expect(hlsHeader).toBe('public, s-maxage=60, stale-while-revalidate=300');

      // Static chunks (.ts / .m4s): max-age=31536000, immutable
      const staticHeader = getStaticChunkCacheControl();
      expect(staticHeader).toBe('public, max-age=31536000, immutable');

      // Edge discovery endpoint: s-maxage=300, stale-while-revalidate=86400
      const discoverHeader = getEdgeDiscoveryCacheControl();
      expect(discoverHeader).toBe('public, s-maxage=300, stale-while-revalidate=86400');

      // Asset type resolution mapping
      expect(getCacheControlForAssetType('hls_manifest')).toBe(hlsHeader);
      expect(getCacheControlForAssetType('video')).toBe(staticHeader);
      expect(getCacheControlForAssetType('thumbnail')).toBe('public, max-age=2592000, s-maxage=86400, stale-while-revalidate=604800');
      expect(getCacheControlForAssetType('preview')).toBe('public, max-age=86400, s-maxage=3600, stale-while-revalidate=86400');
      expect(getCacheControlForAssetType('template')).toBe('public, max-age=3600, s-maxage=1800, stale-while-revalidate=86400');
    });

    it('generates sanitized and deduplicated Cloudflare Cache-Tag headers', () => {
      const header = buildCacheTagHeader({
        assetId: 'ast/hack#123',
        tenantId: 'tenant@corp',
        assetType: 'video',
        customTags: ['custom_tag', 'custom_tag', 'another_tag'],
      });

      // Special characters replaced with underscores
      expect(header).toContain('asset_ast_hack_123');
      expect(header).toContain('tenant_tenant_corp');
      expect(header).toContain('type_video');

      // Tag deduplication
      const parts = header.split(', ');
      expect(parts.filter((p) => p === 'custom_tag')).toHaveLength(1);
    });
  });

  describe('2. Multi-Aspect-Ratio Dimensions & Format Metadata Calculations', () => {
    it('verifies exact pixel math for all 4 aspect ratios across all 3 tiers', () => {
      const ratios: AspectRatio[] = ['9:16', '16:9', '1:1', '4:5'];

      for (const ratio of ratios) {
        const high = getDimensionsForAspectRatio(ratio, 'high');
        const standard = getDimensionsForAspectRatio(ratio, 'standard');
        const preview = getDimensionsForAspectRatio(ratio, 'preview');

        // Check ratio proportional invariants
        const [wStr, hStr] = ratio.split(':');
        const expectedRatio = Number(wStr) / Number(hStr);

        expect(Math.abs(high.width / high.height - expectedRatio)).toBeLessThan(0.001);
        expect(Math.abs(standard.width / standard.height - expectedRatio)).toBeLessThan(0.001);
        expect(Math.abs(preview.width / preview.height - expectedRatio)).toBeLessThan(0.001);
      }
    });

    it('verifies centered crop and scaling geometry without coordinate distortion', () => {
      // 16:9 (1920x1080) to 9:16 (target: 1080x1920)
      const crop16to9 = calculateCropAndScale(1920, 1080, '9:16');
      expect(crop16to9.cropHeight).toBe(1080);
      expect(crop16to9.cropWidth).toBe(608);
      expect(crop16to9.cropX).toBe(656); // (1920 - 608) / 2
      expect(crop16to9.cropY).toBe(0);
      // Perfect centering check: left margin + width + right margin === source width
      expect(crop16to9.cropX * 2 + crop16to9.cropWidth).toBe(1920);

      // 9:16 (1080x1920) to 16:9 (target: 1920x1080)
      const crop9to16 = calculateCropAndScale(1080, 1920, '16:9');
      expect(crop9to16.cropWidth).toBe(1080);
      expect(crop9to16.cropHeight).toBe(608);
      expect(crop9to16.cropX).toBe(0);
      expect(crop9to16.cropY).toBe(656); // (1920 - 608) / 2
      expect(crop9to16.cropY * 2 + crop9to16.cropHeight).toBe(1920);

      // 1:1 (1080x1080) to 4:5 (target: 1080x1350)
      const crop1to1 = calculateCropAndScale(1080, 1080, '4:5');
      expect(crop1to1.cropHeight).toBe(1080);
      expect(crop1to1.cropWidth).toBe(864); // 1080 * 0.8
      expect(crop1to1.cropX).toBe(108); // (1080 - 864) / 2
      expect(crop1to1.cropY).toBe(0);
      expect(crop1to1.cropX * 2 + crop1to1.cropWidth).toBe(1080);
    });

    it('ADVERSARIAL CHALLENGE: verifies zero and negative input dimensions are safely guarded in calculateCropAndScale', () => {
      // Input: zero dimensions safely guarded against division by zero
      const geomZero = calculateCropAndScale(0, 0, '9:16');
      expect(geomZero.scaleFactor).toBe(1);
      expect(geomZero.scaleFactor).not.toBe(Infinity);
      expect(geomZero.cropWidth).toBeGreaterThan(0);

      // Input: negative dimensions safely guarded
      const geomNeg = calculateCropAndScale(-100, -100, '9:16');
      expect(geomNeg.cropWidth).toBeGreaterThan(0);
      expect(geomNeg.scaleFactor).toBe(1);
    });

    it('validates compression ratios: AVIF is ~42% smaller than WebP at identical resolution', () => {
      const dims = { width: 1080, height: 1920 };
      const webpBytes = calculateEstimatedSizeBytes(dims.width, dims.height, 'webp');
      const avifBytes = calculateEstimatedSizeBytes(dims.width, dims.height, 'avif');
      const jpegBytes = calculateEstimatedSizeBytes(dims.width, dims.height, 'jpeg');

      expect(avifBytes).toBeLessThan(webpBytes);
      expect(webpBytes).toBeLessThan(jpegBytes);

      const avifSavingsPct = ((webpBytes - avifBytes) / webpBytes) * 100;
      expect(avifSavingsPct).toBeGreaterThan(35);
      expect(avifSavingsPct).toBeLessThan(45);

      // Container minimum floor test
      expect(calculateEstimatedSizeBytes(1, 1, 'avif')).toBe(1024);
    });

    it('validates BlurHash Base83 generation, determinism, and format constraints', () => {
      const hash = generateBlurHash('asset_video_adv', '9:16');
      expect(hash).toHaveLength(28); // 4x3 components -> 28 chars
      expect(hash[0]).toBe('L'); // sizeFlag = 21 -> Base83 'L'
      expect(isValidBlurHash(hash)).toBe(true);

      // Base83 roundtrip
      const testVal = 45892;
      const encoded = encodeBase83(testVal, 3);
      expect(decodeBase83(encoded)).toBe(testVal);
    });
  });

  describe('3. Cache Tag Purge Mesh Simulation & Invalidator State Tracking', () => {
    it('maintains strict multi-tenant isolation during tenant-wide cache purge', async () => {
      // 5 tags for tenant A, 5 tags for tenant B
      for (let i = 1; i <= 5; i++) {
        await registerCacheTag(db, {
          tagName: `tag_tenant_A_${i}`,
          resourceUrl: `https://cdn/asset_A_${i}.webp`,
          assetType: 'thumbnail',
          tenantId: 'tenant_A',
          contentHash: `hash_A_${i}`,
        });
        await registerCacheTag(db, {
          tagName: `tag_tenant_B_${i}`,
          resourceUrl: `https://cdn/asset_B_${i}.webp`,
          assetType: 'thumbnail',
          tenantId: 'tenant_B',
          contentHash: `hash_B_${i}`,
        });
      }

      expect(await getActiveCacheTagsCount(db, 'tenant_A')).toBe(5);
      expect(await getActiveCacheTagsCount(db, 'tenant_B')).toBe(5);

      // Purge tenant A
      const purgeA = await purgeCacheByTenant(db, 'tenant_A');
      expect(purgeA.success).toBe(true);
      expect(purgeA.purgedCount).toBe(5);

      // Tenant A is completely purged; Tenant B remains completely untouched
      expect(await getActiveCacheTagsCount(db, 'tenant_A')).toBe(0);
      expect(await getPurgedCacheTagsCount(db, 'tenant_A')).toBe(5);
      expect(await getActiveCacheTagsCount(db, 'tenant_B')).toBe(5);
      expect(await getPurgedCacheTagsCount(db, 'tenant_B')).toBe(0);
    });

    it('ADVERSARIAL CHALLENGE: verifies SQL LIKE wildcard vulnerability is blocked in purgeCacheByAsset', async () => {
      // Register tags for multiple tenants
      await registerCacheTag(db, {
        tagName: 'asset_secure_1',
        resourceUrl: 'https://cdn/t1/secure1.mp4',
        assetType: 'video',
        tenantId: 'tenant_1',
        contentHash: 'h1',
      });
      await registerCacheTag(db, {
        tagName: 'asset_secure_2',
        resourceUrl: 'https://cdn/t2/secure2.mp4',
        assetType: 'video',
        tenantId: 'tenant_2',
        contentHash: 'h2',
      });

      // Calling purgeCacheByAsset with an empty string or whitespace is safely rejected:
      const wipeResult = await purgeCacheByAsset(db, '');
      expect(wipeResult.success).toBe(false);
      expect(wipeResult.purgedCount).toBe(0);
      expect(wipeResult.error).toContain('ASSET_ID_REQUIRED');
      // Confirms critical fix: Empty string does NOT wipe tags across tenants!
      expect(await getActiveCacheTagsCount(db)).toBe(2);
    });

    it('tracks KV invalidator version monotonically across multiple purges', async () => {
      const kvStorage = new Map<string, string>();
      const mockKv: KvTagStore = {
        async get(k: string) { return kvStorage.get(k) ?? null; },
        async put(k: string, v: string) { kvStorage.set(k, v); },
      };

      const tag = 'tag_monotonic_test';
      expect(await getCacheTagVersion(tag, mockKv)).toBe(1);

      for (let i = 1; i <= 5; i++) {
        const next = await incrementCacheTagVersion(tag, mockKv);
        expect(next).toBe(i + 1);
      }

      expect(await getCacheTagVersion(tag, mockKv)).toBe(6);
    });
  });

  describe('4. Edge Discovery Route Latency Simulation & POP Routing Algorithm', () => {
    it('verifies sub-80ms p95 latency invariant across all 9 global edge POPs', () => {
      for (const pop of EDGE_POP_CATALOG) {
        expect(pop.baseLatencyMs).toBeLessThan(80);

        const discovery = discoverEdgeEndpoint({
          assetId: 'ast_sla_test',
          clientColo: pop.code,
        });

        expect(discovery.sub80msSlaMet).toBe(true);
        expect(discovery.estimatedLatencyMs).toBeLessThan(80);
      }
    });

    it('empirically verifies multi-dimensional POP routing hierarchy', () => {
      // 1. Direct colo
      expect(resolveNearestPopColo({ assetId: 'a', clientColo: 'NRT' }).code).toBe('NRT');
      expect(resolveNearestPopColo({ assetId: 'a', clientColo: 'FRA' }).code).toBe('FRA');

      // 2. Coordinates
      // Near Ho Chi Minh City -> SGN
      expect(resolveNearestPopColo({ assetId: 'a', clientCoordinates: { lat: 10.82, lon: 106.63 } }).code).toBe('SGN');
      // Near San Francisco -> SFO
      expect(resolveNearestPopColo({ assetId: 'a', clientCoordinates: { lat: 37.77, lon: -122.42 } }).code).toBe('SFO');

      // 3. Country code
      expect(resolveNearestPopColo({ assetId: 'a', clientCountry: 'VN' }).code).toBe('SGN');
      expect(resolveNearestPopColo({ assetId: 'a', clientCountry: 'JP' }).code).toBe('NRT');
      expect(resolveNearestPopColo({ assetId: 'a', clientCountry: 'GB' }).code).toBe('LHR');
      expect(resolveNearestPopColo({ assetId: 'a', clientCountry: 'US' }).code).toBe('SFO');

      // 4. Region
      expect(resolveNearestPopColo({ assetId: 'a', preferredRegion: 'apac' }).region).toBe('apac');
      expect(resolveNearestPopColo({ assetId: 'a', preferredRegion: 'eu' }).region).toBe('eu');

      // 5. Default fallback
      expect(resolveNearestPopColo({ assetId: 'a' }).code).toBe('SIN');
    });

    it('empirically stress-tests GET /api/cdn/discover edge route handler', async () => {
      // 1. Valid request -> 200 OK with full edge header suite
      const validReq = new NextRequest(
        'https://sophia.agencyos.network/api/cdn/discover?assetId=asset_hls_viral&aspectRatio=9:16&format=avif',
        {
          headers: {
            'cf-ipcountry': 'VN',
            'x-edge-colo': 'SGN',
          },
        }
      );
      const res200 = await cdnDiscoverRoute(validReq);
      expect(res200.status).toBe(200);

      expect(res200.headers.get('Cache-Control')).toBe('public, s-maxage=300, stale-while-revalidate=86400');
      expect(res200.headers.get('Cache-Tag')).toContain('asset_asset_hls_viral');
      expect(res200.headers.get('X-Edge-Colo')).toBe('SGN');
      expect(res200.headers.get('Server-Timing')).toContain('edge;dur=');

      const body200 = await res200.json() as Record<string, unknown>;
      expect(body200.success).toBe(true);
      expect(body200.popColo).toBe('SGN');
      expect(body200.format).toBe('avif');
      expect(body200.sub80msSlaMet).toBe(true);

      // 2. Missing assetId -> 400 Bad Request
      const missingReq = new NextRequest('https://sophia.agencyos.network/api/cdn/discover');
      const res400Missing = await cdnDiscoverRoute(missingReq);
      expect(res400Missing.status).toBe(400);
      const bodyMissing = await res400Missing.json() as Record<string, unknown>;
      expect(bodyMissing.error).toBe('MISSING_ASSET_ID');

      // 3. Invalid aspect ratio -> 400 Bad Request
      const badRatioReq = new NextRequest('https://sophia.agencyos.network/api/cdn/discover?assetId=a1&aspectRatio=32:9');
      const res400Ratio = await cdnDiscoverRoute(badRatioReq);
      expect(res400Ratio.status).toBe(400);
      const bodyRatio = await res400Ratio.json() as Record<string, unknown>;
      expect(bodyRatio.error).toBe('INVALID_ASPECT_RATIO');

      // 4. Invalid format -> 400 Bad Request
      const badFmtReq = new NextRequest('https://sophia.agencyos.network/api/cdn/discover?assetId=a1&format=gif');
      const res400Fmt = await cdnDiscoverRoute(badFmtReq);
      expect(res400Fmt.status).toBe(400);
      const bodyFmt = await res400Fmt.json() as Record<string, unknown>;
      expect(bodyFmt.error).toBe('INVALID_FORMAT');

      // 5. Explicit not found -> 404 Not Found
      const notFoundReq = new NextRequest('https://sophia.agencyos.network/api/cdn/discover?assetId=missing_video_100');
      const res404 = await cdnDiscoverRoute(notFoundReq);
      expect(res404.status).toBe(404);
      const body404 = await res404.json() as Record<string, unknown>;
      expect(body404.error).toBe('ASSET_NOT_FOUND');
    });
  });
});
