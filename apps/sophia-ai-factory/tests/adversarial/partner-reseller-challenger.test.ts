/**
 * @module tests/adversarial/partner-reseller-challenger.test
 *
 * Adversarial Stress & Vulnerability Challenger Test Suite:
 * Global Partner Channels, Enterprise Reseller Federation & White-Label Co-Op Engine
 *
 * Stress Vectors & Threat Models:
 * 1. High-Concurrency CAS Pool Exhaustion:
 *    - 10 concurrent requests competing for finite pool capacity (seats & MCU credits).
 *    - Validates atomic Compare-And-Swap (CAS) guardrails preventing any double-allocation or overdraft.
 *    - Validates edge race when 20 requests compete for exactly 1 seat / 100 MCU remaining.
 * 2. CSS Injection Attack Vectors (Sanitization Proof):
 *    - Stripping <script> tags, </style> breakout tags, HTML element injections (iframe, svg, img onerror).
 *    - Neutralizing @import directives (remote stylesheet theft).
 *    - Neutralizing execution in url(javascript:...), url(vbscript:...), url(data:text/html,...).
 *    - Neutralizing IE dynamic expression() and behavior: property bindings.
 *    - Null bytes (\x00) and control character evasions.
 *    - Preserving legitimate, safe CSS syntax.
 * 3. Circular Agency Binding Attacks (Anti-Circularity Proof):
 *    - Self-binding attacks (Master == Sub).
 *    - Direct 2-node circular binding loop (A -> B -> A).
 *    - Single-Parent invariant enforcement against multi-master hijacking.
 *    - Inactive / Suspended partner defenses.
 *    - Proper cleanup on termination allowing legitimate re-delegation.
 * 4. Zero Penny Leakage Invariant Across 10,000 Random Cent Transactions:
 *    - Mathematical proof across 10,000 randomized cent amounts ($0.01 to $10,000,000.00).
 *    - Micro-cents and odd numbers (1, 3, 7, 13, 99 cents).
 *    - All tiers (Silver 20%, Gold 28%, Platinum 35%, and arbitrary rates).
 *    - Exact integer arithmetic invariant: C_master + C_sub + P_net === M.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  calculateCascadeOverride,
  bindSubReseller,
  unbindSubReseller,
  MASTER_CASCADE_OVERRIDE_RATE_PCT,
} from '@/tree/partners/reseller-hierarchy';
import {
  createLicensePool,
  allocatePoolQuota,
  getLicensePoolById,
} from '@/tree/partners/license-pooling';
import {
  sanitizeBrandCss,
  sanitizeUrlForCss,
  validateHexColor,
  resolveWhitelabelTheme,
} from '@/tree/partners/whitelabel-portal';
import { PARTNER_TIERS } from '@/tree/partners/types';

// ============================================================================
// In-Memory SQLite D1 Database Harness
// ============================================================================

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

function createAdversarialDb(): D1Database {
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

    CREATE TABLE IF NOT EXISTS partner_organizations (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL UNIQUE,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      organization_type TEXT NOT NULL CHECK(organization_type IN ('master_agency', 'sub_agency', 'standard_partner', 'enterprise_reseller')),
      tier TEXT NOT NULL DEFAULT 'SILVER' CHECK(tier IN ('SILVER', 'GOLD', 'PLATINUM')),
      cascade_override_pct REAL NOT NULL DEFAULT 5.0,
      billing_email TEXT NOT NULL,
      custom_domain TEXT UNIQUE,
      whitelabel_config_json TEXT DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'pending', 'pending_approval')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES partner_profiles(id)
    );

    CREATE TABLE IF NOT EXISTS partner_sub_resellers (
      id TEXT PRIMARY KEY,
      master_partner_id TEXT NOT NULL,
      sub_partner_id TEXT NOT NULL UNIQUE,
      agreement_ref TEXT,
      override_rate_pct REAL NOT NULL DEFAULT 5.0,
      lifetime_override_cents INTEGER NOT NULL DEFAULT 0,
      pending_override_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'terminated', 'paused')),
      joined_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (master_partner_id) REFERENCES partner_profiles(id),
      FOREIGN KEY (sub_partner_id) REFERENCES partner_profiles(id),
      CHECK(master_partner_id != sub_partner_id)
    );

    CREATE TABLE IF NOT EXISTS partner_license_pools (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      pool_name TEXT NOT NULL,
      total_seats INTEGER NOT NULL DEFAULT 0,
      allocated_seats INTEGER NOT NULL DEFAULT 0,
      total_mcu_credits INTEGER NOT NULL DEFAULT 0,
      allocated_mcu_credits INTEGER NOT NULL DEFAULT 0,
      consumed_mcu_credits INTEGER NOT NULL DEFAULT 0,
      unit_price_cents INTEGER NOT NULL DEFAULT 0,
      auto_topup_enabled INTEGER NOT NULL DEFAULT 0,
      auto_topup_threshold_mcu INTEGER DEFAULT 0,
      auto_topup_amount_mcu INTEGER DEFAULT 0,
      period_start INTEGER,
      period_end INTEGER,
      auto_renew INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'exhausted', 'expired', 'revoked')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES partner_profiles(id),
      CHECK(allocated_seats <= total_seats),
      CHECK(allocated_mcu_credits <= total_mcu_credits),
      CHECK(consumed_mcu_credits <= allocated_mcu_credits)
    );

    CREATE TABLE IF NOT EXISTS subaccount_mcu_allocations (
      id TEXT PRIMARY KEY,
      subaccount_id TEXT NOT NULL UNIQUE,
      allocated_mcu INTEGER NOT NULL DEFAULT 0,
      used_mcu INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
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

// Seed partner helper
async function seedPartner(
  db: D1Database,
  id: string,
  name: string,
  tier: 'SILVER' | 'GOLD' | 'PLATINUM' = 'PLATINUM',
  status: 'active' | 'suspended' = 'active',
) {
  const now = Date.now();
  await db
    .prepare(`
      INSERT INTO partner_profiles (
        id, user_id, tenant_id, partner_name, partner_type, tier,
        commission_rate_pct, referral_code, whitelabel_enabled,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'agency', ?, ?, ?, 1, ?, ?, ?)
    `)
    .bind(
      id,
      `user_${id}`,
      `tenant_${id}`,
      name,
      tier,
      PARTNER_TIERS[tier].ratePct,
      `REF_${id.toUpperCase()}`,
      status,
      now,
      now,
    )
    .run();
}

describe('Adversarial Challenger Suite: Partner Federation & Reseller Engine', () => {
  let db: D1Database;

  beforeEach(async () => {
    db = createAdversarialDb();
  });

  // ==========================================================================
  // Vector 1: High-Concurrency CAS Pool Exhaustion
  // ==========================================================================
  describe('Vector 1: High-Concurrency CAS Pool Exhaustion', () => {
    it('Oracle: 10 concurrent allocation requests strictly prevent overdraft under capacity pressure', async () => {
      await seedPartner(db, 'agency_cas_1', 'High Capacity Agency');

      // Create a pool with exactly 10 seats and 10,000 MCU credits
      const poolRes = await createLicensePool(
        db,
        'agency_cas_1',
        'Contested License Pool',
        10,
        10_000,
        500,
      );
      expect(poolRes.success).toBe(true);
      const poolId = poolRes.pool!.id;

      // 10 concurrent requests, each demanding 2 seats and 2,000 MCU
      // Total demand = 20 seats, 20,000 MCU (exactly 200% of capacity)
      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        allocatePoolQuota(db, poolId, `client_sub_${i}`, 2, 2_000),
      );

      const results = await Promise.all(concurrentRequests);

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      // Exactly 5 requests can succeed (5 * 2 = 10 seats, 5 * 2,000 = 10,000 MCU)
      expect(successCount).toBe(5);
      // Exactly 5 requests must fail closed
      expect(failureCount).toBe(5);

      // Verify failure errors are informative and safe
      const failureErrors = results.filter((r) => !r.success).map((r) => r.error);
      for (const err of failureErrors) {
        expect(['INSUFFICIENT_POOL_SEATS', 'INSUFFICIENT_POOL_MCU', 'POOL_EXHAUSTED']).toContain(
          err,
        );
      }

      // Verify the final pool state in DB matches exact sum
      const finalPool = await getLicensePoolById(db, poolId);
      expect(finalPool).not.toBeNull();
      expect(finalPool!.allocated_seats).toBe(10);
      expect(finalPool!.allocated_mcu_credits).toBe(10_000);
      expect(finalPool!.status).toBe('exhausted');

      // Overdraft invariant: allocated must never exceed total
      expect(finalPool!.allocated_seats).toBeLessThanOrEqual(finalPool!.total_seats);
      expect(finalPool!.allocated_mcu_credits).toBeLessThanOrEqual(
        finalPool!.total_mcu_credits,
      );
    });

    it('Oracle: 20 concurrent requests racing for the last 1 seat and 100 MCU — exactly 1 winner, 19 losers', async () => {
      await seedPartner(db, 'agency_cas_2', 'Micro Race Agency');

      // Create pool with 10 seats, allocate 9 seats first
      const poolRes = await createLicensePool(
        db,
        'agency_cas_2',
        'Single Unit Contested Pool',
        10,
        1_000,
        100,
      );
      const poolId = poolRes.pool!.id;

      // Pre-allocate 9 seats and 900 MCU
      const preAlloc = await allocatePoolQuota(db, poolId, 'sub_pre', 9, 900);
      expect(preAlloc.success).toBe(true);

      // Remaining: exactly 1 seat, 100 MCU
      // 20 concurrent requests each demanding 1 seat and 100 MCU
      const racers = Array.from({ length: 20 }, (_, idx) =>
        allocatePoolQuota(db, poolId, `racer_sub_${idx}`, 1, 100),
      );

      const results = await Promise.all(racers);

      const winners = results.filter((r) => r.success);
      const losers = results.filter((r) => !r.success);

      expect(winners.length).toBe(1);
      expect(losers.length).toBe(19);

      // Verify DB state
      const finalPool = await getLicensePoolById(db, poolId);
      expect(finalPool!.allocated_seats).toBe(10);
      expect(finalPool!.allocated_mcu_credits).toBe(1_000);
      expect(finalPool!.status).toBe('exhausted');
    });

    it('Oracle: Asymmetric random concurrent demands maintain strict capacity invariants', async () => {
      await seedPartner(db, 'agency_cas_3', 'Asymmetric Agency');

      const poolRes = await createLicensePool(
        db,
        'agency_cas_3',
        'Asymmetric Pool',
        15,
        15_000,
        250,
      );
      const poolId = poolRes.pool!.id;

      // Demands: varied seats and MCU credits
      const demands = [
        { seats: 3, mcu: 3_000 },
        { seats: 4, mcu: 4_000 },
        { seats: 5, mcu: 5_000 },
        { seats: 2, mcu: 2_000 },
        { seats: 4, mcu: 4_000 },
        { seats: 1, mcu: 1_000 },
        { seats: 3, mcu: 3_000 },
        { seats: 2, mcu: 2_000 },
        { seats: 6, mcu: 6_000 },
        { seats: 1, mcu: 1_000 },
      ]; // Total demand = 31 seats, 31,000 MCU (206% of capacity)

      const requests = demands.map((d, i) =>
        allocatePoolQuota(db, poolId, `sub_asym_${i}`, d.seats, d.mcu),
      );

      const results = await Promise.all(requests);

      // Sum of allocated seats for successful requests
      const allocatedSeatsSum = results
        .filter((r) => r.success)
        .reduce((sum, r) => sum + r.allocatedSeats, 0);

      const allocatedMcuSum = results
        .filter((r) => r.success)
        .reduce((sum, r) => sum + r.allocatedMcuCredits, 0);

      const finalPool = await getLicensePoolById(db, poolId);
      expect(finalPool!.allocated_seats).toBe(allocatedSeatsSum);
      expect(finalPool!.allocated_mcu_credits).toBe(allocatedMcuSum);
      expect(finalPool!.allocated_seats).toBeLessThanOrEqual(15);
      expect(finalPool!.allocated_mcu_credits).toBeLessThanOrEqual(15_000);
    });
  });

  // ==========================================================================
  // Vector 2: CSS Injection Attack Vectors (Sanitization Proof)
  // ==========================================================================
  describe('Vector 2: CSS Injection Attack Vectors (Sanitization Proof)', () => {
    it('Oracle: Neutralizes <script> tags and remote script inclusion', () => {
      const payloads = [
        "<script>alert('pwned')</script>",
        '<SCRIPT SRC="https://evil.com/xss.js"></SCRIPT>',
        '<script\x20type="text/javascript">stealCookies()</script>',
        '<script/x>alert(1)</script>',
        'body { color: red; } <script>fetch("https://evil.com")</script>',
      ];

      for (const payload of payloads) {
        const sanitized = sanitizeBrandCss(payload);
        expect(sanitized.toLowerCase()).not.toContain('<script');
        expect(sanitized.toLowerCase()).not.toContain('</script>');
      }
    });

    it('Oracle: Neutralizes style breakouts and HTML element injections', () => {
      const payloads = [
        '</style><script>alert(1)</script><style>',
        '<iframe src="https://evil.com"></iframe>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<!-- <script>alert(1)</script> -->',
        '<![CDATA[ <script>alert(1)</script> ]]>',
        '</style><link rel="stylesheet" href="http://evil.com/malicious.css">',
      ];

      for (const payload of payloads) {
        const sanitized = sanitizeBrandCss(payload);
        expect(sanitized).not.toContain('<iframe');
        expect(sanitized).not.toContain('<img');
        expect(sanitized).not.toContain('<svg');
        expect(sanitized).not.toContain('<!--');
        expect(sanitized).not.toContain('<![CDATA[');
        expect(sanitized).not.toContain('<link');
      }
    });

    it('Oracle: Neutralizes @import rules completely (remote stylesheet injection)', () => {
      const payloads = [
        '@import url("https://evil.com/malicious.css");',
        "@import 'http://attacker.com/stealer.css';",
        '@import"https://bad.com";',
        '@import  url(\'http://evil.com\')  ;',
        "@IMPORT url('https://evil.com');",
        'body { font-size: 16px; } @import url("evil.css"); h1 { color: blue; }',
      ];

      for (const payload of payloads) {
        const sanitized = sanitizeBrandCss(payload);
        expect(sanitized.toLowerCase()).not.toContain('@import');
      }
    });

    it('Oracle: Neutralizes executable protocols in url() and property values', () => {
      const payloads = [
        'background: url(javascript:alert(1));',
        'background-image: url("javascript:fetch(\'https://evil.com\')");',
        'background: url(\'vbscript:msgbox("XSS")\');',
        'background: url(data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==);',
        'behavior: url(xss.htc);',
        'width: expression(alert(document.cookie));',
        '-moz-binding: url("http://evil.com/xss.xml#test");',
      ];

      for (const payload of payloads) {
        const sanitized = sanitizeBrandCss(payload);
        expect(sanitized.toLowerCase()).not.toContain('javascript:');
        expect(sanitized.toLowerCase()).not.toContain('vbscript:');
        expect(sanitized.toLowerCase()).not.toContain('expression(');
        expect(sanitized.toLowerCase()).not.toContain('behavior:');
        expect(sanitized.toLowerCase()).not.toContain('-moz-binding');
      }
    });

    it('Oracle: Strips null bytes and control character evasion attempts', () => {
      const dirty = 'body {\x00 color: red; \x08 background: blue; \x1F }';
      const sanitized = sanitizeBrandCss(dirty);
      expect(sanitized).not.toContain('\x00');
      expect(sanitized).not.toContain('\x08');
      expect(sanitized).not.toContain('\x1F');
      expect(sanitized).toContain('color: red;');
    });

    it('Oracle: sanitizeUrlForCss rejects breakout characters and malicious protocols', () => {
      // Must reject quotes, parens, backslashes, semicolons, and angle brackets
      expect(sanitizeUrlForCss('https://example.com" onfocus=alert(1)')).toBe('');
      expect(sanitizeUrlForCss('https://example.com); } body { color: red; }')).toBe('');
      expect(sanitizeUrlForCss('https://example.com/logo.png; evil-prop: 1')).toBe('');
      expect(sanitizeUrlForCss('javascript:alert(1)')).toBe('');
      expect(sanitizeUrlForCss('vbscript:msgbox(1)')).toBe('');
      expect(sanitizeUrlForCss('data:text/html,<script>alert(1)</script>')).toBe('');

      // Must allow legitimate URLs
      expect(sanitizeUrlForCss('https://cdn.agencybrand.com/logo.png')).toBe(
        'https://cdn.agencybrand.com/logo.png',
      );
      expect(sanitizeUrlForCss('/assets/branding/logo.svg')).toBe('/assets/branding/logo.svg');
    });

    it('Oracle: validateHexColor rejects CSS breakout attempts and falls back safely', () => {
      const fallback = '#06b6d4';
      expect(validateHexColor('#06b6d4; } body { color: red; }', fallback)).toBe(fallback);
      expect(validateHexColor('red', fallback)).toBe(fallback);
      expect(validateHexColor('rgb(255, 0, 0)', fallback)).toBe(fallback);
      expect(validateHexColor('javascript:alert(1)', fallback)).toBe(fallback);
      expect(validateHexColor('', fallback)).toBe(fallback);
      expect(validateHexColor(null, fallback)).toBe(fallback);

      // Valid hex strings
      expect(validateHexColor('#ffffff', fallback)).toBe('#ffffff');
      expect(validateHexColor('#000000', fallback)).toBe('#000000');
      expect(validateHexColor('#3B82F6', fallback)).toBe('#3B82F6');
    });

    it('Oracle: Preserves legitimate CSS rules cleanly', () => {
      const safeCss = `
        .agency-header {
          display: flex;
          align-items: center;
          background-color: var(--brand-primary);
          padding: 1rem 2rem;
        }
        .agency-nav a:hover {
          color: var(--brand-accent);
          text-decoration: underline;
        }
      `;
      const sanitized = sanitizeBrandCss(safeCss);
      expect(sanitized).toContain('.agency-header');
      expect(sanitized).toContain('display: flex');
      expect(sanitized).toContain('var(--brand-primary)');
    });
  });

  // ==========================================================================
  // Vector 3: Circular Agency Binding Attack (Anti-Circularity Proof)
  // ==========================================================================
  describe('Vector 3: Circular Agency Binding Attack (Anti-Circularity Proof)', () => {
    it('Oracle: Prevents self-binding attack (A -> A)', async () => {
      await seedPartner(db, 'agency_self', 'Self Binding Agency');

      const result = await bindSubReseller(db, 'agency_self', 'agency_self');
      expect(result.success).toBe(false);
      expect(result.error).toBe('CIRCULAR_HIERARCHY_PROHIBITED');
    });

    it('Oracle: Prevents direct 2-node circular hierarchy loop (A -> B -> A)', async () => {
      await seedPartner(db, 'master_alpha', 'Master Alpha');
      await seedPartner(db, 'sub_beta', 'Sub Beta');

      // 1. Alpha binds Beta as sub-agency (Valid)
      const bind1 = await bindSubReseller(db, 'master_alpha', 'sub_beta', 'AGREEMENT_001');
      expect(bind1.success).toBe(true);

      // 2. Beta attempts to bind Alpha as its sub-agency (Direct Circular Loop Attack)
      const bind2 = await bindSubReseller(db, 'sub_beta', 'master_alpha', 'EXPLOIT_CIRCULAR');
      expect(bind2.success).toBe(false);
      expect(bind2.error).toBe('CIRCULAR_HIERARCHY_PROHIBITED');
    });

    it('Oracle: Enforces Single-Parent Invariant — blocks second master from hijacking sub-agency', async () => {
      await seedPartner(db, 'master_1', 'Master 1');
      await seedPartner(db, 'master_2', 'Master 2');
      await seedPartner(db, 'target_sub', 'Target Sub Agency');

      // Master 1 binds Target Sub
      const bind1 = await bindSubReseller(db, 'master_1', 'target_sub');
      expect(bind1.success).toBe(true);

      // Master 2 attempts to also bind Target Sub
      const bind2 = await bindSubReseller(db, 'master_2', 'target_sub');
      expect(bind2.success).toBe(false);
      expect(bind2.error).toBe('SUB_AGENCY_ALREADY_BOUND');
    });

    it('Oracle: Rejects binding when master or sub partner is suspended or non-existent', async () => {
      await seedPartner(db, 'active_master', 'Active Master', 'PLATINUM', 'active');
      await seedPartner(db, 'suspended_master', 'Suspended Master', 'PLATINUM', 'suspended');
      await seedPartner(db, 'active_sub', 'Active Sub', 'GOLD', 'active');
      await seedPartner(db, 'suspended_sub', 'Suspended Sub', 'GOLD', 'suspended');

      // 1. Suspended Master
      const r1 = await bindSubReseller(db, 'suspended_master', 'active_sub');
      expect(r1.success).toBe(false);
      expect(r1.error).toBe('MASTER_PARTNER_SUSPENDED');

      // 2. Suspended Sub
      const r2 = await bindSubReseller(db, 'active_master', 'suspended_sub');
      expect(r2.success).toBe(false);
      expect(r2.error).toBe('SUB_PARTNER_SUSPENDED');

      // 3. Non-existent master
      const r3 = await bindSubReseller(db, 'ghost_master', 'active_sub');
      expect(r3.success).toBe(false);
      expect(r3.error).toBe('MASTER_PARTNER_NOT_FOUND');

      // 4. Non-existent sub
      const r4 = await bindSubReseller(db, 'active_master', 'ghost_sub');
      expect(r4.success).toBe(false);
      expect(r4.error).toBe('SUB_PARTNER_NOT_FOUND');
    });

    it('Oracle: Clean termination allows legitimate re-binding to a new master without false-positive locks', async () => {
      await seedPartner(db, 'old_master', 'Old Master');
      await seedPartner(db, 'new_master', 'New Master');
      await seedPartner(db, 'migrating_sub', 'Migrating Sub');

      // Bind to old master
      const initialBind = await bindSubReseller(db, 'old_master', 'migrating_sub');
      expect(initialBind.success).toBe(true);

      // Unbind / terminate agreement
      const unbind = await unbindSubReseller(db, 'old_master', 'migrating_sub');
      expect(unbind.success).toBe(true);

      // Now new master can bind the sub without error
      const newBind = await bindSubReseller(db, 'new_master', 'migrating_sub');
      expect(newBind.success).toBe(true);
      expect(newBind.binding!.master_partner_id).toBe('new_master');
    });
  });

  // ==========================================================================
  // Vector 4: Zero Penny Leakage Invariant Across 10,000 Random Transactions
  // ==========================================================================
  describe('Vector 4: Zero Penny Leakage Invariant Across 10,000 Random Cent Transactions', () => {
    it('Oracle: C_master + C_sub + P_net === M exactly for 10,000 randomized cent amounts and tier rates', () => {
      const tiers = [
        { name: 'SILVER', rate: 20.0 },
        { name: 'GOLD', rate: 28.0 },
        { name: 'PLATINUM', rate: 35.0 },
        { name: 'CUSTOM_LOW', rate: 12.5 },
        { name: 'CUSTOM_HIGH', rate: 42.0 },
      ];

      // PRNG for deterministic reproducibility
      let seed = 42;
      function nextRandomInt(min: number, max: number): number {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        const normalized = seed / 4294967296;
        return Math.floor(normalized * (max - min + 1)) + min;
      }

      const totalIterations = 10_000;
      let verifiedCount = 0;

      for (let i = 0; i < totalIterations; i++) {
        // Pick an MRR amount across multiple order-of-magnitude buckets
        let mrrCents: number;
        const bucket = i % 5;

        if (bucket === 0) {
          // Low cent micro-transactions (1 to 99 cents)
          mrrCents = (i % 99) + 1;
        } else if (bucket === 1) {
          // Odd cents and prime cents (e.g. 103, 107, 249, 999, 1499)
          mrrCents = nextRandomInt(100, 5_000);
        } else if (bucket === 2) {
          // Standard plan pricing ($10 to $1,000)
          mrrCents = nextRandomInt(1_000, 100_000);
        } else if (bucket === 3) {
          // Enterprise tiers ($1,000 to $50,000)
          mrrCents = nextRandomInt(100_000, 5_000_000);
        } else {
          // Extreme mega transactions ($50,000 to $10,000,000)
          mrrCents = nextRandomInt(5_000_000, 1_000_000_000);
        }

        const tier = tiers[i % tiers.length];
        const hasActiveMaster = i % 2 === 0;

        const result = calculateCascadeOverride(mrrCents, tier.rate, hasActiveMaster, 'master_oracle');

        // 1. Zero Penny Leakage Invariant: Total decomposition must equal M
        const sum =
          result.overrideCents +
          result.subPartnerCommissionCents +
          result.platformNetCents;

        expect(sum).toBe(mrrCents);

        // 2. Strict Integer Cent Invariant: No fractional floating point numbers
        expect(Number.isInteger(result.overrideCents)).toBe(true);
        expect(Number.isInteger(result.subPartnerCommissionCents)).toBe(true);
        expect(Number.isInteger(result.platformNetCents)).toBe(true);

        // 3. Non-negativity Invariant
        expect(result.overrideCents).toBeGreaterThanOrEqual(0);
        expect(result.subPartnerCommissionCents).toBeGreaterThanOrEqual(0);
        expect(result.platformNetCents).toBeGreaterThanOrEqual(0);

        // 4. Master rate enforcement
        if (hasActiveMaster) {
          expect(result.overrideRatePct).toBe(MASTER_CASCADE_OVERRIDE_RATE_PCT);
          expect(result.overrideCents).toBe(
            Math.floor((mrrCents * MASTER_CASCADE_OVERRIDE_RATE_PCT) / 100),
          );
        } else {
          expect(result.overrideRatePct).toBe(0);
          expect(result.overrideCents).toBe(0);
        }

        verifiedCount++;
      }

      expect(verifiedCount).toBe(totalIterations);
    });

    it('Oracle: Zero penny leakage holds for 0 cents, negative cents, and boundary numbers', () => {
      // 0 cents
      const zeroRes = calculateCascadeOverride(0, 28, true);
      expect(zeroRes.overrideCents).toBe(0);
      expect(zeroRes.subPartnerCommissionCents).toBe(0);
      expect(zeroRes.platformNetCents).toBe(0);
      expect(zeroRes.overrideCents + zeroRes.subPartnerCommissionCents + zeroRes.platformNetCents).toBe(0);

      // Negative cents (safe clamping)
      const negRes = calculateCascadeOverride(-500, 35, true);
      expect(negRes.overrideCents).toBe(0);
      expect(negRes.subPartnerCommissionCents).toBe(0);
      expect(negRes.platformNetCents).toBe(0);

      // 1 single cent transaction with 28% commission and 5% override
      // floor(1 * 28 / 100) = 0
      // floor(1 * 5 / 100) = 0
      // platform = 1 - 0 - 0 = 1
      const singleCent = calculateCascadeOverride(1, 28, true);
      expect(singleCent.subPartnerCommissionCents).toBe(0);
      expect(singleCent.overrideCents).toBe(0);
      expect(singleCent.platformNetCents).toBe(1);
      expect(singleCent.overrideCents + singleCent.subPartnerCommissionCents + singleCent.platformNetCents).toBe(1);

      // 19 cents with 35% commission and 5% override
      // floor(19 * 35 / 100) = floor(6.65) = 6
      // floor(19 * 5 / 100) = floor(0.95) = 0
      // platform = 19 - 6 - 0 = 13
      const odd19 = calculateCascadeOverride(19, 35, true);
      expect(odd19.subPartnerCommissionCents).toBe(6);
      expect(odd19.overrideCents).toBe(0);
      expect(odd19.platformNetCents).toBe(13);
      expect(odd19.overrideCents + odd19.subPartnerCommissionCents + odd19.platformNetCents).toBe(19);

      // 99 cents with 28% commission and 5% override
      // floor(99 * 28 / 100) = floor(27.72) = 27
      // floor(99 * 5 / 100) = floor(4.95) = 4
      // platform = 99 - 27 - 4 = 68
      const odd99 = calculateCascadeOverride(99, 28, true);
      expect(odd99.subPartnerCommissionCents).toBe(27);
      expect(odd99.overrideCents).toBe(4);
      expect(odd99.platformNetCents).toBe(68);
      expect(odd99.overrideCents + odd99.subPartnerCommissionCents + odd99.platformNetCents).toBe(99);
    });
  });
});
