/**
 * OPC Gate 1 Pre-Flight Readiness Evaluator tests (S-03).
 *
 * Verifies $0.00-spend, zero-secret-exposure readiness reporting across
 * ADMIN role, Kill Switch, BYOK providers, YouTube channel, and CEX/SaaS offers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockListProviders: vi.fn<() => Promise<string[]>>(async () => []),
  mockGetKillState: vi.fn(async () => ({ active: false, known: true })),
}));

vi.mock('@/tree/byok/user-api-key-store', () => ({
  listUserApiKeyProviders: mocks.mockListProviders,
}));

vi.mock('@/tree/affiliate/kill-switch/kill-switch-store', () => ({
  getAffiliateKillSwitchState: mocks.mockGetKillState,
}));

import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import { upsertWorkspaceVerifiedOffer } from '@/tree/affiliate/offers/workspace-offer-upsert';
import { evaluateOpcGate1Readiness } from '../opc-gate1-readiness';

const SCHEMA = [
  `CREATE TABLE org_members (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'MEMBER',
    created_at INTEGER NOT NULL DEFAULT 1000
  );`,
  `CREATE TABLE publishing_channels (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    external_account_id TEXT,
    access_token TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL DEFAULT 1000
  );`,
  `CREATE TABLE affiliate_offers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'system',
    network_id TEXT NOT NULL DEFAULT 'direct',
    external_id TEXT,
    program_name TEXT,
    title TEXT,
    category TEXT,
    product_url TEXT,
    destination_url TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    commission_terms TEXT,
    niche TEXT,
    region TEXT,
    language TEXT,
    created_at INTEGER NOT NULL DEFAULT 1000,
    updated_at INTEGER NOT NULL DEFAULT 1000
  );`,
];

describe('evaluateOpcGate1Readiness', () => {
  let db: D1Database;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetKillState.mockResolvedValue({ active: false, known: true });
    mocks.mockListProviders.mockResolvedValue(['elevenlabs', 'heygen']);
    db = createFakeD1(SCHEMA) as unknown as D1Database;
  });

  it('returns early with WORKSPACE_ADMIN_REQUIRED and zero workspace metadata disclosure when caller lacks ADMIN role', async () => {
    const report = await evaluateOpcGate1Readiness({
      db,
      workspaceId: 'ws_1',
      userId: 'usr_unprivileged',
    });

    expect(report.gate1ReadyForLiveProof).toBe(false);
    expect(report.adminAuthorized).toBe(false);
    expect(report.blockers).toEqual(['WORKSPACE_ADMIN_REQUIRED']);
    expect(report.youtubeChannelId).toBeNull();
    expect(report.eligibleSaasOfferIds).toEqual([]);
    expect(report.eligibleCryptoOfferIds).toEqual([]);
    expect(mocks.mockGetKillState).not.toHaveBeenCalled();
  });

  it('reports all downstream blockers when ADMIN caller lacks BYOK keys, channel, and offers', async () => {
    await db
      .prepare(`INSERT INTO org_members (id, org_id, user_id, role) VALUES ('m1', 'ws_1', 'usr_1', 'ADMIN')`)
      .run();
    mocks.mockListProviders.mockResolvedValue([]);
    mocks.mockGetKillState.mockResolvedValue({ active: true, known: true });

    const report = await evaluateOpcGate1Readiness({
      db,
      workspaceId: 'ws_1',
      userId: 'usr_1',
    });

    expect(report.gate1ReadyForLiveProof).toBe(false);
    expect(report.blockers).toEqual([
      'KILL_SWITCH_ACTIVE_OR_UNKNOWN',
      'BYOK_VOICE_MISSING',
      'BYOK_VIDEO_MISSING',
      'YOUTUBE_CHANNEL_MISSING',
      'SAAS_OFFER_MISSING',
      'CRYPTO_OFFER_MISSING',
    ]);
  });

  it('reports gate1ReadyForLiveProof=true with 0 secrets leaked when all prerequisites are satisfied', async () => {
    await db
      .prepare(`INSERT INTO org_members (id, org_id, user_id, role) VALUES ('m1', 'ws_1', 'usr_1', 'OWNER')`)
      .run();
    await db
      .prepare(
        `INSERT INTO publishing_channels (id, tenant_id, provider, external_account_id, access_token, status)
         VALUES ('ch_yt_owner', 'ws_1', 'youtube', 'UC_owner', 'SECRET_OAUTH_TOKEN_DO_NOT_LEAK', 'active')`,
      )
      .run();

    await upsertWorkspaceVerifiedOffer(db, {
      tenantId: 'ws_1',
      programName: 'Linear App',
      productUrl: 'https://linear.app',
      commissionTerms: '30% Recurring MRR',
      niche: 'saas_global',
      jurisdiction: 'GLOBAL',
    });
    await upsertWorkspaceVerifiedOffer(db, {
      tenantId: 'ws_1',
      programName: 'Binance Global',
      productUrl: 'https://accounts.binance.com/register',
      commissionTerms: '20% Spot & Futures Fee Rebate',
      niche: 'crypto_global',
      jurisdiction: 'US',
    });

    const report = await evaluateOpcGate1Readiness({
      db,
      workspaceId: 'ws_1',
      userId: 'usr_1',
    });

    expect(report.gate1ReadyForLiveProof).toBe(true);
    expect(report.blockers).toEqual([]);
    expect(report.youtubeChannelId).toBe('ch_yt_owner');
    expect(report.eligibleSaasOfferIds).toHaveLength(1);
    expect(report.eligibleCryptoOfferIds).toHaveLength(1);
    expect(JSON.stringify(report)).not.toContain('SECRET_OAUTH_TOKEN_DO_NOT_LEAK');
  });
});
