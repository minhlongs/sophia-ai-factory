/**
 * Route tests for POST /api/webhooks/affiliate/[network] (legacy delegate).
 *
 * Integration-style: real SQLite-backed fake D1 seeded from the REAL
 * migrations (0082 + 0035), real tenant resolution, real HMAC fixtures. Only
 * the D1 binding lookup, the credential vault, and the Inngest fan-out are
 * mocked.
 *
 * Pins the tenant-scoped contract: per-workspace secrets, fail-closed 422/503
 * on unresolvable tenants or missing credentials, the informative envelope on
 * success, clickbank routed to its dedicated endpoint, and no duplicate
 * fan-out on replays.
 *
 * @module app/api/webhooks/affiliate/[network]/__tests__/route.test
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import { generateAffiliateHmac } from '@/tree/affiliate/hmac-verifier';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/land/affiliates/credentials', () => ({
  getCredentials: vi.fn(),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: { send: vi.fn().mockResolvedValue({ ids: ['evt-1'] }) },
}));

import { getD1 } from '@/seed/db/client';
import { getCredentials } from '@/land/affiliates/credentials';
import { inngest } from '@/seed/inngest/client';
import { POST } from '../route';

type FakeD1 = ReturnType<typeof createFakeD1>;
type Creds = Awaited<ReturnType<typeof getCredentials>>;

function createLegacyD1(): FakeD1 {
  const tracking = readFileSync(resolve(process.cwd(), 'migrations/0082-edge-tracking.sql'), 'utf8');
  const engine = readFileSync(resolve(process.cwd(), 'migrations/0035-affiliate-engine.sql'), 'utf8');
  return createFakeD1([tracking, engine]);
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

function post(network: string, body: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost/api/webhooks/affiliate/${network}`, {
    method: 'POST',
    headers,
    body,
  });
}

describe('POST /api/webhooks/affiliate/[network]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 for unsupported network parameter', async () => {
    const res = await POST(post('nope', JSON.stringify({})), { params: { network: 'nope' } });
    expect(res.status).toBe(404);
  });

  it('returns 501 network_moved for clickbank with a canonical pointer', async () => {
    const res = await POST(post('clickbank', JSON.stringify({})), { params: { network: 'clickbank' } });
    expect(res.status).toBe(501);
    const data = (await res.json()) as { error: string; canonical: string };
    expect(data.error).toBe('network_moved');
    expect(data.canonical).toContain('/api/webhooks/clickbank');
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it('returns 503 (not a silent 200) when D1 is unavailable', async () => {
    vi.mocked(getD1).mockResolvedValue(null);

    const res = await POST(
      post('tiktok_shop', JSON.stringify({ order_id: 'o1' }), { 'x-tts-signature': 'x' }),
      { params: { network: 'tiktok_shop' } },
    );
    expect(res.status).toBe(503);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe('db_unavailable');
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it('returns 422 tenant_unresolvable when no workspace link matches', async () => {
    const db = createLegacyD1();
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({});

    const raw = JSON.stringify({ conversion_id: 't1', sub_id: 'ghost', order_value: 10, commission: 1 });
    const res = await POST(post('accesstrade', raw, { 'x-accesstrade-signature': 'x' }), {
      params: { network: 'accesstrade' },
    });
    expect(res.status).toBe(422);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe('tenant_unresolvable');
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it('returns 503 secret_not_configured when the workspace has no credential', async () => {
    const db = createLegacyD1();
    await seedLink(db, 'link_A1', 'tenant-a');
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({});

    const raw = JSON.stringify({ id: 't1', click_ref: 'link_A1', sale_amount: 10, commission_amount: 1 });
    const res = await POST(post('awin', raw, { 'x-awin-signature': 'x' }), {
      params: { network: 'awin' },
    });
    expect(res.status).toBe(503);
    const data = (await res.json()) as { ok: boolean; error: string; tenantId: string };
    expect(data.error).toBe('secret_not_configured');
    expect(data.tenantId).toBe('tenant-a');
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it('returns 401 when the signature header is missing', async () => {
    const db = createLegacyD1();
    await seedLink(db, 'link_A1', 'tenant-a');
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({ 'tenant-a': { tiktok_shop: 'secret_A' } });

    const raw = JSON.stringify({ order_id: 'o1', sub_id: 'link_A1' });
    const res = await POST(post('tiktok_shop', raw), { params: { network: 'tiktok_shop' } });
    expect(res.status).toBe(401);
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it('records a valid postback with the informative envelope and tenant-scoped fan-out', async () => {
    const db = createLegacyD1();
    await seedLink(db, 'link_A1', 'tenant-a');
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({ 'tenant-a': { tiktok_shop: 'secret_A' } });

    const raw = JSON.stringify({
      order_id: 'order-7',
      sub_id: 'link_A1',
      settlement_amount: 25.5,
      commission_amount: 2.55,
    });
    const sig = await generateAffiliateHmac(raw, 'secret_A');
    const res = await POST(post('tiktok_shop', raw, { 'x-tts-signature': sig }), {
      params: { network: 'tiktok_shop' },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data).toMatchObject({
      ok: true,
      success: true,
      conversionId: 'order-7',
      commissionCents: 255,
      network: 'tiktok_shop',
    });
    expect(typeof data['payableAt']).toBe('number');
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'conversion.created',
        data: expect.objectContaining({ tenantId: 'tenant-a', conversionEventId: 'order-7' }),
      }),
    );
  });

  it('acks replays without a second fan-out', async () => {
    const db = createLegacyD1();
    await seedLink(db, 'link_A1', 'tenant-a');
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({ 'tenant-a': { amazon: 'secret_A' } });

    const raw = JSON.stringify({
      order_id: 'D-1',
      tag: 'link_A1',
      revenue: 10,
      commission: 1,
      status: 'shipped',
    });
    const sig = await generateAffiliateHmac(raw, 'secret_A');
    const params = { params: { network: 'amazon' } };
    await POST(post('amazon', raw, { 'x-amazon-signature': sig }), params);
    expect(inngest.send).toHaveBeenCalledTimes(1);

    const replay = await POST(post('amazon', raw, { 'x-amazon-signature': sig }), params);
    expect(replay.status).toBe(200);
    const data = (await replay.json()) as { ok: boolean; skipped: string };
    expect(data).toMatchObject({ ok: true, skipped: 'duplicate' });
    expect(inngest.send).toHaveBeenCalledTimes(1);
  });
});
