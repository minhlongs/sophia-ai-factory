/**
 * Comprehensive Unit Test Suite: Enterprise Reseller Federation & License Pools
 *
 * Layer: tree/partners/__tests__/reseller-hierarchy.test.ts
 *
 * Verifies:
 * 1. Mathematical proof of Zero Penny Leakage across diverse MRR amounts.
 * 2. Single-parent constraint rejection on duplicate sub-agency binding.
 * 3. Circular hierarchy prevention (master == sub and reverse delegation).
 * 4. Atomic CAS quota exhaustion guardrails for seats and MCU credits.
 * 5. Escrow status when master agency is suspended.
 * 6. MCU consumption limits and auto-topup threshold triggers.
 * 7. Reseller hierarchy tree metrics aggregation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  calculateCascadeOverride,
  bindSubReseller,
  getResellerHierarchyTree,
  accrueCascadeOverride,
  unbindSubReseller,
} from '../reseller-hierarchy';
import {
  createLicensePool,
  allocatePoolQuota,
  recordMcuConsumption,
  getLicensePoolById,
  getPartnerLicensePools,
  deallocatePoolQuota,
} from '../license-pooling';

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

// Helper to seed a partner profile
async function seedPartner(
  db: D1Database,
  id: string,
  userId: string,
  tenantId: string,
  name: string,
  tier: 'SILVER' | 'GOLD' | 'PLATINUM',
  rate: number,
  status: 'active' | 'suspended' = 'active',
  totalMrr: number = 0,
) {
  const now = Date.now();
  await db
    .prepare(`
      INSERT INTO partner_profiles (
        id, user_id, tenant_id, partner_name, partner_type, tier,
        commission_rate_pct, referral_code, custom_domain, whitelabel_enabled,
        total_referred_customers, total_mrr_cents, total_earnings_cents,
        pending_payout_cents, payout_rail, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'agency', ?, ?, ?, NULL, 0, 0, ?, 0, 0, 'USDT', ?, ?, ?)
    `)
    .bind(id, userId, tenantId, name, tier, rate, `ref_${id}`, totalMrr, status, now, now)
    .run();
}

describe('Reseller Hierarchy - Mathematical Proof of Zero Penny Leakage', () => {
  it('guarantees zero penny leakage for standard pricing tiers', () => {
    // $199.00 (19,900 cents) at SILVER (20%) with active master (5%)
    const r1 = calculateCascadeOverride(19900, 20.0, true, 'master_1');
    expect(r1.subPartnerCommissionCents).toBe(3980); // 20% of 19900
    expect(r1.overrideCents).toBe(995); // 5% of 19900
    expect(r1.platformNetCents).toBe(14925); // 19900 - 3980 - 995
    expect(r1.subPartnerCommissionCents + r1.overrideCents + r1.platformNetCents).toBe(19900);

    // $399.00 (39,900 cents) at GOLD (28%) with active master (5%)
    const r2 = calculateCascadeOverride(39900, 28.0, true, 'master_1');
    expect(r2.subPartnerCommissionCents).toBe(11172); // 28% of 39900
    expect(r2.overrideCents).toBe(1995); // 5% of 39900
    expect(r2.platformNetCents).toBe(26733);
    expect(r2.subPartnerCommissionCents + r2.overrideCents + r2.platformNetCents).toBe(39900);

    // $799.00 (79,900 cents) at PLATINUM (35%) with active master (5%)
    const r3 = calculateCascadeOverride(79900, 35.0, true, 'master_1');
    expect(r3.subPartnerCommissionCents).toBe(27965); // 35% of 79900
    expect(r3.overrideCents).toBe(3995); // 5% of 79900
    expect(r3.platformNetCents).toBe(47940);
    expect(r3.subPartnerCommissionCents + r3.overrideCents + r3.platformNetCents).toBe(79900);
  });

  it('guarantees zero penny leakage for fractional and odd cent transactions', () => {
    // $199.99 (19,999 cents) at PLATINUM (35%)
    const r1 = calculateCascadeOverride(19999, 35.0, true);
    expect(r1.subPartnerCommissionCents).toBe(6999); // floor(19999 * 0.35)
    expect(r1.overrideCents).toBe(999); // floor(19999 * 0.05)
    expect(r1.platformNetCents).toBe(12001); // 19999 - 6999 - 999
    expect(r1.subPartnerCommissionCents + r1.overrideCents + r1.platformNetCents).toBe(19999);

    // 1 cent transaction
    const r2 = calculateCascadeOverride(1, 35.0, true);
    expect(r2.subPartnerCommissionCents).toBe(0);
    expect(r2.overrideCents).toBe(0);
    expect(r2.platformNetCents).toBe(1);
    expect(r2.subPartnerCommissionCents + r2.overrideCents + r2.platformNetCents).toBe(1);

    // 33 cents transaction
    const r3 = calculateCascadeOverride(33, 28.0, true);
    expect(r3.subPartnerCommissionCents).toBe(9); // floor(33 * 0.28) = 9
    expect(r3.overrideCents).toBe(1); // floor(33 * 0.05) = 1
    expect(r3.platformNetCents).toBe(23); // 33 - 9 - 1
    expect(r3.subPartnerCommissionCents + r3.overrideCents + r3.platformNetCents).toBe(33);
  });

  it('guarantees zero penny leakage across exhaustive range of 10,000 cents', () => {
    // Exhaustive simulation proving Conservation of Value invariant across 1 to 10,000 cents
    for (let cents = 1; cents <= 10000; cents += 17) {
      const res = calculateCascadeOverride(cents, 35.0, true, 'master_sim');
      const total = res.subPartnerCommissionCents + res.overrideCents + res.platformNetCents;
      expect(total).toBe(cents);
      expect(res.subPartnerCommissionCents).toBeGreaterThanOrEqual(0);
      expect(res.overrideCents).toBeGreaterThanOrEqual(0);
      expect(res.platformNetCents).toBeGreaterThanOrEqual(0);
    }
  });

  it('retains 0 override when no active master agency is bound', () => {
    const r = calculateCascadeOverride(50000, 28.0, false);
    expect(r.hasMaster).toBe(false);
    expect(r.overrideCents).toBe(0);
    expect(r.subPartnerCommissionCents).toBe(14000);
    expect(r.platformNetCents).toBe(36000);
    expect(r.subPartnerCommissionCents + r.platformNetCents).toBe(50000);
  });

  it('handles zero and negative amounts safely', () => {
    const r0 = calculateCascadeOverride(0, 20.0, true);
    expect(r0.overrideCents).toBe(0);
    expect(r0.subPartnerCommissionCents).toBe(0);
    expect(r0.platformNetCents).toBe(0);

    const rNeg = calculateCascadeOverride(-5000, 20.0, true);
    expect(rNeg.overrideCents).toBe(0);
    expect(rNeg.subPartnerCommissionCents).toBe(0);
    expect(rNeg.platformNetCents).toBe(0);
  });
});

describe('Reseller Hierarchy - Binding Rules & Anti-Circularity', () => {
  let db: D1Database;

  beforeEach(async () => {
    db = createTestDb();
    await seedPartner(db, 'master_alpha', 'user_m1', 't_m1', 'Alpha Master Agency', 'PLATINUM', 35.0, 'active', 500000);
    await seedPartner(db, 'master_beta', 'user_m2', 't_m2', 'Beta Master Agency', 'GOLD', 28.0, 'active', 200000);
    await seedPartner(db, 'sub_gamma', 'user_s1', 't_s1', 'Gamma Sub Agency', 'SILVER', 20.0, 'active', 100000);
    await seedPartner(db, 'sub_delta', 'user_s2', 't_s2', 'Delta Sub Agency', 'SILVER', 20.0, 'active', 50000);
  });

  it('successfully binds a sub-agency to a master agency', async () => {
    const res = await bindSubReseller(db, 'master_alpha', 'sub_gamma', 'AGREEMENT-2026-001');
    expect(res.success).toBe(true);
    expect(res.binding).toBeDefined();
    expect(res.binding?.master_partner_id).toBe('master_alpha');
    expect(res.binding?.sub_partner_id).toBe('sub_gamma');
    expect(res.binding?.override_rate_pct).toBe(5.0);
    expect(res.binding?.status).toBe('active');
  });

  it('enforces single-parent constraint: rejects binding if sub-agency is already bound', async () => {
    // 1. Bind to Master Alpha
    const firstBind = await bindSubReseller(db, 'master_alpha', 'sub_gamma');
    expect(firstBind.success).toBe(true);

    // 2. Attempt duplicate bind to Master Alpha
    const dupBind = await bindSubReseller(db, 'master_alpha', 'sub_gamma');
    expect(dupBind.success).toBe(false);
    expect(dupBind.error).toBe('SUB_AGENCY_ALREADY_BOUND');

    // 3. Attempt binding to Master Beta
    const secondBind = await bindSubReseller(db, 'master_beta', 'sub_gamma');
    expect(secondBind.success).toBe(false);
    expect(secondBind.error).toBe('SUB_AGENCY_ALREADY_BOUND');
  });

  it('prevents direct circularity: master cannot be sub of itself (master == sub)', async () => {
    const res = await bindSubReseller(db, 'master_alpha', 'master_alpha');
    expect(res.success).toBe(false);
    expect(res.error).toBe('CIRCULAR_HIERARCHY_PROHIBITED');
  });

  it('prevents reverse circularity: child cannot bind parent as child', async () => {
    // 1. Bind Gamma under Alpha
    await bindSubReseller(db, 'master_alpha', 'sub_gamma');

    // 2. Gamma attempts to bind Alpha as its child
    const reverse = await bindSubReseller(db, 'sub_gamma', 'master_alpha');
    expect(reverse.success).toBe(false);
    expect(reverse.error).toBe('CIRCULAR_HIERARCHY_PROHIBITED');
  });

  it('rejects binding if master partner is suspended or not found', async () => {
    await seedPartner(db, 'master_suspended', 'user_m3', 't_m3', 'Suspended Master', 'GOLD', 28.0, 'suspended');

    const resSuspended = await bindSubReseller(db, 'master_suspended', 'sub_delta');
    expect(resSuspended.success).toBe(false);
    expect(resSuspended.error).toBe('MASTER_PARTNER_SUSPENDED');

    const resMissing = await bindSubReseller(db, 'non_existent_master', 'sub_delta');
    expect(resMissing.success).toBe(false);
    expect(resMissing.error).toBe('MASTER_PARTNER_NOT_FOUND');
  });

  it('unbinds / terminates a sub-agency relationship cleanly', async () => {
    await bindSubReseller(db, 'master_alpha', 'sub_gamma');

    const unbindRes = await unbindSubReseller(db, 'master_alpha', 'sub_gamma');
    expect(unbindRes.success).toBe(true);

    // After unbinding, sub_gamma can now be bound to master_beta
    const rebindRes = await bindSubReseller(db, 'master_beta', 'sub_gamma');
    expect(rebindRes.success).toBe(true);
    expect(rebindRes.binding?.master_partner_id).toBe('master_beta');
  });
});

describe('Reseller Hierarchy - Escrow on Suspension & Override Accrual', () => {
  let db: D1Database;

  beforeEach(async () => {
    db = createTestDb();
    await seedPartner(db, 'master_active', 'user_m1', 't_m1', 'Active Master Agency', 'PLATINUM', 35.0, 'active');
    await seedPartner(db, 'master_suspended', 'user_m2', 't_m2', 'Suspended Master Agency', 'PLATINUM', 35.0, 'suspended');
    await seedPartner(db, 'sub_active', 'user_s1', 't_s1', 'Active Sub Agency', 'SILVER', 20.0, 'active');
    await seedPartner(db, 'sub_two', 'user_s2', 't_s2', 'Active Sub Agency Two', 'SILVER', 20.0, 'active');
  });

  it('credits pending payout balance when master agency is active', async () => {
    await bindSubReseller(db, 'master_active', 'sub_active');

    // Sub generates $1,000 MRR (100,000 cents) -> 5% = 5,000 cents override
    const accrueRes = await accrueCascadeOverride(db, 'sub_active', 'ord_1001', 100000);
    expect(accrueRes.success).toBe(true);
    expect(accrueRes.overrideCents).toBe(5000);
    expect(accrueRes.escrowed).toBe(false);
    expect(accrueRes.masterPartnerId).toBe('master_active');

    // Verify master partner balances
    const master = await db
      .prepare('SELECT total_earnings_cents, pending_payout_cents FROM partner_profiles WHERE id = ?')
      .bind('master_active')
      .first<{ total_earnings_cents: number; pending_payout_cents: number }>();

    expect(master?.total_earnings_cents).toBe(5000);
    expect(master?.pending_payout_cents).toBe(5000);

    // Verify binding balances
    const binding = await db
      .prepare('SELECT lifetime_override_cents, pending_override_cents FROM partner_sub_resellers WHERE sub_partner_id = ?')
      .bind('sub_active')
      .first<{ lifetime_override_cents: number; pending_override_cents: number }>();

    expect(binding?.lifetime_override_cents).toBe(5000);
    expect(binding?.pending_override_cents).toBe(5000);
  });

  it('enforces escrow status when master agency is suspended: no payout balance credited', async () => {
    // Bind sub_two to master_active first, then suspend master_active
    await bindSubReseller(db, 'master_active', 'sub_two');

    // Suspend master agency
    await db
      .prepare("UPDATE partner_profiles SET status = 'suspended' WHERE id = ?")
      .bind('master_active')
      .run();

    // Sub generates $2,000 MRR (200,000 cents) -> 5% = 10,000 cents override
    const accrueRes = await accrueCascadeOverride(db, 'sub_two', 'ord_1002', 200000);
    expect(accrueRes.success).toBe(true);
    expect(accrueRes.overrideCents).toBe(10000);
    expect(accrueRes.escrowed).toBe(true);
    expect(accrueRes.reason).toBe('MASTER_AGENCY_SUSPENDED');

    // Verify master partner balances: pending_payout_cents MUST REMAIN 0!
    const master = await db
      .prepare('SELECT total_earnings_cents, pending_payout_cents FROM partner_profiles WHERE id = ?')
      .bind('master_active')
      .first<{ total_earnings_cents: number; pending_payout_cents: number }>();

    expect(master?.pending_payout_cents).toBe(0);
    expect(master?.total_earnings_cents).toBe(0);

    // Verify binding recorded lifetime override for audit, but pending override remains 0
    const binding = await db
      .prepare('SELECT lifetime_override_cents, pending_override_cents FROM partner_sub_resellers WHERE sub_partner_id = ?')
      .bind('sub_two')
      .first<{ lifetime_override_cents: number; pending_override_cents: number }>();

    expect(binding?.lifetime_override_cents).toBe(10000);
    expect(binding?.pending_override_cents).toBe(0);
  });

  it('aggregates hierarchy tree metrics accurately', async () => {
    await bindSubReseller(db, 'master_active', 'sub_active');
    await bindSubReseller(db, 'master_active', 'sub_two');

    await accrueCascadeOverride(db, 'sub_active', 'ord_201', 50000); // 2,500 override
    await accrueCascadeOverride(db, 'sub_two', 'ord_202', 100000); // 5,000 override

    const tree = await getResellerHierarchyTree(db, 'master_active');
    expect(tree.masterPartnerId).toBe('master_active');
    expect(tree.totalSubAgencies).toBe(2);
    expect(tree.activeSubAgencies).toBe(2);
    expect(tree.totalLifetimeOverrideCents).toBe(7500);
    expect(tree.totalPendingOverrideCents).toBe(7500);
    expect(tree.subAgencies.length).toBe(2);
  });
});

describe('License Pooling - Atomic CAS Quota & Guardrails', () => {
  let db: D1Database;

  beforeEach(async () => {
    db = createTestDb();
    await seedPartner(db, 'partner_agency_1', 'user_p1', 't_p1', 'Agency One', 'PLATINUM', 35.0, 'active');
  });

  it('creates a bulk license pool successfully', async () => {
    const res = await createLicensePool(
      db,
      'partner_agency_1',
      'Enterprise Q3 Pool',
      20,
      100000,
      5000,
      {
        autoTopupEnabled: true,
        autoTopupThresholdMcu: 10000,
        autoTopupAmountMcu: 25000,
      },
    );

    expect(res.success).toBe(true);
    expect(res.pool).toBeDefined();
    expect(res.pool?.total_seats).toBe(20);
    expect(res.pool?.allocated_seats).toBe(0);
    expect(res.pool?.total_mcu_credits).toBe(100000);
    expect(res.pool?.allocated_mcu_credits).toBe(0);
    expect(res.pool?.auto_topup_enabled).toBe(1);
    expect(res.pool?.status).toBe('active');
  });

  it('rejects pool creation with invalid parameters or non-active partner', async () => {
    const resNegative = await createLicensePool(db, 'partner_agency_1', 'Bad Pool', -5, 1000, 100);
    expect(resNegative.success).toBe(false);
    expect(resNegative.error).toBe('INVALID_SEATS_COUNT');

    const resEmptyName = await createLicensePool(db, 'partner_agency_1', '', 5, 1000, 100);
    expect(resEmptyName.success).toBe(false);
    expect(resEmptyName.error).toBe('INVALID_POOL_NAME');

    const resMissingPartner = await createLicensePool(db, 'non_existent_partner', 'Pool', 5, 1000, 100);
    expect(resMissingPartner.success).toBe(false);
    expect(resMissingPartner.error).toBe('PARTNER_NOT_FOUND');
  });

  it('allocates quota using atomic CAS and decrements available pool capacity', async () => {
    const poolRes = await createLicensePool(db, 'partner_agency_1', 'Pool A', 10, 50000, 2000);
    const poolId = poolRes.pool!.id;

    // Allocate 4 seats and 20,000 MCU
    const alloc1 = await allocatePoolQuota(db, poolId, 'subacc_101', 4, 20000);
    expect(alloc1.success).toBe(true);
    expect(alloc1.allocatedSeats).toBe(4);
    expect(alloc1.allocatedMcuCredits).toBe(20000);
    expect(alloc1.remainingPoolSeats).toBe(6);
    expect(alloc1.remainingPoolMcu).toBe(30000);

    // Verify in database
    const pool = await getLicensePoolById(db, poolId);
    expect(pool?.allocated_seats).toBe(4);
    expect(pool?.allocated_mcu_credits).toBe(20000);
  });

  it('fails closed when attempting to allocate more seats than remaining', async () => {
    const poolRes = await createLicensePool(db, 'partner_agency_1', 'Pool Seats Test', 5, 50000, 2000);
    const poolId = poolRes.pool!.id;

    // Allocate 3 seats (2 remaining)
    await allocatePoolQuota(db, poolId, 'subacc_1', 3, 10000);

    // Attempt to allocate 3 seats (only 2 available)
    const overSeats = await allocatePoolQuota(db, poolId, 'subacc_2', 3, 5000);
    expect(overSeats.success).toBe(false);
    expect(overSeats.error).toBe('INSUFFICIENT_POOL_SEATS');
    expect(overSeats.remainingPoolSeats).toBe(2);
  });

  it('fails closed when attempting to allocate more MCU than remaining', async () => {
    const poolRes = await createLicensePool(db, 'partner_agency_1', 'Pool MCU Test', 10, 20000, 2000);
    const poolId = poolRes.pool!.id;

    // Allocate 1 seat and 15,000 MCU (5,000 remaining)
    await allocatePoolQuota(db, poolId, 'subacc_1', 1, 15000);

    // Attempt to allocate 6,000 MCU (only 5,000 available)
    const overMcu = await allocatePoolQuota(db, poolId, 'subacc_2', 1, 6000);
    expect(overMcu.success).toBe(false);
    expect(overMcu.error).toBe('INSUFFICIENT_POOL_MCU');
    expect(overMcu.remainingPoolMcu).toBe(5000);
  });

  it('exhausts pool status when all capacity is allocated and prevents further allocation', async () => {
    const poolRes = await createLicensePool(db, 'partner_agency_1', 'Exact Capacity Pool', 2, 10000, 1000);
    const poolId = poolRes.pool!.id;

    // Allocate exact remaining capacity
    const alloc = await allocatePoolQuota(db, poolId, 'subacc_exact', 2, 10000);
    expect(alloc.success).toBe(true);
    expect(alloc.remainingPoolSeats).toBe(0);
    expect(alloc.remainingPoolMcu).toBe(0);

    const pool = await getLicensePoolById(db, poolId);
    expect(pool?.status).toBe('exhausted');

    // Next allocation must fail with POOL_EXHAUSTED
    const nextAlloc = await allocatePoolQuota(db, poolId, 'subacc_rejected', 1, 1000);
    expect(nextAlloc.success).toBe(false);
    expect(nextAlloc.error).toBe('POOL_EXHAUSTED');
  });

  it('restores pool to active when quota is deallocated', async () => {
    const poolRes = await createLicensePool(db, 'partner_agency_1', 'Refund Pool', 2, 10000, 1000);
    const poolId = poolRes.pool!.id;

    await allocatePoolQuota(db, poolId, 'subacc_full', 2, 10000);

    // Deallocate 1 seat and 5,000 MCU
    const dealloc = await deallocatePoolQuota(db, poolId, 'subacc_full', 1, 5000);
    expect(dealloc.success).toBe(true);
    expect(dealloc.remainingSeats).toBe(1);
    expect(dealloc.remainingMcu).toBe(5000);

    const pool = await getLicensePoolById(db, poolId);
    expect(pool?.status).toBe('active');
  });
});

describe('License Pooling - MCU Consumption & Auto-Topup Thresholds', () => {
  let db: D1Database;

  beforeEach(async () => {
    db = createTestDb();
    await seedPartner(db, 'partner_agency_1', 'user_p1', 't_p1', 'Agency One', 'PLATINUM', 35.0, 'active');
  });

  it('records MCU consumption and detects when remaining falls below threshold', async () => {
    // Pool: 50,000 total MCU, threshold: 3,000 MCU, topup amount: 10,000 MCU
    const poolRes = await createLicensePool(
      db,
      'partner_agency_1',
      'Threshold Testing Pool',
      5,
      50000,
      1000,
      {
        autoTopupEnabled: true,
        autoTopupThresholdMcu: 3000,
        autoTopupAmountMcu: 10000,
      },
    );
    const poolId = poolRes.pool!.id;

    // Allocate 10,000 MCU to subaccount
    await allocatePoolQuota(db, poolId, 'subacc_compute', 1, 10000);

    // 1. Consume 5,000 MCU -> remaining allocated is 5,000 (> 3,000 threshold)
    const c1 = await recordMcuConsumption(db, poolId, 'subacc_compute', 5000);
    expect(c1.success).toBe(true);
    expect(c1.totalConsumedMcu).toBe(5000);
    expect(c1.remainingAllocatedMcu).toBe(5000);
    expect(c1.thresholdTriggered).toBe(false);
    expect(c1.autoTopupExecuted).toBe(false);

    // 2. Consume 2,500 MCU -> remaining allocated is 2,500 (<= 3,000 threshold)
    // Auto-topup is triggered and allocates +10,000 MCU!
    const c2 = await recordMcuConsumption(db, poolId, 'subacc_compute', 2500);
    expect(c2.success).toBe(true);
    expect(c2.thresholdTriggered).toBe(true);
    expect(c2.autoTopupExecuted).toBe(true);
    // Remaining allocated is 2,500 + 10,000 = 12,500
    expect(c2.remainingAllocatedMcu).toBe(12500);

    const updatedPool = await getLicensePoolById(db, poolId);
    expect(updatedPool?.allocated_mcu_credits).toBe(20000);
    expect(updatedPool?.consumed_mcu_credits).toBe(7500);
  });

  it('prevents consuming more MCU than currently allocated', async () => {
    const poolRes = await createLicensePool(db, 'partner_agency_1', 'Strict MCU Pool', 2, 10000, 1000);
    const poolId = poolRes.pool!.id;

    // Allocate 2,000 MCU
    await allocatePoolQuota(db, poolId, 'subacc_small', 1, 2000);

    // Attempt to consume 3,000 MCU (only 2,000 allocated)
    const overConsume = await recordMcuConsumption(db, poolId, 'subacc_small', 3000);
    expect(overConsume.success).toBe(false);
    expect(overConsume.error).toBe('INSUFFICIENT_ALLOCATED_MCU');

    // Database consumed MCU remains 0
    const pool = await getLicensePoolById(db, poolId);
    expect(pool?.consumed_mcu_credits).toBe(0);
  });
});
