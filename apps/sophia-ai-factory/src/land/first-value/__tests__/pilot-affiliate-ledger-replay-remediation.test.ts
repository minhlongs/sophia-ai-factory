// @vitest-environment node
/**
 * Affiliate Ledger Replay Remediation & 18-Scenario Financial Adversarial Matrix (SC-04 Track B).
 *
 * Verifies Migration 0522 historical backfill + atomic legacy/new idempotency enforcement
 * in `recordPartnerPerformanceReport` against real local SQLite/D1 (`NodeSqliteD1Database`).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { D1Database } from '@cloudflare/workers-types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildSimulatedAffiliateCampaignPack } from '@/seed/ai/affiliate-campaign-prompt';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite-d1';
import {
  AmbiguousLegacyCommissionOwnershipError,
  getPartnerPerformanceEntryByRef,
  insertPilotAffiliateCampaign,
  insertPilotAffiliateOffer,
  listPartnerPerformanceEntriesForOrgAdmin,
  recordPartnerPerformanceReport,
} from '@/tree/first-value/pilot-affiliate-studio-repo';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../../migrations');

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
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
    idempotencyKey: `idem-${args.campaignId}`,
    payloadHash: `hash-${args.campaignId}`,
    vertical: 'saas',
    campaignName: 'Acme Pilot Campaign',
    referralUrl: `https://acme.example.com/?ref=${args.userId}`,
    targetMarket: 'US',
    provenance: 'fixture_simulated',
    provenanceLabel: 'Simulated',
    pack,
    estimatedAiCostMicroUsd: 1000,
    nowIso,
  });
}

async function insertLegacyCommission(
  d1: D1Database,
  args: {
    id: string;
    tenantId: string;
    campaignId: string | null;
    externalTxId: string;
    commissionCents: number;
    status?: 'pending' | 'approved' | 'reversed';
    currency?: string;
    rawPayload?: string | null;
  },
): Promise<void> {
  await d1
    .prepare(
      `INSERT INTO workspace_external_commissions
       (id, tenant_id, campaign_id, network, niche, external_tx_id, event_type, status,
        gross_amount_cents, commission_cents, platform_fee_cents, currency, raw_payload,
        occurred_at, created_at)
       VALUES (?, ?, ?, 'customer_partner_report', 'saas_global', ?, ?, ?,
               0, ?, 0, ?, ?, 1764000000000, 1764000000000)`,
    )
    .bind(
      args.id,
      args.tenantId,
      args.campaignId,
      args.externalTxId,
      args.status === 'pending' ? 'partner_statement_pending' : 'partner_statement_confirmed',
      args.status ?? 'approved',
      args.commissionCents,
      args.currency ?? 'USD',
      args.rawPayload ?? null,
    )
    .run();
}

describe('SC-04 Track B — 18-Scenario Financial Adversarial Matrix', () => {
  let tmpDir: string;
  let db: NodeSqliteD1Database;
  let d1: D1Database;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-sc04-matrix-'));
    db = new NodeSqliteD1Database(path.join(tmpDir, 'test.sqlite'));
    d1 = db as unknown as D1Database;
    await db.exec(readMigration('0520_pilot_affiliate_revenue_studio.sql'));
    await db.exec(readMigration('0521_pilot_commercial_validation.sql'));
    await db.exec(readMigration('0522_pilot_affiliate_performance_tenant_isolation.sql'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('1) Existing legacy commission replay keeps total at 7500 cents (no 2x amplification)', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-alpha', userId: 'user-a', offerId: 'offer-a', campaignId: 'camp-a' });
    await insertLegacyCommission(d1, {
      id: 'wec_conf_orphan_hist',
      tenantId: 'org-alpha',
      campaignId: 'camp-a',
      externalTxId: 'conv-orphan-001:confirmed',
      commissionCents: 7500,
    });

    await recordPartnerPerformanceReport(d1, {
      id: 'perf-orphan-replay',
      orgId: 'org-alpha',
      userId: 'user-a',
      campaignId: 'camp-a',
      offerId: 'offer-a',
      vertical: 'saas',
      reportSource: 'partner_portal',
      reportPeriod: '2026-11',
      externalRefId: 'conv-orphan-001',
      clicksCount: 10,
      signupsCount: 1,
      qualifiedConversions: 1,
      pendingCommissionCents: 0,
      confirmedCommissionCents: 7500,
      currency: 'USD',
      notes: 'Historical replay',
      nowIso: '2026-11-25T10:05:00.000Z',
      nowMs: 1764065100000,
    });

    const totals = await d1
      .prepare(
        `SELECT COUNT(*) AS cnt, COALESCE(SUM(commission_cents), 0) AS total_cents
         FROM workspace_external_commissions
         WHERE tenant_id = 'org-alpha' AND network = 'customer_partner_report' AND status = 'approved'`,
      )
      .first<{ cnt: number; total_cents: number }>();

    expect(totals?.cnt).toBe(1);
    expect(totals?.total_cents).toBe(7500);
  });

  it('2) Same transaction submitted using new identity produces no duplicate', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-alpha', userId: 'user-a', offerId: 'offer-a', campaignId: 'camp-a' });
    const base = {
      orgId: 'org-alpha',
      userId: 'user-a',
      campaignId: 'camp-a',
      offerId: 'offer-a',
      vertical: 'saas' as const,
      reportSource: 'partner_portal',
      reportPeriod: '2026-11',
      externalRefId: 'conv-new-002',
      clicksCount: 5,
      signupsCount: 1,
      qualifiedConversions: 1,
      pendingCommissionCents: 0,
      confirmedCommissionCents: 4200,
      currency: 'USD',
      notes: null,
      nowIso: '2026-11-25T10:05:00.000Z',
      nowMs: 1764065100000,
    };

    const r1 = await recordPartnerPerformanceReport(d1, { ...base, id: 'perf-2a' });
    const r2 = await recordPartnerPerformanceReport(d1, { ...base, id: 'perf-2b' });
    expect(r1.duplicate).toBe(false);
    expect(r2.duplicate).toBe(true);

    const totals = await d1
      .prepare(`SELECT COUNT(*) AS cnt, SUM(commission_cents) AS total_cents FROM workspace_external_commissions`)
      .first<{ cnt: number; total_cents: number }>();
    expect(totals?.cnt).toBe(1);
    expect(totals?.total_cents).toBe(4200);
  });

  it('3) Repeated old/new identity replay is idempotent after migration 0522 backfill', async () => {
    // Fresh 0520+0521 DB with legacy rows, then apply 0522 backfill, then replay repeatedly
    const migDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-sc04-s3-'));
    try {
      const mdb = new NodeSqliteD1Database(path.join(migDir, 'test.sqlite'));
      const md1 = mdb as unknown as D1Database;
      await mdb.exec(readMigration('0520_pilot_affiliate_revenue_studio.sql'));
      await mdb.exec(readMigration('0521_pilot_commercial_validation.sql'));
      await seedOfferAndCampaign(md1, { orgId: 'org-alpha', userId: 'user-a', offerId: 'offer-a', campaignId: 'camp-a' });

      // Seed pre-0522 performance entry + legacy unprefixed commission
      await md1
        .prepare(
          `INSERT INTO pilot_affiliate_performance_entries
           (id, org_id, user_id, campaign_id, offer_id, report_source, report_period, external_ref_id,
            clicks_count, signups_count, qualified_conversions, pending_commission_cents,
            confirmed_commission_cents, currency, notes, created_at_iso, updated_at_iso)
           VALUES ('perf-hist-3', 'org-alpha', 'user-a', 'camp-a', 'offer-a', 'partner_portal', '2026-10', 'conv-hist-3',
                   10, 1, 1, 0, 7500, 'USD', NULL, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')`,
        )
        .run();
      await insertLegacyCommission(md1, {
        id: 'wec_hist_3',
        tenantId: 'org-alpha',
        campaignId: 'camp-a',
        externalTxId: 'conv-hist-3:confirmed',
        commissionCents: 7500,
      });

      // Apply 0522 (backfills external_tx_id to user-a:conv-hist-3:confirmed)
      await mdb.exec(readMigration('0522_pilot_affiliate_performance_tenant_isolation.sql'));

      const backfilled = await md1
        .prepare(`SELECT external_tx_id FROM workspace_external_commissions WHERE id = 'wec_hist_3'`)
        .first<{ external_tx_id: string }>();
      expect(backfilled?.external_tx_id).toBe('user-a:conv-hist-3:confirmed');

      for (let i = 0; i < 3; i++) {
        const res = await recordPartnerPerformanceReport(md1, {
          id: `perf-replay-3-${i}`,
          orgId: 'org-alpha',
          userId: 'user-a',
          campaignId: 'camp-a',
          offerId: 'offer-a',
          vertical: 'saas',
          reportSource: 'partner_portal',
          reportPeriod: '2026-10',
          externalRefId: 'conv-hist-3',
          clicksCount: 10,
          signupsCount: 1,
          qualifiedConversions: 1,
          pendingCommissionCents: 0,
          confirmedCommissionCents: 7500,
          currency: 'USD',
          notes: null,
          nowIso: '2026-11-25T10:05:00.000Z',
          nowMs: 1764065100000,
        });
        expect(res.duplicate).toBe(true);
      }

      const totals = await md1
        .prepare(`SELECT COUNT(*) AS cnt, SUM(commission_cents) AS total_cents FROM workspace_external_commissions`)
        .first<{ cnt: number; total_cents: number }>();
      expect(totals?.cnt).toBe(1);
      expect(totals?.total_cents).toBe(7500);
    } finally {
      fs.rmSync(migDir, { recursive: true, force: true });
    }
  });

  it('4) Concurrent duplicate submissions (Promise.all) produce exactly 1 economic tx', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-alpha', userId: 'user-a', offerId: 'offer-a', campaignId: 'camp-a' });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, idx) =>
        recordPartnerPerformanceReport(d1, {
          id: `perf-conc-${idx}`,
          orgId: 'org-alpha',
          userId: 'user-a',
          campaignId: 'camp-a',
          offerId: 'offer-a',
          vertical: 'saas',
          reportSource: 'partner_portal',
          reportPeriod: '2026-11',
          externalRefId: 'conv-concurrent-004',
          clicksCount: 20,
          signupsCount: 2,
          qualifiedConversions: 1,
          pendingCommissionCents: 0,
          confirmedCommissionCents: 9900,
          currency: 'USD',
          notes: null,
          nowIso: '2026-11-25T10:05:00.000Z',
          nowMs: 1764065100000,
        }),
      ),
    );

    const createdCount = results.filter((r) => !r.duplicate).length;
    expect(createdCount).toBe(1);

    const totals = await d1
      .prepare(`SELECT COUNT(*) AS cnt, SUM(commission_cents) AS total_cents FROM workspace_external_commissions`)
      .first<{ cnt: number; total_cents: number }>();
    expect(totals?.cnt).toBe(1);
    expect(totals?.total_cents).toBe(9900);
  });

  it('5) Different users with legitimately identical references get independent authorized records', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-alpha', userId: 'user-a', offerId: 'offer-a', campaignId: 'camp-a' });
    await seedOfferAndCampaign(d1, { orgId: 'org-alpha', userId: 'user-b', offerId: 'offer-b', campaignId: 'camp-b' });

    const [ra, rb] = await Promise.all([
      recordPartnerPerformanceReport(d1, {
        id: 'perf-5a',
        orgId: 'org-alpha',
        userId: 'user-a',
        campaignId: 'camp-a',
        offerId: 'offer-a',
        vertical: 'saas',
        reportSource: 'partner_portal',
        reportPeriod: '2026-11',
        externalRefId: 'shared-ref-005',
        clicksCount: 10,
        signupsCount: 1,
        qualifiedConversions: 1,
        pendingCommissionCents: 0,
        confirmedCommissionCents: 4000,
        currency: 'USD',
        notes: null,
        nowIso: '2026-11-25T10:05:00.000Z',
        nowMs: 1764065100000,
      }),
      recordPartnerPerformanceReport(d1, {
        id: 'perf-5b',
        orgId: 'org-alpha',
        userId: 'user-b',
        campaignId: 'camp-b',
        offerId: 'offer-b',
        vertical: 'saas',
        reportSource: 'partner_portal',
        reportPeriod: '2026-11',
        externalRefId: 'shared-ref-005',
        clicksCount: 15,
        signupsCount: 2,
        qualifiedConversions: 1,
        pendingCommissionCents: 0,
        confirmedCommissionCents: 6000,
        currency: 'USD',
        notes: null,
        nowIso: '2026-11-25T10:05:00.000Z',
        nowMs: 1764065100000,
      }),
    ]);

    expect(ra.duplicate).toBe(false);
    expect(rb.duplicate).toBe(false);
    expect(ra.entry.userId).toBe('user-a');
    expect(rb.entry.userId).toBe('user-b');

    const totals = await d1
      .prepare(`SELECT COUNT(*) AS cnt, SUM(commission_cents) AS total_cents FROM workspace_external_commissions`)
      .first<{ cnt: number; total_cents: number }>();
    expect(totals?.cnt).toBe(2);
    expect(totals?.total_cents).toBe(10000);
  });

  it('6) Cross-organization references are completely isolated', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-alpha', userId: 'user-a', offerId: 'offer-a', campaignId: 'camp-a' });
    await seedOfferAndCampaign(d1, { orgId: 'org-beta', userId: 'user-a', offerId: 'offer-b', campaignId: 'camp-b' });

    await recordPartnerPerformanceReport(d1, {
      id: 'perf-6a',
      orgId: 'org-alpha',
      userId: 'user-a',
      campaignId: 'camp-a',
      offerId: 'offer-a',
      vertical: 'saas',
      reportSource: 'partner_portal',
      reportPeriod: '2026-11',
      externalRefId: 'cross-org-ref-006',
      clicksCount: 1,
      signupsCount: 1,
      qualifiedConversions: 1,
      pendingCommissionCents: 0,
      confirmedCommissionCents: 3000,
      currency: 'USD',
      notes: null,
      nowIso: '2026-11-25T10:05:00.000Z',
      nowMs: 1764065100000,
    });
    await recordPartnerPerformanceReport(d1, {
      id: 'perf-6b',
      orgId: 'org-beta',
      userId: 'user-a',
      campaignId: 'camp-b',
      offerId: 'offer-b',
      vertical: 'saas',
      reportSource: 'partner_portal',
      reportPeriod: '2026-11',
      externalRefId: 'cross-org-ref-006',
      clicksCount: 2,
      signupsCount: 1,
      qualifiedConversions: 1,
      pendingCommissionCents: 0,
      confirmedCommissionCents: 5000,
      currency: 'USD',
      notes: null,
      nowIso: '2026-11-25T10:05:00.000Z',
      nowMs: 1764065100000,
    });

    const alphaEntry = await getPartnerPerformanceEntryByRef(d1, {
      orgId: 'org-alpha',
      userId: 'user-a',
      externalRefId: 'cross-org-ref-006',
    });
    const betaEntry = await getPartnerPerformanceEntryByRef(d1, {
      orgId: 'org-beta',
      userId: 'user-a',
      externalRefId: 'cross-org-ref-006',
    });
    expect(alphaEntry?.confirmedCommissionCents).toBe(3000);
    expect(betaEntry?.confirmedCommissionCents).toBe(5000);
  });

  it('7) Cross-user legacy lookup causes zero unauthorized disclosure', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-alpha', userId: 'user-a', offerId: 'offer-a', campaignId: 'camp-a' });
    await seedOfferAndCampaign(d1, { orgId: 'org-alpha', userId: 'user-b', offerId: 'offer-b', campaignId: 'camp-b' });

    await insertLegacyCommission(d1, {
      id: 'wec_legacy_user_a',
      tenantId: 'org-alpha',
      campaignId: 'camp-a',
      externalTxId: 'legacy-ref-007:confirmed',
      commissionCents: 7500,
    });

    // user-b attempts to read user-a's ref -> null (no disclosure)
    const lookupB = await getPartnerPerformanceEntryByRef(d1, {
      orgId: 'org-alpha',
      userId: 'user-b',
      externalRefId: 'legacy-ref-007',
    });
    expect(lookupB).toBeNull();

    // user-b submits their own report with the same external_ref_id -> gets their own independent scoped record
    const resB = await recordPartnerPerformanceReport(d1, {
      id: 'perf-7b',
      orgId: 'org-alpha',
      userId: 'user-b',
      campaignId: 'camp-b',
      offerId: 'offer-b',
      vertical: 'saas',
      reportSource: 'partner_portal',
      reportPeriod: '2026-11',
      externalRefId: 'legacy-ref-007',
      clicksCount: 3,
      signupsCount: 1,
      qualifiedConversions: 1,
      pendingCommissionCents: 0,
      confirmedCommissionCents: 2500,
      currency: 'USD',
      notes: null,
      nowIso: '2026-11-25T10:05:00.000Z',
      nowMs: 1764065100000,
    });
    expect(resB.entry.userId).toBe('user-b');
    expect(resB.entry.confirmedCommissionCents).toBe(2500);
  });

  it('8) Ambiguous legacy ownership fails closed without creating duplicate credit or deleting data', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-alpha', userId: 'user-a', offerId: 'offer-a', campaignId: 'camp-a' });
    // Orphaned legacy row with NULL campaign_id and no pilot_affiliate_performance_entries owner
    await insertLegacyCommission(d1, {
      id: 'wec_ambiguous_008',
      tenantId: 'org-alpha',
      campaignId: null,
      externalTxId: 'ambig-ref-008:confirmed',
      commissionCents: 7500,
    });

    await expect(
      recordPartnerPerformanceReport(d1, {
        id: 'perf-8a',
        orgId: 'org-alpha',
        userId: 'user-a',
        campaignId: 'camp-a',
        offerId: 'offer-a',
        vertical: 'saas',
        reportSource: 'partner_portal',
        reportPeriod: '2026-11',
        externalRefId: 'ambig-ref-008',
        clicksCount: 1,
        signupsCount: 1,
        qualifiedConversions: 1,
        pendingCommissionCents: 0,
        confirmedCommissionCents: 7500,
        currency: 'USD',
        notes: null,
        nowIso: '2026-11-25T10:05:00.000Z',
        nowMs: 1764065100000,
      }),
    ).rejects.toBeInstanceOf(AmbiguousLegacyCommissionOwnershipError);

    // Original legacy row preserved untouched, zero duplicate created
    const totals = await d1
      .prepare(`SELECT COUNT(*) AS cnt, SUM(commission_cents) AS total_cents FROM workspace_external_commissions`)
      .first<{ cnt: number; total_cents: number }>();
    expect(totals?.cnt).toBe(1);
    expect(totals?.total_cents).toBe(7500);
  });

  it('9) Pending-to-confirmed transition updates state with zero double revenue', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-alpha', userId: 'user-a', offerId: 'offer-a', campaignId: 'camp-a' });
    const base = {
      orgId: 'org-alpha',
      userId: 'user-a',
      campaignId: 'camp-a',
      offerId: 'offer-a',
      vertical: 'saas' as const,
      reportSource: 'partner_portal',
      reportPeriod: '2026-11',
      externalRefId: 'conv-p2c-009',
      clicksCount: 10,
      signupsCount: 1,
      qualifiedConversions: 1,
      currency: 'USD',
      notes: null,
      nowIso: '2026-11-25T10:05:00.000Z',
      nowMs: 1764065100000,
    };

    await recordPartnerPerformanceReport(d1, { ...base, id: 'perf-9-p', pendingCommissionCents: 5000, confirmedCommissionCents: 0 });
    const confirmed = await recordPartnerPerformanceReport(d1, { ...base, id: 'perf-9-c', pendingCommissionCents: 0, confirmedCommissionCents: 5000 });
    expect(confirmed.duplicate).toBe(false);
    expect(confirmed.entry.pendingCommissionCents).toBe(0);
    expect(confirmed.entry.confirmedCommissionCents).toBe(5000);

    const ledger = await d1
      .prepare(`SELECT SUM(commission_cents) AS net_cents FROM workspace_external_commissions WHERE tenant_id = 'org-alpha'`)
      .first<{ net_cents: number }>();
    expect(ledger?.net_cents).toBe(5000);
  });

  it('10) Reversal event applies exact economic adjustment and is idempotent on replay', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-alpha', userId: 'user-a', offerId: 'offer-a', campaignId: 'camp-a' });
    const base = {
      orgId: 'org-alpha',
      userId: 'user-a',
      campaignId: 'camp-a',
      offerId: 'offer-a',
      vertical: 'saas' as const,
      reportSource: 'partner_portal',
      reportPeriod: '2026-11',
      externalRefId: 'conv-rev-010',
      clicksCount: 10,
      signupsCount: 1,
      qualifiedConversions: 1,
      pendingCommissionCents: 0,
      confirmedCommissionCents: 8000,
      currency: 'USD',
      notes: null,
      nowIso: '2026-11-25T10:05:00.000Z',
      nowMs: 1764065100000,
    };

    await recordPartnerPerformanceReport(d1, { ...base, id: 'perf-10-init' });
    const rev1 = await recordPartnerPerformanceReport(d1, { ...base, id: 'perf-10-rev1', eventKind: 'reversal' });
    const rev2 = await recordPartnerPerformanceReport(d1, { ...base, id: 'perf-10-rev2', eventKind: 'reversal' });
    expect(rev1.duplicate).toBe(false);
    expect(rev2.duplicate).toBe(true);

    const net = await d1
      .prepare(`SELECT SUM(commission_cents) AS net_cents FROM workspace_external_commissions WHERE tenant_id = 'org-alpha'`)
      .first<{ net_cents: number }>();
    expect(net?.net_cents).toBe(0);
  });

  it('11) Correction event is auditable and idempotent', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-alpha', userId: 'user-a', offerId: 'offer-a', campaignId: 'camp-a' });
    const base = {
      orgId: 'org-alpha',
      userId: 'user-a',
      campaignId: 'camp-a',
      offerId: 'offer-a',
      vertical: 'saas' as const,
      reportSource: 'partner_portal',
      reportPeriod: '2026-11',
      externalRefId: 'conv-corr-011',
      clicksCount: 10,
      signupsCount: 1,
      qualifiedConversions: 1,
      pendingCommissionCents: 0,
      currency: 'USD',
      nowIso: '2026-11-25T10:05:00.000Z',
      nowMs: 1764065100000,
    };

    await recordPartnerPerformanceReport(d1, { ...base, id: 'perf-11-init', confirmedCommissionCents: 6000, notes: 'initial' });
    const corr1 = await recordPartnerPerformanceReport(d1, {
      ...base,
      id: 'perf-11-c1',
      confirmedCommissionCents: 6500,
      notes: 'adjusted +500',
      eventKind: 'correction',
    });
    const corr2 = await recordPartnerPerformanceReport(d1, {
      ...base,
      id: 'perf-11-c2',
      confirmedCommissionCents: 6500,
      notes: 'adjusted +500',
      eventKind: 'correction',
    });
    expect(corr1.duplicate).toBe(false);
    expect(corr2.duplicate).toBe(true);

    const row = await d1
      .prepare(`SELECT commission_cents, raw_payload FROM workspace_external_commissions WHERE status = 'approved'`)
      .first<{ commission_cents: number; raw_payload: string }>();
    expect(row?.commission_cents).toBe(6500);
    expect(JSON.parse(row?.raw_payload ?? '{}').previousConfirmedCommissionCents).toBe(6000);
  });

  it('12) VND zero-decimal amount preserves exact integer behavior', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-vn', userId: 'user-vn', offerId: 'offer-vn', campaignId: 'camp-vn' });
    const res = await recordPartnerPerformanceReport(d1, {
      id: 'perf-12-vnd',
      orgId: 'org-vn',
      userId: 'user-vn',
      campaignId: 'camp-vn',
      offerId: 'offer-vn',
      vertical: 'saas',
      reportSource: 'partner_portal',
      reportPeriod: '2026-11',
      externalRefId: 'conv-vnd-012',
      clicksCount: 100,
      signupsCount: 5,
      qualifiedConversions: 1,
      pendingCommissionCents: 0,
      confirmedCommissionCents: 1850000,
      currency: 'vnd',
      notes: '1,850,000 VND exact',
      nowIso: '2026-11-25T10:05:00.000Z',
      nowMs: 1764065100000,
    });
    expect(res.entry.currency).toBe('VND');
    expect(res.entry.confirmedCommissionCents).toBe(1850000);
    expect(Number.isInteger(res.entry.confirmedCommissionCents)).toBe(true);
  });

  it('13) Multiple currencies are segregated without unintended aggregation', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-multi', userId: 'user-m', offerId: 'offer-m', campaignId: 'camp-m' });
    await recordPartnerPerformanceReport(d1, {
      id: 'perf-13-usd',
      orgId: 'org-multi',
      userId: 'user-m',
      campaignId: 'camp-m',
      offerId: 'offer-m',
      vertical: 'saas',
      reportSource: 'partner_portal',
      reportPeriod: '2026-11',
      externalRefId: 'conv-usd-013',
      clicksCount: 10,
      signupsCount: 1,
      qualifiedConversions: 1,
      pendingCommissionCents: 0,
      confirmedCommissionCents: 7500,
      currency: 'USD',
      notes: null,
      nowIso: '2026-11-25T10:05:00.000Z',
      nowMs: 1764065100000,
    });
    await recordPartnerPerformanceReport(d1, {
      id: 'perf-13-vnd',
      orgId: 'org-multi',
      userId: 'user-m',
      campaignId: 'camp-m',
      offerId: 'offer-m',
      vertical: 'saas',
      reportSource: 'partner_portal',
      reportPeriod: '2026-11',
      externalRefId: 'conv-vnd-013',
      clicksCount: 10,
      signupsCount: 1,
      qualifiedConversions: 1,
      pendingCommissionCents: 0,
      confirmedCommissionCents: 500000,
      currency: 'VND',
      notes: null,
      nowIso: '2026-11-25T10:05:00.000Z',
      nowMs: 1764065100000,
    });

    const byCurrency = await d1
      .prepare(
        `SELECT currency, SUM(commission_cents) AS total_cents
         FROM workspace_external_commissions
         WHERE tenant_id = 'org-multi'
         GROUP BY currency ORDER BY currency`,
      )
      .all<{ currency: string; total_cents: number }>();
    expect(byCurrency.results).toEqual([
      { currency: 'USD', total_cents: 7500 },
      { currency: 'VND', total_cents: 500000 },
    ]);
  });

  it('14) Crash during migration (interrupted mid-0522) is recoverable by re-running 0522', async () => {
    const crashDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-sc04-s14-'));
    try {
      const cdb = new NodeSqliteD1Database(path.join(crashDir, 'test.sqlite'));
      const cd1 = cdb as unknown as D1Database;
      await cdb.exec(readMigration('0520_pilot_affiliate_revenue_studio.sql'));
      await cdb.exec(readMigration('0521_pilot_commercial_validation.sql'));
      await seedOfferAndCampaign(cd1, { orgId: 'org-crash', userId: 'user-c', offerId: 'offer-c', campaignId: 'camp-c' });
      // Simulate partial v2 table left behind by an interrupted migration before swap
      await cdb.exec(`CREATE TABLE pilot_affiliate_performance_entries_v2 (id TEXT PRIMARY KEY)`);
      // Re-running 0522 drops stale v2 table and completes cleanly
      await cdb.exec(readMigration('0522_pilot_affiliate_performance_tenant_isolation.sql'));
      const schema = await cd1
        .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='pilot_affiliate_performance_entries'`)
        .first<{ sql: string }>();
      expect(schema?.sql).toContain('UNIQUE (org_id, user_id, external_ref_id)');
    } finally {
      fs.rmSync(crashDir, { recursive: true, force: true });
    }
  });

  it('15) Crash after partial ledger operation leaves no permanent inconsistent balance on retry', async () => {
    await seedOfferAndCampaign(d1, { orgId: 'org-alpha', userId: 'user-a', offerId: 'offer-a', campaignId: 'camp-a' });
    // Simulate a crash where legacy commission was written, but perf entry was not yet written
    await insertLegacyCommission(d1, {
      id: 'wec_partial_015',
      tenantId: 'org-alpha',
      campaignId: 'camp-a',
      externalTxId: 'conv-partial-015:confirmed',
      commissionCents: 7500,
    });

    // Retry completes perf entry without duplicating the commission
    const res = await recordPartnerPerformanceReport(d1, {
      id: 'perf-15-retry',
      orgId: 'org-alpha',
      userId: 'user-a',
      campaignId: 'camp-a',
      offerId: 'offer-a',
      vertical: 'saas',
      reportSource: 'partner_portal',
      reportPeriod: '2026-11',
      externalRefId: 'conv-partial-015',
      clicksCount: 5,
      signupsCount: 1,
      qualifiedConversions: 1,
      pendingCommissionCents: 0,
      confirmedCommissionCents: 7500,
      currency: 'USD',
      notes: null,
      nowIso: '2026-11-25T10:05:00.000Z',
      nowMs: 1764065100000,
    });
    expect(res.entry.confirmedCommissionCents).toBe(7500);
    const totals = await d1
      .prepare(`SELECT COUNT(*) AS cnt, SUM(commission_cents) AS total_cents FROM workspace_external_commissions`)
      .first<{ cnt: number; total_cents: number }>();
    expect(totals?.cnt).toBe(1);
    expect(totals?.total_cents).toBe(7500);
  });

  it('16) Upgrade with historical collisions skips colliding row cleanly without data loss', async () => {
    const colDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-sc04-s16-'));
    try {
      const cdb = new NodeSqliteD1Database(path.join(colDir, 'test.sqlite'));
      const cd1 = cdb as unknown as D1Database;
      await cdb.exec(readMigration('0520_pilot_affiliate_revenue_studio.sql'));
      await cdb.exec(readMigration('0521_pilot_commercial_validation.sql'));
      await seedOfferAndCampaign(cd1, { orgId: 'org-col', userId: 'user-a', offerId: 'offer-a', campaignId: 'camp-a' });
      await cd1
        .prepare(
          `INSERT INTO pilot_affiliate_performance_entries
           (id, org_id, user_id, campaign_id, offer_id, report_source, report_period, external_ref_id,
            clicks_count, signups_count, qualified_conversions, pending_commission_cents,
            confirmed_commission_cents, currency, notes, created_at_iso, updated_at_iso)
           VALUES ('perf-col-1', 'org-col', 'user-a', 'camp-a', 'offer-a', 'partner_portal', '2026-10', 'conv-col-16',
                   10, 1, 1, 0, 7500, 'USD', NULL, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')`,
        )
        .run();
      // Both legacy AND already-scoped rows exist before 0522 runs
      await insertLegacyCommission(cd1, {
        id: 'wec_col_legacy',
        tenantId: 'org-col',
        campaignId: 'camp-a',
        externalTxId: 'conv-col-16:confirmed',
        commissionCents: 7500,
      });
      await insertLegacyCommission(cd1, {
        id: 'wec_col_scoped',
        tenantId: 'org-col',
        campaignId: 'camp-a',
        externalTxId: 'user-a:conv-col-16:confirmed',
        commissionCents: 7500,
      });

      // Migration 0522 must succeed without UNIQUE constraint error and without deleting either row
      await cdb.exec(readMigration('0522_pilot_affiliate_performance_tenant_isolation.sql'));
      const cnt = await cd1
        .prepare(`SELECT COUNT(*) AS cnt FROM workspace_external_commissions WHERE tenant_id = 'org-col'`)
        .first<{ cnt: number }>();
      expect(cnt?.cnt).toBe(2);
    } finally {
      fs.rmSync(colDir, { recursive: true, force: true });
    }
  });

  it('17) Clean initialization produces correct current schema', async () => {
    const cleanDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-sc04-s17-'));
    try {
      const cdb = new NodeSqliteD1Database(path.join(cleanDir, 'clean.sqlite'));
      const cd1 = cdb as unknown as D1Database;
      await cdb.exec(readMigration('0522_pilot_affiliate_performance_tenant_isolation.sql'));
      const schema = await cd1
        .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='pilot_affiliate_performance_entries'`)
        .first<{ sql: string }>();
      expect(schema?.sql).toContain('UNIQUE (org_id, user_id, external_ref_id)');
    } finally {
      fs.rmSync(cleanDir, { recursive: true, force: true });
    }
  });

  it('18) Revoked membership is rejected on org-admin readback', async () => {
    await d1
      .prepare(
        `CREATE TABLE IF NOT EXISTS workspace_members (
           id TEXT PRIMARY KEY,
           workspace_id TEXT NOT NULL,
           user_id TEXT NOT NULL,
           role TEXT NOT NULL,
           status TEXT NOT NULL DEFAULT 'active'
         )`,
      )
      .run();
    await d1
      .prepare(`INSERT INTO workspace_members (id, workspace_id, user_id, role, status) VALUES ('wm-1', 'org-alpha', 'user-revoked', 'ADMIN', 'revoked')`)
      .run();

    const res = await listPartnerPerformanceEntriesForOrgAdmin(d1, {
      orgId: 'org-alpha',
      actorUserId: 'user-revoked',
    });
    expect(res.authorized).toBe(false);
    expect(res.entries).toEqual([]);
  });
});
