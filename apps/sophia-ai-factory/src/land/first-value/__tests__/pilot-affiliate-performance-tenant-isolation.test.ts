// @vitest-environment node
/**
 * Adversarial Security, Tenant Isolation & Migration Regression Suite for Issue #213.
 *
 * Verifies:
 * A. Migration 0522 (`0522_pilot_affiliate_performance_tenant_isolation.sql`):
 *    - Upgrade from existing 0520 schema with pre-populated rows (row-count + financial-total parity)
 *    - Clean database initialization (both standalone 0522 and 0520 -> 0522)
 *    - Idempotency on re-application
 * B. All 8 adversarial tenant-isolation scenarios:
 *    1. Two users within the same organization using the same `external_ref_id`
 *    2. Two users in different organizations using the same `external_ref_id`
 *    3. Unauthorized readback attempt
 *    4. Duplicate report submissions (idempotency — zero accidental duplicate credits)
 *    5. Concurrent submissions (same-user race + cross-user same-org race)
 *    6. Deleted or revoked membership
 *    7. Forged organization/user identifiers
 *    8. Legitimate organization administrator access (ADMIN/OWNER vs MEMBER/outsider)
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { D1Database } from '@cloudflare/workers-types';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildSimulatedAffiliateCampaignPack } from '@/seed/ai/affiliate-campaign-prompt';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite-d1';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, verifyCsrfToken } from '@/seed/security/csrf';
import {
  getPartnerPerformanceEntryByRef,
  insertPilotAffiliateCampaign,
  insertPilotAffiliateOffer,
  listPartnerPerformanceEntries,
  listPartnerPerformanceEntriesForOrgAdmin,
  recordPartnerPerformanceReport,
} from '@/tree/first-value/pilot-affiliate-studio-repo';
import {
  handleFirstValueGet,
  handleFirstValuePost,
  type FirstValueHttpDeps,
} from '@/land/first-value/first-value-http-handler';

const CSRF_TOKEN = 'csrf-issue213-isolation-token-0123456789abcdef';
const SIGNING_SECRET = 'issue213-signing-secret-32-bytes!';
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../../migrations');

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
}

function makeReq(method: 'GET' | 'POST', url: string, body?: unknown): NextRequest {
  const headers = new Headers();
  if (method === 'POST') {
    headers.set('content-type', 'application/json');
    headers.set('cookie', `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`);
    headers.set(CSRF_HEADER_NAME, CSRF_TOKEN);
  }
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function seedOfferAndCampaign(
  d1: D1Database,
  args: { orgId: string; userId: string; offerId: string; campaignId: string },
): Promise<void> {
  const nowIso = '2026-11-25T10:00:00.000Z';
  await insertPilotAffiliateOffer(d1, {
    id: args.offerId,
    orgId: args.orgId,
    userId: args.userId,
    vertical: 'saas',
    productName: 'Acme SaaS',
    officialWebsiteUrl: 'https://acme.example.com',
    referralUrl: `https://acme.example.com/?ref=${args.userId}`,
    commissionTerms: '30% recurring',
    targetAudience: 'Founders',
    targetMarket: 'US',
    productInfoSource: 'manual',
    createdAtIso: nowIso,
  });

  const pack = buildSimulatedAffiliateCampaignPack(
    {
      vertical: 'saas',
      productName: 'Acme SaaS',
      officialWebsiteUrl: 'https://acme.example.com',
      referralUrl: `https://acme.example.com/?ref=${args.userId}`,
      commissionTerms: '30% recurring',
      targetAudience: 'Founders',
      targetMarket: 'US',
      productInfoSource: 'manual',
    },
    30,
    'en',
  );

  await insertPilotAffiliateCampaign(d1, {
    id: args.campaignId,
    orgId: args.orgId,
    userId: args.userId,
    offerId: args.offerId,
    idempotencyKey: `idem_${args.campaignId}`,
    payloadHash: `hash_${args.campaignId}`,
    vertical: 'saas',
    campaignName: pack.campaignTitle,
    referralUrl: `https://acme.example.com/?ref=${args.userId}`,
    targetMarket: 'US',
    provenance: 'fixture_simulated',
    provenanceLabel: 'Simulated Fixture',
    pack,
    estimatedAiCostMicroUsd: 1000,
    nowIso,
  });
}

describe('Migration 0522: pilot_affiliate_performance_entries tenant isolation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-mig0522-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('upgrades existing 0520 schema with pre-populated rows preserving row counts and financial totals', async () => {
    const sqlite = new NodeSqliteD1Database(path.join(tmpDir, 'upgrade.sqlite'));
    await sqlite.exec(readMigration('0520_pilot_affiliate_revenue_studio.sql'));

    // Pre-populate rows under legacy 0520 schema
    await sqlite
      .prepare(
        `INSERT INTO pilot_affiliate_performance_entries
         (id, org_id, user_id, campaign_id, offer_id, report_source, report_period, external_ref_id,
          clicks_count, signups_count, qualified_conversions, pending_commission_cents,
          confirmed_commission_cents, currency, notes, created_at_iso, updated_at_iso)
         VALUES
         ('pperf_1', 'org-1', 'user-a', 'camp-1', 'offer-1', 'partner_portal', '2026-11', 'ref-001', 100, 10, 2, 15000, 32000, 'USD', 'note-a', '2026-11-20T00:00:00Z', '2026-11-20T00:00:00Z'),
         ('pperf_2', 'org-1', 'user-b', 'camp-2', 'offer-2', 'partner_portal', '2026-11', 'ref-002', 50, 5, 1, 5000, 18000, 'USD', 'note-b', '2026-11-21T00:00:00Z', '2026-11-21T00:00:00Z'),
         ('pperf_3', 'org-2', 'user-c', 'camp-3', 'offer-3', 'partner_portal', '2026-11', 'ref-001', 200, 20, 4, 25000, 75000, 'USD', 'note-c', '2026-11-22T00:00:00Z', '2026-11-22T00:00:00Z')`,
      )
      .run();

    const beforeTotals = await sqlite
      .prepare(
        `SELECT COUNT(*) AS cnt,
                SUM(pending_commission_cents) AS sum_pending,
                SUM(confirmed_commission_cents) AS sum_confirmed
         FROM pilot_affiliate_performance_entries`,
      )
      .first<{ cnt: number; sum_pending: number; sum_confirmed: number }>();

    expect(beforeTotals).toEqual({ cnt: 3, sum_pending: 45000, sum_confirmed: 125000 });

    // Apply migration 0522
    await sqlite.exec(readMigration('0522_pilot_affiliate_performance_tenant_isolation.sql'));

    const afterTotals = await sqlite
      .prepare(
        `SELECT COUNT(*) AS cnt,
                SUM(pending_commission_cents) AS sum_pending,
                SUM(confirmed_commission_cents) AS sum_confirmed
         FROM pilot_affiliate_performance_entries`,
      )
      .first<{ cnt: number; sum_pending: number; sum_confirmed: number }>();

    expect(afterTotals).toEqual(beforeTotals);

    // Verify new uniqueness allows user-b in org-1 to use 'ref-001' (previously blocked by 0520)
    const insertUserB = await sqlite
      .prepare(
        `INSERT INTO pilot_affiliate_performance_entries
         (id, org_id, user_id, campaign_id, offer_id, report_source, report_period, external_ref_id,
          clicks_count, signups_count, qualified_conversions, pending_commission_cents,
          confirmed_commission_cents, currency, notes, created_at_iso, updated_at_iso)
         VALUES ('pperf_4', 'org-1', 'user-b', 'camp-2', 'offer-2', 'partner_portal', '2026-11', 'ref-001', 10, 1, 1, 1000, 2000, 'USD', 'user-b-same-ref', '2026-11-25T00:00:00Z', '2026-11-25T00:00:00Z')
         ON CONFLICT (org_id, user_id, external_ref_id) DO NOTHING`,
      )
      .run();

    expect(Number(insertUserB.meta?.changes ?? 0)).toBe(1);

    // Re-applying migration 0522 is idempotent and preserves all 4 rows
    await sqlite.exec(readMigration('0522_pilot_affiliate_performance_tenant_isolation.sql'));
    const afterReapply = await sqlite
      .prepare(`SELECT COUNT(*) AS cnt, SUM(confirmed_commission_cents) AS sum_confirmed FROM pilot_affiliate_performance_entries`)
      .first<{ cnt: number; sum_confirmed: number }>();
    expect(afterReapply).toEqual({ cnt: 4, sum_confirmed: 127000 });
  });

  it('initializes cleanly on an empty database without prior 0520', async () => {
    const sqlite = new NodeSqliteD1Database(path.join(tmpDir, 'clean.sqlite'));
    await sqlite.exec(readMigration('0522_pilot_affiliate_performance_tenant_isolation.sql'));

    const res = await sqlite
      .prepare(
        `INSERT INTO pilot_affiliate_performance_entries
         (id, org_id, user_id, campaign_id, offer_id, report_source, report_period, external_ref_id,
          clicks_count, signups_count, qualified_conversions, pending_commission_cents,
          confirmed_commission_cents, currency, notes, created_at_iso, updated_at_iso)
         VALUES ('pperf_clean', 'org-clean', 'user-clean', 'camp-1', 'offer-1', 'manual', '2026-11', 'ref-clean', 5, 1, 1, 0, 5000, 'USD', NULL, '2026-11-25T00:00:00Z', '2026-11-25T00:00:00Z')
         ON CONFLICT (org_id, user_id, external_ref_id) DO NOTHING`,
      )
      .run();

    expect(Number(res.meta?.changes ?? 0)).toBe(1);
  });
});

describe('Issue #213: Adversarial Affiliate Tenant Isolation Suite (8 Scenarios)', () => {
  let tmpDir: string;
  let sqlite: NodeSqliteD1Database;
  let d1: D1Database;
  let clockMs: number;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-issue213-'));
    sqlite = new NodeSqliteD1Database(path.join(tmpDir, 'tenant-iso.sqlite'));
    for (const mig of [
      '0515_first_value_reviews.sql',
      '0517_customer_pilot_first_value.sql',
      '0519_pilot_support_requests.sql',
      '0520_pilot_affiliate_revenue_studio.sql',
      '0522_pilot_affiliate_performance_tenant_isolation.sql',
    ]) {
      await sqlite.exec(readMigration(mig));
    }

    // Create canonical org_members table for RBAC verification
    await sqlite.exec(`
      CREATE TABLE IF NOT EXISTS org_members (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'MEMBER',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL
      );
    `);

    d1 = sqlite as unknown as D1Database;
    clockMs = 1_795_500_000_000;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeDeps(args: {
    userId: string;
    allowedOrgs: readonly string[];
  }): FirstValueHttpDeps {
    return {
      getD1: async () => d1,
      getCurrentUser: async () => ({ id: args.userId, email: `${args.userId}@example.com` }),
      verifyWorkspaceAccess: async (orgId, uid) =>
        uid === args.userId && args.allowedOrgs.includes(orgId),
      verifyCsrf: verifyCsrfToken,
      listByokProviders: async () => [],
      signingSecret: SIGNING_SECRET,
      nowMs: () => clockMs,
      pilotEnv: {},
    };
  }

  it('Scenario 1: two users within the same organization using the same external_ref_id remain isolated with zero lost commissions', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-shared', userId: 'user-a', offerId: 'off-a', campaignId: 'camp-a' });
    await seedOfferAndCampaign(d1, { orgId: 'org-shared', userId: 'user-b', offerId: 'off-b', campaignId: 'camp-b' });

    const resA = await handleFirstValuePost(
      makeReq('POST', 'https://sophia.example.com/api/first-value', {
        action: 'record_partner_performance',
        orgId: 'org-shared',
        campaignId: 'camp-a',
        reportSource: 'Partner Portal A',
        reportPeriod: '2026-11',
        externalRefId: 'shared-stmt-001',
        clicksCount: 120,
        signupsCount: 12,
        qualifiedConversions: 3,
        pendingCommissionUsd: 120,
        confirmedCommissionUsd: 340,
        currency: 'USD',
        notes: 'CONFIDENTIAL_USER_A_NOTE',
      }),
      makeDeps({ userId: 'user-a', allowedOrgs: ['org-shared'] }),
    );
    expect(resA.status).toBe(201);
    const bodyA = (await resA.json()) as {
      performanceEntry: { userId: string; confirmedCommissionCents: number; notes: string | null };
      idempotentReplay: boolean;
    };
    expect(bodyA.idempotentReplay).toBe(false);
    expect(bodyA.performanceEntry.userId).toBe('user-a');
    expect(bodyA.performanceEntry.confirmedCommissionCents).toBe(34000);

    // User B in the SAME org submits the EXACT SAME externalRefId
    const resB = await handleFirstValuePost(
      makeReq('POST', 'https://sophia.example.com/api/first-value', {
        action: 'record_partner_performance',
        orgId: 'org-shared',
        campaignId: 'camp-b',
        reportSource: 'Partner Portal B',
        reportPeriod: '2026-11',
        externalRefId: 'shared-stmt-001',
        clicksCount: 40,
        signupsCount: 4,
        qualifiedConversions: 1,
        pendingCommissionUsd: 50,
        confirmedCommissionUsd: 90,
        currency: 'USD',
        notes: 'USER_B_OWN_NOTE',
      }),
      makeDeps({ userId: 'user-b', allowedOrgs: ['org-shared'] }),
    );
    expect(resB.status).toBe(201);
    const bodyB = (await resB.json()) as {
      performanceEntry: { userId: string; campaignId: string; confirmedCommissionCents: number; notes: string | null };
      idempotentReplay: boolean;
    };
    expect(bodyB.idempotentReplay).toBe(false);
    expect(bodyB.performanceEntry.userId).toBe('user-b');
    expect(bodyB.performanceEntry.campaignId).toBe('camp-b');
    expect(bodyB.performanceEntry.confirmedCommissionCents).toBe(9000);
    expect(bodyB.performanceEntry.notes).toBe('USER_B_OWN_NOTE');

    // Verify ZERO lost financial records in Domain B workspace_external_commissions
    const domainBRows = await sqlite
      .prepare(
        `SELECT status, SUM(commission_cents) AS total_cents, COUNT(*) AS cnt
         FROM workspace_external_commissions
         WHERE tenant_id = 'org-shared' AND network = 'customer_partner_report'
         GROUP BY status ORDER BY status`,
      )
      .all<{ status: string; total_cents: number; cnt: number }>();

    expect(domainBRows.results).toEqual([
      { status: 'approved', total_cents: 43000, cnt: 2 },
      { status: 'pending', total_cents: 17000, cnt: 2 },
    ]);
  });

  it('Scenario 2: two users in different organizations using the same external_ref_id remain completely isolated', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-alpha', userId: 'user-a', offerId: 'off-a', campaignId: 'camp-a' });
    await seedOfferAndCampaign(d1, { orgId: 'org-beta', userId: 'user-c', offerId: 'off-c', campaignId: 'camp-c' });

    const r1 = await recordPartnerPerformanceReport(d1, {
      id: 'pperf_alpha',
      orgId: 'org-alpha',
      userId: 'user-a',
      campaignId: 'camp-a',
      offerId: 'off-a',
      vertical: 'saas',
      reportSource: 'Alpha Portal',
      reportPeriod: '2026-11',
      externalRefId: 'global-ref-999',
      clicksCount: 10,
      signupsCount: 2,
      qualifiedConversions: 1,
      pendingCommissionCents: 1000,
      confirmedCommissionCents: 5000,
      currency: 'USD',
      notes: 'alpha-secret',
      nowIso: '2026-11-25T10:00:00Z',
      nowMs: clockMs,
    });

    const r2 = await recordPartnerPerformanceReport(d1, {
      id: 'pperf_beta',
      orgId: 'org-beta',
      userId: 'user-c',
      campaignId: 'camp-c',
      offerId: 'off-c',
      vertical: 'saas',
      reportSource: 'Beta Portal',
      reportPeriod: '2026-11',
      externalRefId: 'global-ref-999',
      clicksCount: 20,
      signupsCount: 4,
      qualifiedConversions: 2,
      pendingCommissionCents: 2000,
      confirmedCommissionCents: 8000,
      currency: 'USD',
      notes: 'beta-secret',
      nowIso: '2026-11-25T10:01:00Z',
      nowMs: clockMs + 60_000,
    });

    expect(r1.duplicate).toBe(false);
    expect(r2.duplicate).toBe(false);
    expect(r1.entry.orgId).toBe('org-alpha');
    expect(r2.entry.orgId).toBe('org-beta');

    const listAlpha = await listPartnerPerformanceEntries(d1, { orgId: 'org-alpha', userId: 'user-a' });
    const listBeta = await listPartnerPerformanceEntries(d1, { orgId: 'org-beta', userId: 'user-c' });
    expect(listAlpha).toHaveLength(1);
    expect(listAlpha[0].notes).toBe('alpha-secret');
    expect(listBeta).toHaveLength(1);
    expect(listBeta[0].notes).toBe('beta-secret');
  });

  it('Scenario 3: unauthorized readback attempt returns null/404 with zero disclosure', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-shared', userId: 'user-a', offerId: 'off-a', campaignId: 'camp-a' });
    await recordPartnerPerformanceReport(d1, {
      id: 'pperf_secret_a',
      orgId: 'org-shared',
      userId: 'user-a',
      campaignId: 'camp-a',
      offerId: 'off-a',
      vertical: 'saas',
      reportSource: 'Secret Portal',
      reportPeriod: '2026-11',
      externalRefId: 'user-a-only-ref',
      clicksCount: 99,
      signupsCount: 9,
      qualifiedConversions: 3,
      pendingCommissionCents: 0,
      confirmedCommissionCents: 99900,
      currency: 'USD',
      notes: 'TOP_SECRET_A',
      nowIso: '2026-11-25T10:00:00Z',
      nowMs: clockMs,
    });

    // Direct repo readback by user-b in the same org must return null
    const leaked = await getPartnerPerformanceEntryByRef(d1, {
      orgId: 'org-shared',
      userId: 'user-b',
      externalRefId: 'user-a-only-ref',
    });
    expect(leaked).toBeNull();

    // HTTP POST by user-b targeting user-a's campaignId must return 404
    const resPost = await handleFirstValuePost(
      makeReq('POST', 'https://sophia.example.com/api/first-value', {
        action: 'record_partner_performance',
        orgId: 'org-shared',
        campaignId: 'camp-a',
        reportSource: 'Probe',
        reportPeriod: '2026-11',
        externalRefId: 'user-a-only-ref',
        clicksCount: 1,
        signupsCount: 0,
        qualifiedConversions: 0,
        pendingCommissionUsd: 0,
        confirmedCommissionUsd: 0,
        currency: 'USD',
      }),
      makeDeps({ userId: 'user-b', allowedOrgs: ['org-shared'] }),
    );
    expect(resPost.status).toBe(404);

    // HTTP GET by user-b in org-shared must NOT contain user-a's performance entries
    const resGet = await handleFirstValueGet(
      makeReq('GET', 'https://sophia.example.com/api/first-value?orgId=org-shared'),
      makeDeps({ userId: 'user-b', allowedOrgs: ['org-shared'] }),
    );
    expect(resGet.status).toBe(200);
    const getBody = (await resGet.json()) as {
      affiliateStudio: { performanceEntries: readonly unknown[] };
    };
    expect(getBody.affiliateStudio.performanceEntries).toHaveLength(0);
  });

  it('Scenario 4: duplicate report submissions are idempotent with zero accidental duplicate credits', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-idem', userId: 'user-a', offerId: 'off-a', campaignId: 'camp-a' });
    const deps = makeDeps({ userId: 'user-a', allowedOrgs: ['org-idem'] });
    const payload = {
      action: 'record_partner_performance',
      orgId: 'org-idem',
      campaignId: 'camp-a',
      reportSource: 'Partner Portal',
      reportPeriod: '2026-11',
      externalRefId: 'idem-ref-001',
      clicksCount: 50,
      signupsCount: 5,
      qualifiedConversions: 2,
      pendingCommissionUsd: 100,
      confirmedCommissionUsd: 250,
      currency: 'USD',
    };

    const first = await handleFirstValuePost(
      makeReq('POST', 'https://sophia.example.com/api/first-value', payload),
      deps,
    );
    expect(first.status).toBe(201);
    const firstJson = (await first.json()) as { idempotentReplay: boolean; performanceEntry: { id: string } };
    expect(firstJson.idempotentReplay).toBe(false);

    const second = await handleFirstValuePost(
      makeReq('POST', 'https://sophia.example.com/api/first-value', payload),
      deps,
    );
    expect(second.status).toBe(200);
    const secondJson = (await second.json()) as { idempotentReplay: boolean; performanceEntry: { id: string } };
    expect(secondJson.idempotentReplay).toBe(true);
    expect(secondJson.performanceEntry.id).toBe(firstJson.performanceEntry.id);

    const perfCount = await sqlite
      .prepare(`SELECT COUNT(*) AS cnt FROM pilot_affiliate_performance_entries WHERE org_id = 'org-idem'`)
      .first<{ cnt: number }>();
    const commSum = await sqlite
      .prepare(
        `SELECT COUNT(*) AS cnt, SUM(commission_cents) AS total_cents
         FROM workspace_external_commissions
         WHERE tenant_id = 'org-idem' AND status = 'approved'`,
      )
      .first<{ cnt: number; total_cents: number }>();

    expect(perfCount?.cnt).toBe(1);
    expect(commSum).toEqual({ cnt: 1, total_cents: 25000 });
  });

  it('Scenario 5: concurrent submissions enforce idempotency for same user and allow parallel isolation for distinct users', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-race', userId: 'user-a', offerId: 'off-a', campaignId: 'camp-a' });
    await seedOfferAndCampaign(d1, { orgId: 'org-race', userId: 'user-b', offerId: 'off-b', campaignId: 'camp-b' });

    // 5 concurrent identical submissions from user-a
    const sameUserResults = await Promise.all(
      Array.from({ length: 5 }, (_, idx) =>
        recordPartnerPerformanceReport(d1, {
          id: `pperf_race_a_${idx}`,
          orgId: 'org-race',
          userId: 'user-a',
          campaignId: 'camp-a',
          offerId: 'off-a',
          vertical: 'saas',
          reportSource: 'Portal',
          reportPeriod: '2026-11',
          externalRefId: 'race-ref-001',
          clicksCount: 10,
          signupsCount: 1,
          qualifiedConversions: 1,
          pendingCommissionCents: 0,
          confirmedCommissionCents: 10000,
          currency: 'USD',
          notes: null,
          nowIso: '2026-11-25T10:00:00Z',
          nowMs: clockMs,
        }),
      ),
    );

    const createdCount = sameUserResults.filter((r) => !r.duplicate).length;
    const duplicateCount = sameUserResults.filter((r) => r.duplicate).length;
    expect(createdCount).toBe(1);
    expect(duplicateCount).toBe(4);

    // Concurrent submissions from user-a and user-b using the same external_ref_id
    const [crossA, crossB] = await Promise.all([
      recordPartnerPerformanceReport(d1, {
        id: 'pperf_cross_a',
        orgId: 'org-race',
        userId: 'user-a',
        campaignId: 'camp-a',
        offerId: 'off-a',
        vertical: 'saas',
        reportSource: 'Portal A',
        reportPeriod: '2026-11',
        externalRefId: 'race-shared-ref',
        clicksCount: 10,
        signupsCount: 1,
        qualifiedConversions: 1,
        pendingCommissionCents: 0,
        confirmedCommissionCents: 11000,
        currency: 'USD',
        notes: 'A',
        nowIso: '2026-11-25T10:02:00Z',
        nowMs: clockMs + 120_000,
      }),
      recordPartnerPerformanceReport(d1, {
        id: 'pperf_cross_b',
        orgId: 'org-race',
        userId: 'user-b',
        campaignId: 'camp-b',
        offerId: 'off-b',
        vertical: 'saas',
        reportSource: 'Portal B',
        reportPeriod: '2026-11',
        externalRefId: 'race-shared-ref',
        clicksCount: 20,
        signupsCount: 2,
        qualifiedConversions: 2,
        pendingCommissionCents: 0,
        confirmedCommissionCents: 22000,
        currency: 'USD',
        notes: 'B',
        nowIso: '2026-11-25T10:02:00Z',
        nowMs: clockMs + 120_000,
      }),
    ]);

    expect(crossA.duplicate).toBe(false);
    expect(crossB.duplicate).toBe(false);
    expect(crossA.entry.userId).toBe('user-a');
    expect(crossB.entry.userId).toBe('user-b');
  });

  it('Scenario 6: deleted or revoked membership fails closed with HTTP 403 on read and write', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-revoked', userId: 'user-a', offerId: 'off-a', campaignId: 'camp-a' });
    const activeMembers = new Set<string>(['org-revoked:user-a']);
    const deps: FirstValueHttpDeps = {
      getD1: async () => d1,
      getCurrentUser: async () => ({ id: 'user-a', email: 'user-a@example.com' }),
      verifyWorkspaceAccess: async (orgId, uid) => activeMembers.has(`${orgId}:${uid}`),
      verifyCsrf: verifyCsrfToken,
      listByokProviders: async () => [],
      signingSecret: SIGNING_SECRET,
      nowMs: () => clockMs,
      pilotEnv: {},
    };

    // Works while member
    const okRes = await handleFirstValuePost(
      makeReq('POST', 'https://sophia.example.com/api/first-value', {
        action: 'record_partner_performance',
        orgId: 'org-revoked',
        campaignId: 'camp-a',
        reportSource: 'Portal',
        reportPeriod: '2026-11',
        externalRefId: 'before-revoke-001',
        clicksCount: 5,
        signupsCount: 1,
        qualifiedConversions: 1,
        pendingCommissionUsd: 0,
        confirmedCommissionUsd: 50,
        currency: 'USD',
      }),
      deps,
    );
    expect(okRes.status).toBe(201);

    // Revoke membership
    activeMembers.delete('org-revoked:user-a');

    const deniedGet = await handleFirstValueGet(
      makeReq('GET', 'https://sophia.example.com/api/first-value?orgId=org-revoked'),
      deps,
    );
    expect(deniedGet.status).toBe(403);

    const deniedPost = await handleFirstValuePost(
      makeReq('POST', 'https://sophia.example.com/api/first-value', {
        action: 'record_partner_performance',
        orgId: 'org-revoked',
        campaignId: 'camp-a',
        reportSource: 'Portal',
        reportPeriod: '2026-11',
        externalRefId: 'after-revoke-002',
        clicksCount: 5,
        signupsCount: 1,
        qualifiedConversions: 1,
        pendingCommissionUsd: 0,
        confirmedCommissionUsd: 50,
        currency: 'USD',
      }),
      deps,
    );
    expect(deniedPost.status).toBe(403);
  });

  it('Scenario 7: forged organization/user identifiers are rejected or ignored in favor of authenticated session', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-shared', userId: 'user-a', offerId: 'off-a', campaignId: 'camp-a' });
    await seedOfferAndCampaign(d1, { orgId: 'org-shared', userId: 'user-b', offerId: 'off-b', campaignId: 'camp-b' });

    // Forged orgId -> 403
    const forgedOrgRes = await handleFirstValuePost(
      makeReq('POST', 'https://sophia.example.com/api/first-value', {
        action: 'record_partner_performance',
        orgId: 'org-victim-forged',
        campaignId: 'camp-b',
        reportSource: 'Portal',
        reportPeriod: '2026-11',
        externalRefId: 'forged-org-ref',
        clicksCount: 1,
        signupsCount: 0,
        qualifiedConversions: 0,
        pendingCommissionUsd: 0,
        confirmedCommissionUsd: 10,
        currency: 'USD',
      }),
      makeDeps({ userId: 'user-b', allowedOrgs: ['org-shared'] }),
    );
    expect(forgedOrgRes.status).toBe(403);

    // Forged userId injected in body -> ignored; session user ('user-b') is strictly bound
    const forgedUserRes = await handleFirstValuePost(
      makeReq('POST', 'https://sophia.example.com/api/first-value', {
        action: 'record_partner_performance',
        orgId: 'org-shared',
        userId: 'user-a',
        campaignId: 'camp-b',
        reportSource: 'Portal',
        reportPeriod: '2026-11',
        externalRefId: 'forged-user-ref',
        clicksCount: 1,
        signupsCount: 0,
        qualifiedConversions: 0,
        pendingCommissionUsd: 0,
        confirmedCommissionUsd: 15,
        currency: 'USD',
      }),
      makeDeps({ userId: 'user-b', allowedOrgs: ['org-shared'] }),
    );
    expect(forgedUserRes.status).toBe(201);
    const forgedBody = (await forgedUserRes.json()) as {
      performanceEntry: { userId: string };
    };
    expect(forgedBody.performanceEntry.userId).toBe('user-b');
  });

  it('Scenario 8: legitimate organization administrator (ADMIN/OWNER) can audit org entries while MEMBER/outsider are denied', async () => {
    await sqlite.exec('PRAGMA foreign_keys = OFF;');
    await sqlite
      .prepare(
        `INSERT INTO org_members (id, org_id, user_id, role)
         VALUES
         ('m1', 'org-rbac', 'owner-user', 'OWNER'),
         ('m2', 'org-rbac', 'admin-user', 'ADMIN'),
         ('m3', 'org-rbac', 'user-a', 'MEMBER'),
         ('m4', 'org-rbac', 'user-b', 'MEMBER')`,
      )
      .run();
    await sqlite.exec('PRAGMA foreign_keys = ON;');

    await seedOfferAndCampaign(d1, { orgId: 'org-rbac', userId: 'user-a', offerId: 'off-a', campaignId: 'camp-a' });
    await seedOfferAndCampaign(d1, { orgId: 'org-rbac', userId: 'user-b', offerId: 'off-b', campaignId: 'camp-b' });
    await seedOfferAndCampaign(d1, { orgId: 'org-other', userId: 'user-x', offerId: 'off-x', campaignId: 'camp-x' });

    await recordPartnerPerformanceReport(d1, {
      id: 'pperf_rbac_a',
      orgId: 'org-rbac',
      userId: 'user-a',
      campaignId: 'camp-a',
      offerId: 'off-a',
      vertical: 'saas',
      reportSource: 'Portal A',
      reportPeriod: '2026-11',
      externalRefId: 'rbac-ref-001',
      clicksCount: 10,
      signupsCount: 1,
      qualifiedConversions: 1,
      pendingCommissionCents: 0,
      confirmedCommissionCents: 5000,
      currency: 'USD',
      notes: null,
      nowIso: '2026-11-25T10:00:00Z',
      nowMs: clockMs,
    });
    await recordPartnerPerformanceReport(d1, {
      id: 'pperf_rbac_b',
      orgId: 'org-rbac',
      userId: 'user-b',
      campaignId: 'camp-b',
      offerId: 'off-b',
      vertical: 'saas',
      reportSource: 'Portal B',
      reportPeriod: '2026-11',
      externalRefId: 'rbac-ref-001',
      clicksCount: 20,
      signupsCount: 2,
      qualifiedConversions: 2,
      pendingCommissionCents: 0,
      confirmedCommissionCents: 7000,
      currency: 'USD',
      notes: null,
      nowIso: '2026-11-25T10:01:00Z',
      nowMs: clockMs + 60_000,
    });
    await recordPartnerPerformanceReport(d1, {
      id: 'pperf_other',
      orgId: 'org-other',
      userId: 'user-x',
      campaignId: 'camp-x',
      offerId: 'off-x',
      vertical: 'saas',
      reportSource: 'Other Portal',
      reportPeriod: '2026-11',
      externalRefId: 'rbac-ref-001',
      clicksCount: 99,
      signupsCount: 9,
      qualifiedConversions: 9,
      pendingCommissionCents: 0,
      confirmedCommissionCents: 99000,
      currency: 'USD',
      notes: null,
      nowIso: '2026-11-25T10:02:00Z',
      nowMs: clockMs + 120_000,
    });

    // ADMIN and OWNER see both org-rbac entries, and NEVER org-other
    const adminView = await listPartnerPerformanceEntriesForOrgAdmin(d1, {
      orgId: 'org-rbac',
      actorUserId: 'admin-user',
    });
    expect(adminView.authorized).toBe(true);
    expect(adminView.entries).toHaveLength(2);
    expect(adminView.entries.every((e) => e.orgId === 'org-rbac')).toBe(true);

    const ownerView = await listPartnerPerformanceEntriesForOrgAdmin(d1, {
      orgId: 'org-rbac',
      actorUserId: 'owner-user',
    });
    expect(ownerView.authorized).toBe(true);
    expect(ownerView.entries).toHaveLength(2);

    // MEMBER is denied org-wide readback
    const memberView = await listPartnerPerformanceEntriesForOrgAdmin(d1, {
      orgId: 'org-rbac',
      actorUserId: 'user-a',
    });
    expect(memberView.authorized).toBe(false);
    expect(memberView.entries).toHaveLength(0);

    // Outsider is denied
    const outsiderView = await listPartnerPerformanceEntriesForOrgAdmin(d1, {
      orgId: 'org-rbac',
      actorUserId: 'outsider-user',
    });
    expect(outsiderView.authorized).toBe(false);
    expect(outsiderView.entries).toHaveLength(0);
  });
});
