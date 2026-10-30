/**
 * Legacy tenant resolver tests.
 *
 * Proves tenant selection for legacy affiliate postback URLs against a real
 * SQLite-backed fake D1 seeded from the REAL migrations (0082 edge tracking,
 * 0035 affiliate engine). The per-tenant credential vault is mocked at the
 * module boundary; all D1 lookups run for real.
 *
 * Contract: request-controlled tenant hints NEVER grant access by themselves —
 * resolution selects tenant + secret, and the caller must verify the HMAC
 * against that secret before persisting anything.
 *
 * @module land/postback/__tests__/legacy-tenant-resolver.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';

vi.mock('@/land/affiliates/credentials', () => ({
  getCredentials: vi.fn(),
}));

import { getCredentials } from '@/land/affiliates/credentials';
import {
  resolveLegacyTenantSecret,
  type ResolveLegacyTenantInput,
} from '../legacy-tenant-resolver';

type FakeD1 = ReturnType<typeof createFakeD1>;

function createLegacyD1(): FakeD1 {
  const tracking = readFileSync(resolve(process.cwd(), 'migrations/0082-edge-tracking.sql'), 'utf8');
  const engine = readFileSync(resolve(process.cwd(), 'migrations/0035-affiliate-engine.sql'), 'utf8');
  return createFakeD1([tracking, engine]);
}

async function seedTrackingLink(db: FakeD1, linkId: string, tenantId: string) {
  await db
    .prepare('INSERT INTO tracking_links (id, tenant_id, destination_url) VALUES (?, ?, ?)')
    .bind(linkId, tenantId, 'https://example.com/offer')
    .run();
}

async function seedAffiliateLink(db: FakeD1, subId: string, tenantId: string) {
  await db
    .prepare(
      `INSERT INTO affiliate_links (id, tenant_id, offer_id, user_id, code, sub_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(`aff_${subId}`, tenantId, 'offer_1', tenantId, `code_${subId}`, subId, Date.now())
    .run();
}

function mockCreds(secrets: Record<string, Record<string, string>>) {
  vi.mocked(getCredentials).mockImplementation(async (_db, tenantId, network) => {
    const secret = secrets[tenantId]?.[network];
    if (!secret) return null;
    return { network, api_secret: secret } as unknown as Awaited<ReturnType<typeof getCredentials>>;
  });
}

function input(
  db: FakeD1,
  dbNetwork: string,
  subIdCandidates: readonly (string | null | undefined)[],
  explicitTenantId: string | null,
): ResolveLegacyTenantInput {
  return { db: db as unknown as D1Database, dbNetwork, subIdCandidates, explicitTenantId };
}

describe('resolveLegacyTenantSecret', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves tenant from a tracking_links hit and returns the stored secret', async () => {
    const db = createLegacyD1();
    await seedTrackingLink(db, 'link_A1', 'tenant-a');
    mockCreds({ 'tenant-a': { amazon: 'amazon_secret_A' } });

    const res = await resolveLegacyTenantSecret(input(db, 'amazon', ['link_A1'], null));

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.tenantId).toBe('tenant-a');
    expect(res.linkId).toBe('link_A1');
    expect(res.secret).toBe('amazon_secret_A');
  });

  it('resolves tenant from an affiliate_links sub_id hit', async () => {
    const db = createLegacyD1();
    await seedAffiliateLink(db, 'SUB_A9', 'tenant-a');
    mockCreds({ 'tenant-a': { accesstrade: 'at_secret_A' } });

    const res = await resolveLegacyTenantSecret(input(db, 'accesstrade', ['SUB_A9'], null));

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.tenantId).toBe('tenant-a');
    expect(res.linkId).toBe('aff_SUB_A9');
    expect(res.secret).toBe('at_secret_A');
  });

  it('falls back to the explicit tenant hint when no link matches', async () => {
    const db = createLegacyD1();
    mockCreds({ 'tenant-b': { awin: 'awin_secret_B' } });

    const res = await resolveLegacyTenantSecret(input(db, 'awin', ['no-such-link'], 'tenant-b'));

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.tenantId).toBe('tenant-b');
    expect(res.linkId).toBeNull();
    expect(res.secret).toBe('awin_secret_B');
  });

  it('fails closed with tenant_unresolvable when nothing matches', async () => {
    const db = createLegacyD1();
    mockCreds({});

    const res = await resolveLegacyTenantSecret(input(db, 'amazon', ['ghost'], null));

    expect(res).toEqual({ ok: false, error: 'tenant_unresolvable' });
  });

  it('fails closed with secret_not_configured when the tenant has no credential', async () => {
    const db = createLegacyD1();
    await seedTrackingLink(db, 'link_C1', 'tenant-c');
    mockCreds({});

    const res = await resolveLegacyTenantSecret(input(db, 'tiktok_shop', ['link_C1'], null));

    expect(res).toEqual({ ok: false, error: 'secret_not_configured', tenantId: 'tenant-c' });
  });

  it('never resolves to a global/default tenant: unknown candidate stays unresolvable', async () => {
    const db = createLegacyD1();
    await seedTrackingLink(db, 'link_A1', 'tenant-a');
    mockCreds({ 'tenant-a': { amazon: 'amazon_secret_A' } });

    // Attacker guesses another tenant's link id — candidate does not exist.
    const res = await resolveLegacyTenantSecret(input(db, 'amazon', ['link_B_other'], null));

    expect(res).toEqual({ ok: false, error: 'tenant_unresolvable' });
  });

  it('skips blank candidates and accepts tenant hints from later candidates', async () => {
    const db = createLegacyD1();
    await seedTrackingLink(db, 'link_A1', 'tenant-a');
    mockCreds({ 'tenant-a': { amazon: 'amazon_secret_A' } });

    const res = await resolveLegacyTenantSecret(
      input(db, 'amazon', ['', null, undefined, '  ', 'link_A1'], null),
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.tenantId).toBe('tenant-a');
  });
});
