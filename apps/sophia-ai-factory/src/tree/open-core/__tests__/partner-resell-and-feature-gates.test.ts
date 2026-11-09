/** @vitest-environment node */

/**
 * Partner-Resell Multi-Tenant Isolation & Server-Side Commercial Feature Gate Suite
 *
 * Verifies:
 * 1. Server-side commercial feature gate enforcement (`enforceCommercialFeatureForUser`)
 *    across Community, Cloud SaaS, and Enterprise editions.
 * 2. Multi-tenant affiliate ledger isolation (`migrations/0500_affiliate_multi_tenant_isolation.sql`):
 *    commission attribution (`recordAffiliateCommission`), payout disbursement
 *    (`createPayoutDisbursement`), and commission-payout linking (`linkCommissionsToPayout`)
 *    cannot cross-contaminate across tenants (`tenant-alpha` vs `tenant-beta`).
 *
 * Layer: tree/open-core/__tests__
 * @module tree/open-core/__tests__/partner-resell-and-feature-gates.test
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@cloudflare/workers-types';
import { enforceCommercialFeatureForUser } from '@/seed/config/enforce-commercial-feature-server';
import { recordAffiliateCommission } from '@/tree/affiliates/attribution/attribution-engine';
import { createPayoutDisbursement } from '@/tree/affiliates/ledger/payout-disbursement';
import { linkCommissionsToPayout } from '@/tree/affiliates/ledger/commission-payout-linker';

interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...p: unknown[]): unknown;
    all(...p: unknown[]): unknown[];
    run(...p: unknown[]): { changes: number };
  };
}

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as { DatabaseSync: new (path: string) => SqliteDb };

function createMultiTenantAffiliateDb(): { rawDb: SqliteDb; d1: D1Database } {
  const rawDb = new DatabaseSync(':memory:');
  rawDb.exec(`
    CREATE TABLE affiliate_partners (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      partner_code TEXT NOT NULL UNIQUE,
      tier TEXT NOT NULL DEFAULT 'STARTER',
      commission_rate_pct INTEGER NOT NULL DEFAULT 25,
      parent_partner_id TEXT,
      pending_payout_cents INTEGER NOT NULL DEFAULT 0,
      total_earnings_cents INTEGER NOT NULL DEFAULT 0,
      payout_rail TEXT NOT NULL DEFAULT 'USDT',
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE affiliate_referrals (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      referred_user_id TEXT NOT NULL UNIQUE,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      referral_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'converted',
      clicked_at INTEGER NOT NULL,
      converted_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE affiliate_commissions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      event_key TEXT NOT NULL UNIQUE,
      partner_id TEXT NOT NULL,
      referral_id TEXT,
      payment_provider TEXT NOT NULL,
      payment_id TEXT NOT NULL,
      order_id TEXT,
      customer_user_id TEXT NOT NULL,
      gross_amount_cents INTEGER NOT NULL,
      commission_rate_pct INTEGER NOT NULL,
      commission_cents INTEGER NOT NULL,
      tier_level TEXT NOT NULL DEFAULT 'TIER1',
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'pending',
      hold_days INTEGER NOT NULL DEFAULT 14,
      payable_at INTEGER,
      payout_id TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      metadata_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE affiliate_payouts (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      payout_reference TEXT NOT NULL UNIQUE,
      partner_id TEXT NOT NULL,
      rail TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      destination_encrypted TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      commission_count INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return {
    rawDb,
    d1: makeD1(rawDb as unknown as Parameters<typeof makeD1>[0]) as unknown as D1Database,
  };
}

describe('Partner-Resell & Server-Side Commercial Feature Gate Suite', () => {
  it('blocks CLOUD_SAAS and ENTERPRISE_MASTER features on community self-host', async () => {
    const socialDenied = await enforceCommercialFeatureForUser(
      'user-comm-1',
      'managed_social_oauth_relay',
      { resolvedTier: 'BASIC', envOverrides: { sophiaEdition: 'community' } },
    );
    expect(socialDenied.ok).toBe(false);
    if (!socialDenied.ok) {
      expect(socialDenied.error.reasonCode).toBe('REQUIRES_CLOUD_SUBSCRIPTION');
      expect(socialDenied.error.code).toBe('REQUIRES_CLOUD_SUBSCRIPTION');
      expect(socialDenied.error.message).toContain('/');
    }

    const domainDenied = await enforceCommercialFeatureForUser(
      'user-comm-1',
      'custom_domain_provisioning',
      { resolvedTier: 'ENTERPRISE', envOverrides: { sophiaEdition: 'community' } },
    );
    expect(domainDenied.ok).toBe(false);
    if (!domainDenied.ok) {
      expect(domainDenied.error.reasonCode).toBe('REQUIRES_ENTERPRISE_OR_MASTER_LICENSE');
    }
  });

  it('unlocks CLOUD_SAAS features on cloud edition when user tier meets minPaidTier', async () => {
    const payoutGranted = await enforceCommercialFeatureForUser(
      'user-cloud-basic',
      'affiliate_attribution_payouts',
      { resolvedTier: 'BASIC', envOverrides: { sophiaEdition: 'cloud' } },
    );
    expect(payoutGranted.ok).toBe(true);

    const socialUnderTier = await enforceCommercialFeatureForUser(
      'user-cloud-basic',
      'managed_social_oauth_relay',
      { resolvedTier: 'BASIC', envOverrides: { sophiaEdition: 'cloud' } },
    );
    expect(socialUnderTier.ok).toBe(false);
    if (!socialUnderTier.ok) {
      expect(socialUnderTier.error.reasonCode).toBe('REQUIRES_CLOUD_SUBSCRIPTION');
    }

    const socialGranted = await enforceCommercialFeatureForUser(
      'user-cloud-premium',
      'managed_social_oauth_relay',
      { resolvedTier: 'PREMIUM', envOverrides: { sophiaEdition: 'cloud' } },
    );
    expect(socialGranted.ok).toBe(true);
  });

  it('isolates affiliate commissions and payout linking strictly per tenant_id', async () => {
    const { rawDb, d1 } = createMultiTenantAffiliateDb();
    const now = Date.now();
    const pastHold = now - 20 * 86_400_000;

    rawDb.exec(`
      INSERT INTO affiliate_partners (id, user_id, partner_code, commission_rate_pct, created_at, updated_at)
      VALUES ('partner-shared', 'u-partner', 'SHARED25', 25, ${now}, ${now});
      INSERT INTO affiliate_referrals (id, partner_id, referred_user_id, tenant_id, referral_code, clicked_at, created_at, updated_at)
      VALUES
        ('ref-alpha', 'partner-shared', 'buyer-alpha', 'tenant-alpha', 'SHARED25', ${now}, ${now}, ${now}),
        ('ref-beta', 'partner-shared', 'buyer-beta', 'tenant-beta', 'SHARED25', ${now}, ${now}, ${now});
    `);

    const attrAlpha = await recordAffiliateCommission(
      {
        customerId: 'buyer-alpha',
        provider: 'nowpayments',
        paymentId: 'np_alpha_1',
        grossAmountCents: 40_000,
        customerTier: 'BASIC',
      },
      d1,
    );
    const attrBeta = await recordAffiliateCommission(
      {
        customerId: 'buyer-beta',
        provider: 'nowpayments',
        paymentId: 'np_beta_1',
        grossAmountCents: 80_000,
        customerTier: 'BASIC',
      },
      d1,
    );
    expect(attrAlpha.attributed).toBe(true);
    expect(attrBeta.attributed).toBe(true);

    rawDb.exec(`
      UPDATE affiliate_commissions
      SET status = 'payable', payable_at = ${pastHold}
      WHERE payment_id IN ('np_alpha_1', 'np_beta_1');
    `);

    const payoutAlpha = await createPayoutDisbursement({
      d1,
      partnerId: 'partner-shared',
      tenantId: 'tenant-alpha',
      rail: 'USDT',
      amountCents: 8_000,
      destinationEncrypted: 'enc_alpha',
    });
    expect(payoutAlpha.success).toBe(true);

    const linkedAlpha = await linkCommissionsToPayout({
      d1,
      payoutId: payoutAlpha.payoutId!,
      partnerId: 'partner-shared',
      tenantId: 'tenant-alpha',
      maturedBeforeMs: now,
    });
    expect(linkedAlpha.reservedCount).toBe(1);

    const betaCommission = rawDb
      .prepare(`SELECT tenant_id, payout_id FROM affiliate_commissions WHERE payment_id = 'np_beta_1'`)
      .get() as { tenant_id: string; payout_id: string | null };
    expect(betaCommission.tenant_id).toBe('tenant-beta');
    expect(betaCommission.payout_id).toBeNull();
  });
});
