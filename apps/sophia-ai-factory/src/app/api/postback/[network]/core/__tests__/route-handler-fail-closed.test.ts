/**
 * Canonical postback fail-closed contract (non-Domain-B + guard rails).
 *
 * Proves against a real SQLite-backed fake D1 seeded from the REAL migrations
 * (0082 edge tracking + 0487 receipt idempotency):
 *
 *  1. Allow-listed slugs without a verifier (impact/cj/generic) return 501
 *     with guidance — never a misleading 401.
 *  2. A valid signed non-Domain-B postback records exactly one conversion row.
 *  3. Replays of the same provider receipt ack 200 with duplicate:true.
 *  4. Wrong-secret signatures fail 401 and write nothing.
 *  5. Unknown link ids fail 404; missing link/tenant hints fail 422.
 *  6. Missing D1 fails 503 (provider retries).
 *  7. With verification disabled and no credential, the Domain B outcome
 *     SECRET_NOT_CONFIGURED maps to 503 (transient), not 500.
 *
 * Only the D1 binding lookup and the credential vault are mocked; tenant
 * selection, HMAC verification, and every D1 read/write run for real.
 *
 * @module app/api/postback/[network]/core/__tests__/route-handler-fail-closed.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import { computeHmacSha256Hex } from '@/land/postback/hmac-verifier';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/land/affiliates/credentials', () => ({
  getCredentials: vi.fn(),
}));

import { getD1 } from '@/seed/db/client';
import { getCredentials } from '@/land/affiliates/credentials';
import { handlePostbackRoute } from '../route-handler';

type FakeD1 = ReturnType<typeof createFakeD1>;
type Creds = Awaited<ReturnType<typeof getCredentials>>;

const SECRET_A = 'tenant_a_tiktok_signing_secret';

function createTrackingD1(): FakeD1 {
  const tracking = readFileSync(resolve(process.cwd(), 'migrations/0082-edge-tracking.sql'), 'utf8');
  const receipts = readFileSync(
    resolve(process.cwd(), 'migrations/0487_postback_receipt_idempotency.sql'),
    'utf8',
  );
  return createFakeD1([tracking, receipts]);
}

function mockCreds(secrets: Record<string, Record<string, string>>) {
  vi.mocked(getCredentials).mockImplementation(async (_db, tenantId, network) => {
    const secret = secrets[tenantId]?.[network];
    if (!secret) return null;
    return { network, api_secret: secret } as unknown as Creds;
  });
}

async function seedLink(db: FakeD1, linkId: string, tenantId: string) {
  await db
    .prepare('INSERT INTO tracking_links (id, tenant_id, destination_url) VALUES (?, ?, ?)')
    .bind(linkId, tenantId, 'https://example.com/offer')
    .run();
}

async function countConversions(db: FakeD1): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM tracking_conversions')
    .first<{ n: number }>();
  return row?.n ?? -1;
}

function tiktokRequest(body: Record<string, unknown>, signature: string): NextRequest {
  return new NextRequest('http://localhost/api/postback/tiktok_shop', {
    method: 'POST',
    headers: { 'x-tiktok-signature': signature, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('handlePostbackRoute fail-closed contract', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.POSTBACK_SIGNATURE_VERIFICATION_ENABLED;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 501 network_not_supported for slugs without a verifier', async () => {
    for (const network of ['impact', 'cj', 'generic']) {
      const req = new NextRequest(`http://localhost/api/postback/${network}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const res = await handlePostbackRoute(req, { params: Promise.resolve({ network }) });
      expect(res.status).toBe(501);
      const data = (await res.json()) as { error: string; guidance: string };
      expect(data.error).toBe('network_not_supported');
      expect(data.guidance).toContain('postback-tenant-migration');
    }
    expect(getD1).not.toHaveBeenCalled();
  });

  it('records a valid signed non-Domain-B postback exactly once', async () => {
    const db = createTrackingD1();
    await seedLink(db, 'linkAAAA', 'tenant-a');
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({ 'tenant-a': { tiktok_shop: SECRET_A } });

    const body = { link_id: 'linkAAAA', external_id: 'ext-1', amount_usd: 42.5 };
    const raw = JSON.stringify(body);
    const sig = await computeHmacSha256Hex(SECRET_A, raw);

    const res = await handlePostbackRoute(tiktokRequest(body, sig), {
      params: Promise.resolve({ network: 'tiktok_shop' }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; conversionId: string; duplicate: boolean };
    expect(data.ok).toBe(true);
    expect(typeof data.conversionId).toBe('string');
    expect(data.duplicate).toBe(false);
    expect(await countConversions(db)).toBe(1);
  });

  it('acks replays with duplicate:true and no second row', async () => {
    const db = createTrackingD1();
    await seedLink(db, 'linkAAAA', 'tenant-a');
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({ 'tenant-a': { tiktok_shop: SECRET_A } });

    const body = { link_id: 'linkAAAA', external_id: 'ext-9', amount_usd: 10 };
    const raw = JSON.stringify(body);
    const sig = await computeHmacSha256Hex(SECRET_A, raw);
    const params = { params: Promise.resolve({ network: 'tiktok_shop' }) };

    await handlePostbackRoute(tiktokRequest(body, sig), params);
    const replay = await handlePostbackRoute(tiktokRequest(body, sig), params);

    expect(replay.status).toBe(200);
    const data = (await replay.json()) as { ok: boolean; duplicate: boolean };
    expect(data).toMatchObject({ ok: true, duplicate: true });
    expect(await countConversions(db)).toBe(1);
  });

  it('fails 401 on a wrong-secret signature and writes nothing', async () => {
    const db = createTrackingD1();
    await seedLink(db, 'linkAAAA', 'tenant-a');
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({ 'tenant-a': { tiktok_shop: SECRET_A } });

    const body = { link_id: 'linkAAAA', external_id: 'ext-2', amount_usd: 10 };
    const raw = JSON.stringify(body);
    const sig = await computeHmacSha256Hex('wrong_secret', raw);

    const res = await handlePostbackRoute(tiktokRequest(body, sig), {
      params: Promise.resolve({ network: 'tiktok_shop' }),
    });

    expect(res.status).toBe(401);
    expect(await countConversions(db)).toBe(0);
  });

  it('fails 404 for an unknown link id', async () => {
    const db = createTrackingD1();
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({});

    const body = { link_id: 'linkZZZZ', external_id: 'ext-3' };
    const raw = JSON.stringify(body);
    const sig = await computeHmacSha256Hex('whatever', raw);

    const res = await handlePostbackRoute(tiktokRequest(body, sig), {
      params: Promise.resolve({ network: 'tiktok_shop' }),
    });

    expect(res.status).toBe(404);
  });

  it('fails 422 when the link hint is missing', async () => {
    const db = createTrackingD1();
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({});

    const body = { external_id: 'ext-4' };
    const res = await handlePostbackRoute(tiktokRequest(body, 'x'), {
      params: Promise.resolve({ network: 'tiktok_shop' }),
    });

    expect(res.status).toBe(422);
  });

  it('fails 503 when D1 is unavailable', async () => {
    vi.mocked(getD1).mockResolvedValue(null);

    const body = { link_id: 'linkAAAA', external_id: 'ext-5' };
    const res = await handlePostbackRoute(tiktokRequest(body, 'x'), {
      params: Promise.resolve({ network: 'tiktok_shop' }),
    });

    expect(res.status).toBe(503);
  });

  it('maps Domain B SECRET_NOT_CONFIGURED to 503 when verification is disabled', async () => {
    process.env.POSTBACK_SIGNATURE_VERIFICATION_ENABLED = '0';
    const db = createTrackingD1();
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({});

    const body = { tenant_id: 'tenant-a', id: 'txn_1', reward_amount_cents: 100 };
    const req = new NextRequest('http://localhost/api/postback/partnerstack', {
      method: 'POST',
      headers: { 'pstack-signature': 'x', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await handlePostbackRoute(req, { params: Promise.resolve({ network: 'partnerstack' }) });

    expect(res.status).toBe(503);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data).toMatchObject({ ok: false, error: 'SECRET_NOT_CONFIGURED' });
  });
});
