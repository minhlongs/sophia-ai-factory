/**
 * Route tests for POST /api/webhooks/saas-crypto/[network] (legacy delegate).
 *
 * The Domain B ledger service keeps its own unit tests (frozen economics);
 * here it is mocked at the module boundary. Tenant resolution runs against a
 * real SQLite-backed fake D1 seeded from the REAL migrations (0082 + 0035);
 * only the D1 binding lookup, the credential vault, and the Inngest fan-out
 * are mocked.
 *
 * Pins: 404/400/401 envelope, tenant resolution before the ledger call, the
 * resolved tenantId + stored secret passed through to the service, outcome ->
 * status mapping (transient 503 vs permanent 4xx), and no fan-out on
 * duplicates.
 *
 * @module app/api/webhooks/saas-crypto/[network]/__tests__/route.test
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/land/affiliates/credentials', () => ({
  getCredentials: vi.fn(),
}));

vi.mock('@/land/affiliates/postbacks/saas-crypto-postback-service', () => ({
  processSaasCryptoPostback: vi.fn(),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: { send: vi.fn().mockResolvedValue({ ids: ['evt-conv-1'] }) },
}));

import { getD1 } from '@/seed/db/client';
import { getCredentials } from '@/land/affiliates/credentials';
import { processSaasCryptoPostback } from '@/land/affiliates/postbacks/saas-crypto-postback-service';
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
  return new NextRequest(`http://localhost/api/webhooks/saas-crypto/${network}`, {
    method: 'POST',
    headers,
    body,
  });
}

describe('POST /api/webhooks/saas-crypto/[network]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 for unsupported network parameter', async () => {
    const res = await POST(post('unsupported_net', JSON.stringify({})), {
      params: { network: 'unsupported_net' },
    });
    expect(res.status).toBe(404);
    expect(processSaasCryptoPostback).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed JSON body', async () => {
    const res = await POST(post('partnerstack', 'not-json {{{'), {
      params: { network: 'partnerstack' },
    });
    expect(res.status).toBe(400);
    expect(processSaasCryptoPostback).not.toHaveBeenCalled();
  });

  it('returns 401 if signature header is missing', async () => {
    const res = await POST(post('partnerstack', JSON.stringify({ reward_amount_cents: 100 })), {
      params: { network: 'partnerstack' },
    });
    expect(res.status).toBe(401);
    expect(processSaasCryptoPostback).not.toHaveBeenCalled();
  });

  it('returns 503 (fail loud, provider retries) if D1 is unavailable', async () => {
    vi.mocked(getD1).mockResolvedValue(null);

    const res = await POST(
      post('partnerstack', JSON.stringify({}), { 'x-partnerstack-signature': 'x' }),
      { params: { network: 'partnerstack' } },
    );
    expect(res.status).toBe(503);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe('db_unavailable');
    expect(processSaasCryptoPostback).not.toHaveBeenCalled();
  });

  it('returns 422 tenant_unresolvable when no workspace link matches', async () => {
    const db = createLegacyD1();
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({});

    const res = await POST(
      post('binance', JSON.stringify({ tradeId: 'r1' }), { 'x-signature': 'x' }),
      { params: { network: 'binance' } },
    );
    expect(res.status).toBe(422);
    expect(processSaasCryptoPostback).not.toHaveBeenCalled();
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it('returns 503 secret_not_configured when the workspace has no credential', async () => {
    const db = createLegacyD1();
    await seedLink(db, 'link_A1', 'tenant-a');
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({});

    const res = await POST(
      post('partnerstack', JSON.stringify({ sub_id: 'link_A1' }), { 'x-partnerstack-signature': 'x' }),
      { params: { network: 'partnerstack' } },
    );
    expect(res.status).toBe(503);
    const data = (await res.json()) as { ok: boolean; error: string; tenantId: string };
    expect(data.error).toBe('secret_not_configured');
    expect(data.tenantId).toBe('tenant-a');
    expect(processSaasCryptoPostback).not.toHaveBeenCalled();
  });

  it('passes the resolved tenant + stored secret to the ledger service and fans out', async () => {
    const db = createLegacyD1();
    await seedLink(db, 'link_A1', 'tenant-a');
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({ 'tenant-a': { partnerstack: 'ps_secret_A' } });
    vi.mocked(processSaasCryptoPostback).mockResolvedValue({
      success: true,
      eventId: 'partnerstack_txn_ps_001_approved',
      network: 'partnerstack',
      commissionCents: 4500,
    });

    const raw = JSON.stringify({ id: 'txn_ps_001', sub_id: 'link_A1', reward_amount_cents: 4500 });
    const res = await POST(post('partnerstack', raw, { 'x-partnerstack-signature': 'sig' }), {
      params: { network: 'partnerstack' },
    });

    expect(res.status).toBe(200);
    expect(processSaasCryptoPostback).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        network: 'partnerstack',
        rawBody: raw,
        signature: 'sig',
        secret: 'ps_secret_A',
      }),
    );
    const data = (await res.json()) as { success: boolean; eventId: string; commissionCents: number };
    expect(data.success).toBe(true);
    expect(data.commissionCents).toBe(4500);
    expect(data.eventId).toBe('partnerstack_txn_ps_001_approved');
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'conversion.created',
        data: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    );
  });

  it('strips the Bearer prefix from the authorization header (Binance contract)', async () => {
    const db = createLegacyD1();
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({ 'tenant-b': { binance: 'bin_secret_B' } });
    vi.mocked(processSaasCryptoPostback).mockResolvedValue({
      success: true,
      eventId: 'binance_reb_99_approved',
      network: 'binance',
      commissionCents: 1550,
    });

    const raw = JSON.stringify({ tradeId: 'reb_99', tenant_id: 'tenant-b', rebateUsd: 15.5 });
    const res = await POST(post('binance', raw, { authorization: 'Bearer raw_sig_value' }), {
      params: { network: 'binance' },
    });

    expect(res.status).toBe(200);
    expect(processSaasCryptoPostback).toHaveBeenCalledWith(
      expect.objectContaining({ signature: 'raw_sig_value', secret: 'bin_secret_B' }),
    );
  });

  it('maps service INVALID_SIGNATURE to 401 without fan-out', async () => {
    const db = createLegacyD1();
    await seedLink(db, 'link_A1', 'tenant-a');
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({ 'tenant-a': { bybit: 'bb_secret_A' } });
    vi.mocked(processSaasCryptoPostback).mockResolvedValue({
      success: false,
      eventId: 'unknown',
      network: 'bybit',
      commissionCents: 0,
      error: 'INVALID_SIGNATURE',
    });

    const res = await POST(
      post('bybit', JSON.stringify({ sub_id: 'link_A1' }), { 'x-signature': 'wrong' }),
      { params: { network: 'bybit' } },
    );
    expect(res.status).toBe(401);
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it('maps service DB_WRITE_FAILED to 503 and INVALID_COMMISSION to 422', async () => {
    const db = createLegacyD1();
    await seedLink(db, 'link_A1', 'tenant-a');
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({ 'tenant-a': { rewardful: 'rw_secret_A' } });

    vi.mocked(processSaasCryptoPostback).mockResolvedValue({
      success: false,
      eventId: 'e1',
      network: 'rewardful',
      commissionCents: 0,
      error: 'DB_WRITE_FAILED',
    });
    const transient = await POST(
      post('rewardful', JSON.stringify({ sub_id: 'link_A1' }), { 'x-rewardful-signature': 's' }),
      { params: { network: 'rewardful' } },
    );
    expect(transient.status).toBe(503);
    expect(inngest.send).not.toHaveBeenCalled();

    vi.mocked(processSaasCryptoPostback).mockResolvedValue({
      success: false,
      eventId: 'e2',
      network: 'rewardful',
      commissionCents: 0,
      error: 'INVALID_COMMISSION',
    });
    const permanent = await POST(
      post('rewardful', JSON.stringify({ sub_id: 'link_A1' }), { 'x-rewardful-signature': 's' }),
      { params: { network: 'rewardful' } },
    );
    expect(permanent.status).toBe(422);
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it('skips the fan-out on idempotent duplicates', async () => {
    const db = createLegacyD1();
    await seedLink(db, 'link_A1', 'tenant-a');
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
    mockCreds({ 'tenant-a': { partnerstack: 'ps_secret_A' } });
    vi.mocked(processSaasCryptoPostback).mockResolvedValue({
      success: true,
      eventId: 'partnerstack_dup',
      network: 'partnerstack',
      commissionCents: 100,
      isIdempotentDuplicate: true,
    });

    const res = await POST(
      post('partnerstack', JSON.stringify({ sub_id: 'link_A1' }), { 'x-partnerstack-signature': 's' }),
      { params: { network: 'partnerstack' } },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { isIdempotentDuplicate: boolean };
    expect(data.isIdempotentDuplicate).toBe(true);
    expect(inngest.send).not.toHaveBeenCalled();
  });
});
