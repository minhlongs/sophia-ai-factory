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
  const dlq = readFileSync(resolve(process.cwd(), 'migrations/0489_postback_dead_letter.sql'), 'utf8');
  return createFakeD1([tracking, engine, dlq]);
}

async function dlqRows(db: FakeD1) {
  const res = await db
    .prepare('SELECT * FROM postback_dead_letter ORDER BY created_at ASC')
    .all<Record<string, unknown>>();
  return res.results;
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
    expect(res.body).toMatchObject({ ok: false, error: 'secret_not_configured' });
    expect(res.body).not.toHaveProperty('tenantId');
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

  it('still acks 200 + skipped for permanent garbage when D1 is missing', async () => {
    // A missing binding must not turn a permanently unprocessable body into a
    // 503: providers read 503 as transient and would retry-storm a payload
    // that can never succeed. Capture is best-effort, the ack is not.
    vi.mocked(getD1).mockResolvedValue(null);

    const parseRes = await processLegacyEcommercePostback(
      makeRequest('not-json {{{', 'x'),
      ACCESSTRADE_CONTRACT,
    );
    expect(parseRes.status).toBe(200);
    expect(parseRes.body).toMatchObject({ ok: true, skipped: 'parse_error' });

    const noTxnRes = await processLegacyEcommercePostback(
      makeRequest(JSON.stringify({ order_value: 10 }), 'x'),
      ACCESSTRADE_CONTRACT,
    );
    expect(noTxnRes.status).toBe(200);
    expect(noTxnRes.body).toMatchObject({ ok: true, skipped: 'no_conversion_id' });
  });

  it('captures unparseable bodies to the DLQ before acking 200 + skipped', async () => {
    const db = createLegacyD1();
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    const res = await processLegacyEcommercePostback(
      makeRequest('not-json {{{', 'x'),
      ACCESSTRADE_CONTRACT,
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, skipped: 'parse_error' });
    const rows = await dlqRows(db);
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({
      network: 'accesstrade',
      failure_reason: 'parse_error',
      payload: 'not-json {{{',
      tenant_hint: null,
    });
  });

  it('captures a missing transaction id to the DLQ before acking 200 + skipped', async () => {
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
    const rows = await dlqRows(db);
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({
      failure_reason: 'no_conversion_id',
      tenant_hint: null,
    });
  });

  it('collapses repeated unparseable deliveries onto one DLQ row', async () => {
    const db = createLegacyD1();
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    for (let i = 0; i < 3; i++) {
      const res = await processLegacyEcommercePostback(
        makeRequest('not-json {{{', 'x'),
        ACCESSTRADE_CONTRACT,
      );
      expect(res.status).toBe(200);
    }

    const rows = await dlqRows(db);
    expect(rows.length).toBe(1);
    expect(rows[0].retry_count).toBe(3);
  });

  it('stores no tenant attribution on an unverified tenant hint', async () => {
    const db = createLegacyD1();
    mockCreds({});
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    // The hint resolves to a workspace that has no credential for this network,
    // so resolution fails 503 secret_not_configured. That failure happens before
    // any signature check: the hint is attacker-chosen and must not be stored.
    const rawBody = JSON.stringify({ ...BODY, sub_id: 'ghost', tenant_id: 'tenant-victim' });
    const res = await processLegacyEcommercePostback(
      makeRequest(rawBody, 'x'),
      ACCESSTRADE_CONTRACT,
    );

    expect(res.status).toBe(503);
    const rows = await dlqRows(db);
    expect(rows.length).toBe(1);
    expect(rows[0].failure_reason).toBe('secret_not_configured');
    expect(rows[0].tenant_hint).toBeNull();
  });

  it('trusts cf-connecting-ip and ignores the client-controlled x-forwarded-for', async () => {
    const db = createLegacyD1();
    mockCreds({});
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    const rawBody = JSON.stringify({ ...BODY, sub_id: 'ghost' });
    const res = await processLegacyEcommercePostback(
      makeRequest(rawBody, 'x', {
        'cf-connecting-ip': '9.9.9.9',
        'x-forwarded-for': '1.1.1.1',
      }),
      ACCESSTRADE_CONTRACT,
    );

    expect(res.status).toBe(422);
    const rows = await dlqRows(db);
    expect(rows[0].source_ip).toBe('9.9.9.9');
  });

  it('records no source ip when the edge header is absent, rather than falling back', async () => {
    const db = createLegacyD1();
    mockCreds({});
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    const rawBody = JSON.stringify({ ...BODY, sub_id: 'ghost' });
    const res = await processLegacyEcommercePostback(
      makeRequest(rawBody, 'x', { 'x-forwarded-for': '1.1.1.1' }),
      ACCESSTRADE_CONTRACT,
    );

    expect(res.status).toBe(422);
    const rows = await dlqRows(db);
    expect(rows[0].source_ip).toBeNull();
  });

  it('attributes the DLQ row to the tenant once the signature verifies, while still redacting headers and query string', async () => {
    const db = createLegacyD1();
    mockCreds({ 'tenant-b': { accesstrade: 'secret_B' } });
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    const rawBody = JSON.stringify({ ...BODY, sub_id: 'ghost', tenant_id: 'tenant-b' });
    const sig = await generateAffiliateHmac(rawBody, 'secret_B');
    const req = makeRequest(rawBody, sig, {
      cookie: 'session=post_hmac_session_probe',
      'x-api-key': 'pk_post_hmac_probe',
      'user-agent': 'accesstrade-webhook/1.0',
    });
    const res = await processLegacyEcommercePostback(
      { ...req, url: 'http://localhost/api/webhooks/accesstrade?token=query_token_probe&email=ceo%40example.com' },
      ACCESSTRADE_CONTRACT,
    );

    expect(res.status).toBe(422);
    const rows = await dlqRows(db);
    expect(rows[0]).toMatchObject({
      endpoint: 'http://localhost/api/webhooks/accesstrade',
      failure_reason: 'link_unattributed',
      tenant_hint: 'tenant-b',
    });
    const storedHeaders = String(rows[0].headers_json);
    expect(storedHeaders).not.toContain(sig);
    expect(storedHeaders).not.toContain('post_hmac_session_probe');
    expect(storedHeaders).not.toContain('pk_post_hmac_probe');
    const parsed = JSON.parse(storedHeaders) as Record<string, string>;
    expect(parsed['user-agent']).toBe('accesstrade-webhook/1.0');
    expect(parsed['x-accesstrade-signature']).toMatch(/^sigfp:[0-9a-f]{16}$/);
    expect(Object.keys(parsed).sort()).toEqual(['user-agent', 'x-accesstrade-signature']);
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

  it('captures a request that exposes only get() without storing the signature', async () => {
    const db = createLegacyD1();
    mockCreds({});
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    const rawBody = JSON.stringify({ ...BODY, sub_id: 'ghost' });
    const sig = await generateAffiliateHmac(rawBody, 'whatever');

    // Deliberately no `entries`: the request surface Next.js hands a route
    // handler has no enumerable header set here, and the serializer must not
    // depend on one to be safe.
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

    const rows = await dlqRows(db);
    expect(rows.length).toBe(1);
    const storedHeaders = String(rows[0].headers_json);
    const parsed = JSON.parse(storedHeaders) as Record<string, string>;

    // Negative proof: the HMAC value itself never reaches the queue.
    expect(storedHeaders).not.toContain(sig);
    expect(parsed['user-agent']).toBe('test-agent');
    expect(parsed['x-accesstrade-signature']).toMatch(/^sigfp:[0-9a-f]{16}$/);
    expect(Object.keys(parsed).sort()).toEqual(['user-agent', 'x-accesstrade-signature']);
  });

  it('never stores credential headers the contract did not declare', async () => {
    const db = createLegacyD1();
    mockCreds({});
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    const rawBody = JSON.stringify({ ...BODY, sub_id: 'ghost' });
    const res = await processLegacyEcommercePostback(
      makeRequest(rawBody, 'x', {
        authorization: 'Bearer sk_live_dlq_leak_probe',
        cookie: 'session=dlq-session-probe',
        'x-custom-provider-api-key': 'pk_live_dlq_probe',
        'user-agent': 'provider/2.0',
      }),
      ACCESSTRADE_CONTRACT,
    );

    // Unresolvable tenant fails closed 422; the payload was captured first.
    expect(res.status).toBe(422);

    const rows = await dlqRows(db);
    const storedHeaders = String(rows[0].headers_json);

    for (const secret of [
      'sk_live_dlq_leak_probe',
      'dlq-session-probe',
      'pk_live_dlq_probe',
      'Bearer',
    ]) {
      expect(storedHeaders).not.toContain(secret);
    }
    // The declared signature header survives only as a digest; nothing else
    // the caller sent is retained.
    const parsed = JSON.parse(storedHeaders) as Record<string, string>;
    expect(parsed).toMatchObject({ 'user-agent': 'provider/2.0' });
    expect(parsed['x-accesstrade-signature']).toMatch(/^sigfp:[0-9a-f]{16}$/);
    expect(Object.keys(parsed).sort()).toEqual(['user-agent', 'x-accesstrade-signature']);
  });

  it('collapses redeliveries that differ only by query string onto one row', async () => {
    const db = createLegacyD1();
    mockCreds({});
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);

    const rawBody = JSON.stringify({ ...BODY, sub_id: 'ghost' });
    const withQuery = (query: string): LegacyPostbackRequest => ({
      text: async () => rawBody,
      url: `http://localhost/api/webhooks/accesstrade?${query}`,
      headers: { get: (n: string) => (n === 'x-accesstrade-signature' ? 'x' : null) },
    });

    // Same route, different secret-bearing query strings: a provider that
    // signs the URL would otherwise mint a fresh row per redelivery.
    await processLegacyEcommercePostback(
      withQuery('signature=first-query-hmac&email=user%40corp.com'),
      ACCESSTRADE_CONTRACT,
    );
    await processLegacyEcommercePostback(
      withQuery('signature=second-query-hmac&email=other%40corp.com'),
      ACCESSTRADE_CONTRACT,
    );

    const rows = await dlqRows(db);
    expect(rows.length).toBe(1);
    expect(rows[0].retry_count).toBe(2);
    expect(rows[0].endpoint).toBe('http://localhost/api/webhooks/accesstrade');
    expect(String(rows[0].endpoint)).not.toContain('hmac');
    expect(String(rows[0].endpoint)).not.toContain('corp.com');
  });
});
