/**
 * Route-level tenant isolation regression (Domain B postbacks).
 *
 * Proves, against a real SQLite-backed fake D1 seeded from the REAL
 * migrations, that a client-controlled `tenant_id` cannot redirect a
 * conversion into another workspace's ledger:
 *
 *  1. Linked postback: the tracking-link row wins over `tenant_id` in body.
 *  2. Link-less postback: verification uses the CLAIMED tenant's secret, so a
 *     request signed with tenant A's secret but claiming tenant B fails 401.
 *  3. Link-less postback signed with the claimed tenant's own secret succeeds
 *     and writes only that tenant's ledger.
 *  4. Unknown tenant (no credentials) fails closed with 401.
 *
 * The per-tenant secret source (`getCredentials`, BYOK vault) is mocked at the
 * module boundary; tenant selection, HMAC verification and every D1 read/write
 * run for real.
 *
 * @module app/api/postback/[network]/core/__tests__/route-handler-tenant-isolation.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const SECRET_A = 'tenant_a_partnerstack_signing_secret';
const SECRET_B = 'tenant_b_partnerstack_signing_secret';

function createTenantIsolationD1() {
  const tracking = readFileSync(resolve(process.cwd(), 'migrations/0082-edge-tracking.sql'), 'utf8');
  const commissionEvents = readFileSync(
    resolve(process.cwd(), 'migrations/0206_commission_events.sql'),
    'utf8',
  );
  const upgrade = readFileSync(
    resolve(process.cwd(), 'migrations/0482_opc_affiliate_execution_truth.sql'),
    'utf8',
  );
  return createFakeD1([tracking, commissionEvents, upgrade]);
}

async function seedLink(db: ReturnType<typeof createFakeD1>, linkId: string, tenantId: string) {
  await db
    .prepare('INSERT INTO tracking_links (id, tenant_id, destination_url) VALUES (?, ?, ?)')
    .bind(linkId, tenantId, 'https://example.com/offer')
    .run();
}

function postbackRequest(body: Record<string, unknown>, signature: string): NextRequest {
  return new NextRequest('http://localhost/api/postback/partnerstack', {
    method: 'POST',
    headers: { 'pstack-signature': signature, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function ledgerTenants(db: ReturnType<typeof createFakeD1>): Promise<string[]> {
  const rows = await db
    .prepare('SELECT DISTINCT tenant_id AS tenantId FROM workspace_external_commissions')
    .all<{ tenantId: string }>();
  return (rows.results ?? []).map((r) => r.tenantId).sort();
}

describe('handlePostbackRoute tenant isolation (Domain B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCredentials).mockImplementation(async (_db: unknown, tenantId: string) => {
      if (tenantId === 'ws_a') return { api_key: SECRET_A } as never;
      if (tenantId === 'ws_b') return { api_key: SECRET_B } as never;
      return null;
    });
  });

  it('linked postback: tracking-link tenant wins over client tenant_id; ledger stays in ws_a', async () => {
    const fakeDb = createTenantIsolationD1();
    await seedLink(fakeDb, 'linkAAAA', 'ws_a');
    vi.mocked(getD1).mockResolvedValue(fakeDb as unknown as D1Database);

    // Attacker replay: valid signature under A's secret, but body claims ws_b.
    const body = {
      link_id: 'linkAAAA',
      tenant_id: 'ws_b',
      id: 'txn_cross_1',
      partner_key: 'aff_a',
      reward_amount_cents: 1200,
    };
    const rawBody = JSON.stringify(body);
    const signature = await computeHmacSha256Hex(SECRET_A, rawBody);

    const res = await handlePostbackRoute(postbackRequest(body, signature), {
      params: Promise.resolve({ network: 'partnerstack' }),
    });

    expect(res.status).toBe(200);
    expect(await ledgerTenants(fakeDb)).toEqual(['ws_a']);
  });

  it('link-less postback signed with the wrong tenant secret fails 401 and writes nothing', async () => {
    const fakeDb = createTenantIsolationD1();
    vi.mocked(getD1).mockResolvedValue(fakeDb as unknown as D1Database);

    const body = {
      tenant_id: 'ws_b',
      id: 'txn_cross_2',
      partner_key: 'aff_b',
      reward_amount_cents: 1200,
    };
    const rawBody = JSON.stringify(body);
    // Signed with A's secret while claiming B.
    const signature = await computeHmacSha256Hex(SECRET_A, rawBody);

    const res = await handlePostbackRoute(postbackRequest(body, signature), {
      params: Promise.resolve({ network: 'partnerstack' }),
    });

    expect(res.status).toBe(401);
    expect(await ledgerTenants(fakeDb)).toEqual([]);
  });

  it('link-less postback signed with the claimed tenant secret succeeds in that tenant only', async () => {
    const fakeDb = createTenantIsolationD1();
    vi.mocked(getD1).mockResolvedValue(fakeDb as unknown as D1Database);

    const body = {
      tenant_id: 'ws_b',
      id: 'txn_legit_b',
      partner_key: 'aff_b',
      reward_amount_cents: 800,
    };
    const rawBody = JSON.stringify(body);
    const signature = await computeHmacSha256Hex(SECRET_B, rawBody);

    const res = await handlePostbackRoute(postbackRequest(body, signature), {
      params: Promise.resolve({ network: 'partnerstack' }),
    });

    expect(res.status).toBe(200);
    expect(await ledgerTenants(fakeDb)).toEqual(['ws_b']);
  });

  it('unknown tenant with no credentials fails closed with 401', async () => {
    const fakeDb = createTenantIsolationD1();
    vi.mocked(getD1).mockResolvedValue(fakeDb as unknown as D1Database);

    const body = {
      tenant_id: 'ws_unknown',
      id: 'txn_unknown_1',
      partner_key: 'aff_x',
      reward_amount_cents: 800,
    };
    const rawBody = JSON.stringify(body);
    const signature = await computeHmacSha256Hex('attacker_computed_secret', rawBody);

    const res = await handlePostbackRoute(postbackRequest(body, signature), {
      params: Promise.resolve({ network: 'partnerstack' }),
    });

    expect(res.status).toBe(401);
    expect(await ledgerTenants(fakeDb)).toEqual([]);
  });
});
