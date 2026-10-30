/**
 * Legacy ecommerce postback handler tests.
 *
 * End-to-contract proof for the shared legacy delegate core against a real
 * SQLite-backed fake D1 seeded from the REAL migrations (0082 + 0035).
 * Only the D1 binding lookup and the credential vault are mocked; body
 * parsing, tenant resolution, HMAC verification, extraction, and recording
 * all run for real with real HMAC-SHA256 fixtures.
 *
 * @module land/postback/__tests__/legacy-ecommerce-handler.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import { generateAffiliateHmac } from '@/tree/affiliate/hmac-verifier';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/land/affiliates/credentials', () => ({
  getCredentials: vi.fn(),
}));

import { getD1 } from '@/seed/db/client';
import { getCredentials } from '@/land/affiliates/credentials';
import {
  processLegacyEcommercePostback,
  type LegacyEcommerceContract,
  type LegacyPostbackRequest,
} from '../legacy-ecommerce-handler';

type FakeD1 = ReturnType<typeof createFakeD1>;
type Creds = Awaited<ReturnType<typeof getCredentials>>;

const ACCESSTRADE_CONTRACT: LegacyEcommerceContract = {
  slug: 'accesstrade',
  dbNetwork: 'accesstrade',
  sigHeaders: ['x-accesstrade-signature'],
  algorithm: 'SHA-256',
  logTag: 'test-accesstrade',
  txnIdFields: ['conversion_id'],
  subIdFields: ['sub_id'],
  clickIdField: 'click_id',
  grossField: 'order_value',
  commissionField: 'commission',
  approvedStatus: 'approved',
  missingTxnSkipCode: 'no_conversion_id',
};

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

function mockCreds(secrets: Record<string, Record<string, string>>) {
  vi.mocked(getCredentials).mockImplementation(async (_db, tenantId, network) => {
    const secret = secrets[tenantId]?.[network];
    if (!secret) return null;
    return { network, api_secret: secret } as unknown as Creds;
  });
}

function makeRequest(rawBody: string, signature: string | null, customHeaders?: Record<string, string>): LegacyPostbackRequest {
  const headers = new Headers();
  if (signature !== null) headers.set('x-accesstrade-signature', signature);
  if (customHeaders) {
    for (const [k, v] of Object.entries(customHeaders)) {
      headers.set(k, v);
    }
  }
  return {
    text: async () => rawBody,
    url: 'http://localhost/api/webhooks/accesstrade',
    headers,
  };
}

const BODY = {
  conversion_id: 'conv-1',
  sub_id: 'link_A1',
  click_id: 'clk-1',
  order_value: 100,
  commission: 8,
  status: 'approved',
};

describe('processLegacyEcommercePostback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a tenant-owned conversion on a valid signed postback', async () => {
    const db = createLegacyD1();
    await seedTrackingLink(db, 'link_A1', 'tenant-a');
    mockCreds({ 'tenant-a': { accesstrade: 'secret_A' } });
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    const rawBody = JSON.stringify(BODY);
    const sig = await generateAffiliateHmac(rawBody, 'secret_A');
    const res = await processLegacyEcommercePostback(makeRequest(rawBody, sig), ACCESSTRADE_CONTRACT);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      network: 'accesstrade',
      transactionId: 'conv-1',
      tenantId: 'tenant-a',
      commissionUsd: 8,
      status: 'approved',
    });
    const stored = await db
      .prepare('SELECT tenant_id, link_id, network_transaction_id FROM conversion_events')
      .first<{ tenant_id: string; link_id: string; network_transaction_id: string }>();
    expect(stored).toMatchObject({
      tenant_id: 'tenant-a',
      link_id: 'link_A1',
      network_transaction_id: 'accesstrade:conv-1',
    });
  });

  it('records pending when the provider status is not the approved value', async () => {
    const db = createLegacyD1();
    await seedTrackingLink(db, 'link_A1', 'tenant-a');
    mockCreds({ 'tenant-a': { accesstrade: 'secret_A' } });
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    const rawBody = JSON.stringify({ ...BODY, status: 'pending' });
    const sig = await generateAffiliateHmac(rawBody, 'secret_A');
    const res = await processLegacyEcommercePostback(makeRequest(rawBody, sig), ACCESSTRADE_CONTRACT);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'pending' });
  });

  it('fails 401 when the request is signed with another tenant secret', async () => {
    const db = createLegacyD1();
    await seedTrackingLink(db, 'link_A1', 'tenant-a');
    mockCreds({
      'tenant-a': { accesstrade: 'secret_A' },
      'tenant-b': { accesstrade: 'secret_B' },
    });
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    // Attacker replays tenant A's link but signs with tenant B's secret.
    const rawBody = JSON.stringify(BODY);
    const sig = await generateAffiliateHmac(rawBody, 'secret_B');
    const res = await processLegacyEcommercePostback(makeRequest(rawBody, sig), ACCESSTRADE_CONTRACT);

    expect(res.status).toBe(401);
    const count = await db
      .prepare('SELECT COUNT(*) AS n FROM conversion_events')
      .first<{ n: number }>();
    expect(count?.n).toBe(0);
  });

  it('acks duplicates with 200 + skipped:duplicate without a second row', async () => {
    const db = createLegacyD1();
    await seedTrackingLink(db, 'link_A1', 'tenant-a');
    mockCreds({ 'tenant-a': { accesstrade: 'secret_A' } });
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    const rawBody = JSON.stringify(BODY);
    const sig = await generateAffiliateHmac(rawBody, 'secret_A');
    await processLegacyEcommercePostback(makeRequest(rawBody, sig), ACCESSTRADE_CONTRACT);
    const replay = await processLegacyEcommercePostback(
      makeRequest(rawBody, sig),
      ACCESSTRADE_CONTRACT,
    );

    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ ok: true, skipped: 'duplicate' });
    const count = await db
      .prepare('SELECT COUNT(*) AS n FROM conversion_events')
      .first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it('fails 401 when the signature header is missing', async () => {
    const db = createLegacyD1();
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    const res = await processLegacyEcommercePostback(
      makeRequest(JSON.stringify(BODY), null),
      ACCESSTRADE_CONTRACT,
    );

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Missing signature header' });
  });

  it('fails 422 tenant_unresolvable when no link and no hint match', async () => {
    const db = createLegacyD1();
    mockCreds({});
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    const rawBody = JSON.stringify({ ...BODY, sub_id: 'ghost' });
    const sig = await generateAffiliateHmac(rawBody, 'whatever');
    const res = await processLegacyEcommercePostback(makeRequest(rawBody, sig), ACCESSTRADE_CONTRACT);

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ ok: false, error: 'tenant_unresolvable' });
  });

  it('fails 503 secret_not_configured when the tenant has no credential', async () => {
    const db = createLegacyD1();
    await seedTrackingLink(db, 'link_A1', 'tenant-a');
    mockCreds({});
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    const rawBody = JSON.stringify(BODY);
    const sig = await generateAffiliateHmac(rawBody, 'whatever');
    const res = await processLegacyEcommercePostback(makeRequest(rawBody, sig), ACCESSTRADE_CONTRACT);

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ ok: false, error: 'secret_not_configured', tenantId: 'tenant-a' });
  });

  it('fails 503 db_unavailable when D1 is missing', async () => {
    vi.mocked(getD1).mockResolvedValue(null);

    const res = await processLegacyEcommercePostback(
      makeRequest(JSON.stringify(BODY), 'x'),
      ACCESSTRADE_CONTRACT,
    );

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ error: 'db_unavailable' });
  });

  it('keeps the legacy 200 + skipped ack for unparseable bodies', async () => {
    const db = createLegacyD1();
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    const res = await processLegacyEcommercePostback(
      makeRequest('not-json {{{', 'x'),
      ACCESSTRADE_CONTRACT,
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, skipped: 'parse_error' });
  });

  it('keeps the legacy 200 + skipped ack when the transaction id is missing', async () => {
    const db = createLegacyD1();
    await seedTrackingLink(db, 'link_A1', 'tenant-a');
    mockCreds({ 'tenant-a': { accesstrade: 'secret_A' } });
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    const { conversion_id: _dropped, ...noTxn } = BODY;
    expect(_dropped).toBe('conv-1');
    const rawBody = JSON.stringify(noTxn);
    const sig = await generateAffiliateHmac(rawBody, 'secret_A');
    const res = await processLegacyEcommercePostback(makeRequest(rawBody, sig), ACCESSTRADE_CONTRACT);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, skipped: 'no_conversion_id' });
  });

  it('binds explicit tenant hints to the hint owner secret (cross-tenant hint fails 401)', async () => {
    const db = createLegacyD1();
    mockCreds({
      'tenant-a': { accesstrade: 'secret_A' },
      'tenant-b': { accesstrade: 'secret_B' },
    });
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    // Signed with A's secret but claiming tenant B: resolution picks B's
    // secret, so verification must fail.
    const rawBody = JSON.stringify({ ...BODY, sub_id: 'ghost', tenant_id: 'tenant-b' });
    const sig = await generateAffiliateHmac(rawBody, 'secret_A');
    const res = await processLegacyEcommercePostback(makeRequest(rawBody, sig), ACCESSTRADE_CONTRACT);

    expect(res.status).toBe(401);
  });

  it('returns 422 link_unattributed when the tenant verifies but no link matches', async () => {
    const db = createLegacyD1();
    mockCreds({ 'tenant-b': { accesstrade: 'secret_B' } });
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    const rawBody = JSON.stringify({ ...BODY, sub_id: 'ghost', tenant_id: 'tenant-b' });
    const sig = await generateAffiliateHmac(rawBody, 'secret_B');
    const res = await processLegacyEcommercePostback(makeRequest(rawBody, sig), ACCESSTRADE_CONTRACT);

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ ok: false, error: 'link_unattributed', tenantId: 'tenant-b' });
    const count = await db
      .prepare('SELECT COUNT(*) AS n FROM conversion_events')
      .first<{ n: number }>();
    expect(count?.n).toBe(0);
  });

  it('serializes fallback headers when headers.entries is not present', async () => {
    const db = createLegacyD1();
    mockCreds({});
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    const rawBody = JSON.stringify({ ...BODY, sub_id: 'ghost' });
    const sig = await generateAffiliateHmac(rawBody, 'whatever');

    const pseudoReq: LegacyPostbackRequest = {
      text: async () => rawBody,
      url: 'http://localhost/api/webhooks/accesstrade',
      headers: {
        get: (name: string) => {
          if (name === 'x-accesstrade-signature') return sig;
          if (name === 'cf-connecting-ip') return '9.9.9.9';
          if (name === 'user-agent') return 'test-agent';
          return null;
        },
      },
    };

    const res = await processLegacyEcommercePostback(pseudoReq, ACCESSTRADE_CONTRACT);
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ ok: false, error: 'tenant_unresolvable' });
  });
});
