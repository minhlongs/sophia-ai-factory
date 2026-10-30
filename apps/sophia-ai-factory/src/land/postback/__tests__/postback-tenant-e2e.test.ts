/**
 * Postback tenant-scope LOCAL end-to-end (PR-A acceptance, Task item 3 — postback slice).
 *
 * What is REAL here (nothing mocked except the Next.js request surface):
 *   - a real SQLite database built by applying the REAL migration files in
 *     order: 0035 (affiliate_links, conversion_events) -> 0082 (tracking_links,
 *     tracking_conversions) -> 0084 (affiliate_network_credentials) -> 0487
 *     (receipt idempotency) -> 0488 (credential network allow-list) -> 0438
 *     (error_log for the invalid-signature audit row).
 *     Migration 0248 is SKIPPED: its guard SQL (`INSERT ... VALUES ... WHERE`)
 *     is invalid SQLite committed broken in PR #42 and can never execute; the
 *     0084 -> 0488 chain is the real effective path (also proven in
 *     tree/affiliates credential-networks-0488.test.ts).
 *   - real AES-256-GCM credential vault round-trip via saveCredentials /
 *     getCredentials (fixture OAUTH_TOKEN_ENC_KEY, labeled, test-only).
 *   - real HMAC-SHA256 signatures computed with node:crypto over exact raw
 *     bodies, verified by the production verifiers.
 *   - real route/handler code: canonical POST /api/postback/tiktok_shop and
 *     legacy delegate POST /api/webhooks/accesstrade.
 *   - two isolated tenants (tenant-e2e-a / tenant-e2e-b) plus an unprovisioned
 *     tenant-c (link, no credential).
 *
 * What is FAKED: the HTTP transport (Request objects built in-process) and the
 * providers themselves (signed fixtures, never real accounts).
 *
 * Explicitly NOT covered (no production code exists — recorded, not faked):
 * pending -> paid lifecycle transitions, reversals/refunds. conversion_events
 * stores pending/approved per provider status mapping; no payout writer ships
 * in this scope.
 *
 * @module land/postback/__tests__/postback-tenant-e2e.test
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHmac } from 'node:crypto';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';

type FakeD1 = ReturnType<typeof createFakeD1>;

function sql(name: string): string {
  return readFileSync(resolve(process.cwd(), 'migrations', name), 'utf8');
}

const mocks = vi.hoisted(() => ({ db: null as unknown as FakeD1 }));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
  getD1: vi.fn().mockImplementation(async () => mocks.db),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST as canonicalPOST } from '@/app/api/postback/[network]/route';
import { POST as accesstradePOST } from '@/app/api/webhooks/accesstrade/route';
import { saveCredentials } from '@/tree/affiliates/credentials/storage';

const TENANT_A = 'tenant-e2e-a';
const TENANT_B = 'tenant-e2e-b';
const TENANT_C = 'tenant-e2e-c'; // link exists, credential missing
const LINK_A = 'e2eA0001'; // 8 chars: canonical link_id contract
const LINK_B = 'e2eB0001';
const LINK_C = 'e2eC0001';
const SUB_A = 'sub-e2e-A-1';
const SUB_B = 'sub-e2e-B-1';
const SECRET_A_TT = 'e2e-secret-A-tiktok';
const SECRET_B_TT = 'e2e-secret-B-tiktok';
const SECRET_A_AT = 'e2e-secret-A-accesstrade';
const SECRET_B_AT = 'e2e-secret-B-accesstrade';

function hmacHex(secret: string, raw: string): string {
  return createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
}

function canonicalRequest(linkId: string, body: Record<string, unknown>, secret: string): Request {
  const raw = JSON.stringify({ link_id: linkId, ...body });
  return new Request('https://sophia.agencyos.network/api/postback/tiktok_shop', {
    method: 'POST',
    body: raw,
    headers: { 'Content-Type': 'application/json', 'x-tiktok-signature': hmacHex(secret, raw) },
  });
}

function accesstradeRequest(
  body: Record<string, unknown>,
  secret: string,
  tenantHint?: string,
): Request {
  const raw = JSON.stringify(body);
  const url =
    'https://sophia.agencyos.network/api/webhooks/accesstrade' +
    (tenantHint ? `?tenant_id=${tenantHint}` : '');
  return new Request(url, {
    method: 'POST',
    body: raw,
    headers: { 'Content-Type': 'application/json', 'x-accesstrade-signature': hmacHex(secret, raw) },
  });
}

async function count(db: FakeD1, table: string, where = ''): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM ${table}${where ? ` WHERE ${where}` : ''}`)
    .first<{ n: number }>();
  return row?.n ?? -1;
}

describe('postback tenant-scope local e2e (real migrations + real vault + real HMAC)', () => {
  beforeAll(async () => {
    process.env.OAUTH_TOKEN_ENC_KEY = 'e2e'.padEnd(64, '0a1b').slice(0, 64);
    expect(process.env.OAUTH_TOKEN_ENC_KEY).toMatch(/^[0-9a-f]{64}$/);

    mocks.db = createFakeD1([
      sql('0035-affiliate-engine.sql'),
      sql('0082-edge-tracking.sql'),
      sql('0084-affiliate-network-credentials.sql'),
      sql('0487_postback_receipt_idempotency.sql'),
      sql('0488_extend_credential_networks_postback.sql'),
      sql('0438_error_log.sql'),
    ]);
    const db = mocks.db;

    for (const [id, tenant] of [
      [LINK_A, TENANT_A],
      [LINK_B, TENANT_B],
      [LINK_C, TENANT_C],
    ] as const) {
      await db
        .prepare('INSERT INTO tracking_links (id, tenant_id, destination_url) VALUES (?, ?, ?)')
        .bind(id, tenant, 'https://example.com/offer')
        .run();
    }
    await db
      .prepare(
        `INSERT INTO affiliate_links (id, tenant_id, offer_id, user_id, code, sub_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('aff-e2e-A1', TENANT_A, 'offer-A', 'user-A', 'code-A1', SUB_A, 1)
      .run();
    await db
      .prepare(
        `INSERT INTO affiliate_links (id, tenant_id, offer_id, user_id, code, sub_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('aff-e2e-B1', TENANT_B, 'offer-B', 'user-B', 'code-B1', SUB_B, 1)
      .run();

    // Real vault writes (AES-256-GCM). TENANT_C stores nothing on purpose.
    await saveCredentials(db as unknown as D1Database, TENANT_A, 'tiktok_shop', {
      api_secret: SECRET_A_TT,
    });
    await saveCredentials(db as unknown as D1Database, TENANT_B, 'tiktok_shop', {
      api_secret: SECRET_B_TT,
    });
    await saveCredentials(db as unknown as D1Database, TENANT_A, 'accesstrade', {
      api_secret: SECRET_A_AT,
    });
    await saveCredentials(db as unknown as D1Database, TENANT_B, 'accesstrade', {
      api_secret: SECRET_B_AT,
    });
  });

  it('canonical tiktok_shop: valid signed postback records one receipt for tenant A', async () => {
    const res = await canonicalPOST(
      canonicalRequest(LINK_A, { external_id: 'e2e-conv-1', amount_usd: 12.5 }, SECRET_A_TT) as never,
      { params: Promise.resolve({ network: 'tiktok_shop' }) } as never,
    );
    expect(res.status).toBe(200);

    const db = mocks.db;
    const row = await db
      .prepare(
        `SELECT c.network, c.external_conversion_id, c.amount_usd, l.tenant_id
         FROM tracking_conversions c JOIN tracking_links l ON l.id = c.link_id
         WHERE c.external_conversion_id = ?`,
      )
      .bind('e2e-conv-1')
      .first<{ network: string; external_conversion_id: string; amount_usd: number; tenant_id: string }>();
    expect(row).toMatchObject({
      network: 'tiktok_shop',
      external_conversion_id: 'e2e-conv-1',
      amount_usd: 12.5,
      tenant_id: TENANT_A,
    });
  });

  it('canonical tiktok_shop: exact replay is idempotent (no second row)', async () => {
    const before = await count(mocks.db, 'tracking_conversions');
    const res = await canonicalPOST(
      canonicalRequest(LINK_A, { external_id: 'e2e-conv-1', amount_usd: 12.5 }, SECRET_A_TT) as never,
      { params: Promise.resolve({ network: 'tiktok_shop' }) } as never,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, duplicate: true });
    expect(await count(mocks.db, 'tracking_conversions')).toBe(before);
  });

  it('canonical tiktok_shop: same key with corrected amount keeps both rows (reconcile)', async () => {
    const before = await count(mocks.db, 'tracking_conversions');
    const res = await canonicalPOST(
      canonicalRequest(LINK_A, { external_id: 'e2e-conv-1', amount_usd: 14.0 }, SECRET_A_TT) as never,
      { params: Promise.resolve({ network: 'tiktok_shop' }) } as never,
    );
    expect(res.status).toBe(200);
    expect(await count(mocks.db, 'tracking_conversions')).toBe(before + 1);
  });

  it('canonical tiktok_shop: mutated payload fails closed (401), row count stable, audit logged', async () => {
    const raw = JSON.stringify({ link_id: LINK_A, external_id: 'e2e-conv-evil', amount_usd: 999 });
    const req = new Request('https://sophia.agencyos.network/api/postback/tiktok_shop', {
      method: 'POST',
      body: raw + ' ', // signed body differs from sent body
      headers: {
        'Content-Type': 'application/json',
        'x-tiktok-signature': hmacHex(SECRET_A_TT, raw),
      },
    });
    const before = await count(mocks.db, 'tracking_conversions');
    const res = await canonicalPOST(req as never, {
      params: Promise.resolve({ network: 'tiktok_shop' }),
    } as never);
    expect(res.status).toBe(401);
    expect(await count(mocks.db, 'tracking_conversions')).toBe(before);
    expect(await count(mocks.db, 'error_log')).toBeGreaterThanOrEqual(1);
  });

  it('canonical tiktok_shop: cross-tenant secret cannot spend another tenant link (401)', async () => {
    const before = await count(mocks.db, 'tracking_conversions');
    const res = await canonicalPOST(
      canonicalRequest(LINK_A, { external_id: 'e2e-conv-x', amount_usd: 5 }, SECRET_B_TT) as never,
      { params: Promise.resolve({ network: 'tiktok_shop' }) } as never,
    );
    expect(res.status).toBe(401);
    expect(await count(mocks.db, 'tracking_conversions')).toBe(before);
  });

  it('canonical tiktok_shop: unknown link fails closed (404), no default tenant', async () => {
    const res = await canonicalPOST(
      canonicalRequest('nope0000', { external_id: 'e2e-conv-y', amount_usd: 5 }, SECRET_A_TT) as never,
      { params: Promise.resolve({ network: 'tiktok_shop' }) } as never,
    );
    expect(res.status).toBe(404);
  });

  it('canonical tiktok_shop: unprovisioned tenant link fails closed (401 via empty secret), no row', async () => {
    const before = await count(mocks.db, 'tracking_conversions');
    const res = await canonicalPOST(
      canonicalRequest(LINK_C, { external_id: 'e2e-conv-c', amount_usd: 5 }, 'any-secret') as never,
      { params: Promise.resolve({ network: 'tiktok_shop' }) } as never,
    );
    expect(res.status).toBe(401);
    expect(await count(mocks.db, 'tracking_conversions')).toBe(before);
  });

  it('legacy accesstrade: approved conversion records namespaced receipt for tenant B', async () => {
    const res = await accesstradePOST(
      accesstradeRequest(
        {
          conversion_id: 'e2e-at-100',
          sub_id: SUB_B,
          click_id: 'click-b-1',
          order_value: 200,
          commission: 30,
          status: 'approved',
        },
        SECRET_B_AT,
      ) as never,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      network: 'accesstrade',
      transactionId: 'e2e-at-100',
      tenantId: TENANT_B,
      commissionUsd: 30,
      status: 'approved',
    });

    const row = await mocks.db
      .prepare('SELECT * FROM conversion_events WHERE network_transaction_id = ?')
      .bind('accesstrade:e2e-at-100')
      .first<{
        tenant_id: string;
        link_id: string;
        click_id: string;
        gross_amount_usd: number;
        commission_usd: number;
        status: string;
      }>();
    expect(row).toMatchObject({
      tenant_id: TENANT_B,
      link_id: 'aff-e2e-B1',
      click_id: 'click-b-1',
      gross_amount_usd: 200,
      commission_usd: 30,
      status: 'approved',
    });
  });

  it('legacy accesstrade: non-approved status records pending (same receipt table)', async () => {
    const res = await accesstradePOST(
      accesstradeRequest(
        {
          conversion_id: 'e2e-at-101',
          sub_id: SUB_A,
          order_value: 50,
          commission: 7.5,
          status: 'pending',
        },
        SECRET_A_AT,
      ) as never,
    );
    expect(res.status).toBe(200);
    const row = await mocks.db
      .prepare('SELECT tenant_id, status FROM conversion_events WHERE network_transaction_id = ?')
      .bind('accesstrade:e2e-at-101')
      .first<{ tenant_id: string; status: string }>();
    expect(row).toMatchObject({ tenant_id: TENANT_A, status: 'pending' });
  });

  it('legacy accesstrade: exact replay acks as duplicate, row count stable', async () => {
    const before = await count(mocks.db, 'conversion_events');
    const res = await accesstradePOST(
      accesstradeRequest(
        {
          conversion_id: 'e2e-at-100',
          sub_id: SUB_B,
          order_value: 200,
          commission: 30,
          status: 'approved',
        },
        SECRET_B_AT,
      ) as never,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, skipped: 'duplicate' });
    expect(await count(mocks.db, 'conversion_events')).toBe(before);
  });

  it('legacy accesstrade: explicit tenant hint cannot steal another tenant link', async () => {
    // sub_id belongs to B, hint claims A, signed with B's real secret:
    // attribution follows the verified link (B), the hint is ignored.
    const res = await accesstradePOST(
      accesstradeRequest(
        {
          conversion_id: 'e2e-at-102',
          sub_id: SUB_B,
          order_value: 10,
          commission: 1,
          status: 'approved',
        },
        SECRET_B_AT,
        TENANT_A,
      ) as never,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ tenantId: TENANT_B });

    // Same payload signed with A's secret: the link resolves to B, whose
    // secret differs -> 401. Nothing is recorded under either tenant.
    const before = await count(mocks.db, 'conversion_events');
    const res2 = await accesstradePOST(
      accesstradeRequest(
        {
          conversion_id: 'e2e-at-103',
          sub_id: SUB_B,
          order_value: 10,
          commission: 1,
          status: 'approved',
        },
        SECRET_A_AT,
        TENANT_A,
      ) as never,
    );
    expect(res2.status).toBe(401);
    expect(await count(mocks.db, 'conversion_events')).toBe(before);
  });

  it('legacy accesstrade: unknown sub-id fails closed (422), writes no ledger row', async () => {
    const before = await count(mocks.db, 'conversion_events');
    const res = await accesstradePOST(
      accesstradeRequest(
        { conversion_id: 'e2e-at-104', sub_id: 'sub-unknown-zzz', order_value: 10, commission: 1 },
        SECRET_A_AT,
      ) as never,
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ ok: false, error: 'tenant_unresolvable' });
    expect(await count(mocks.db, 'conversion_events')).toBe(before);
  });

  it('legacy accesstrade: unprovisioned tenant fails closed (503, retryable), writes no row', async () => {
    const before = await count(mocks.db, 'conversion_events');
    const res = await accesstradePOST(
      accesstradeRequest(
        { conversion_id: 'e2e-at-105', sub_id: LINK_C, order_value: 10, commission: 1 },
        'any-secret',
      ) as never,
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: 'secret_not_configured',
      tenantId: TENANT_C,
    });
    expect(await count(mocks.db, 'conversion_events')).toBe(before);
  });

  it('receipt namespace: same provider txn id on two networks coexists (no cross-provider collision)', async () => {
    const res = await accesstradePOST(
      accesstradeRequest(
        {
          conversion_id: 'e2e-conv-1',
          sub_id: SUB_A,
          order_value: 12.5,
          commission: 2,
          status: 'approved',
        },
        SECRET_A_AT,
      ) as never,
    );
    expect(res.status).toBe(200);
    // 'e2e-conv-1' already exists in tracking_conversions (canonical leg) and
    // now also as 'accesstrade:e2e-conv-1' in conversion_events: namespaces
    // are independent by design.
    expect(
      await count(mocks.db, 'tracking_conversions', `external_conversion_id = 'e2e-conv-1'`),
    ).toBe(2); // original + amount-correction row
    expect(
      await count(mocks.db, 'conversion_events', `network_transaction_id = 'accesstrade:e2e-conv-1'`),
    ).toBe(1);
  });

  it('tenant separation: per-tenant receipt counts match exactly what each tenant earned', async () => {
    expect(await count(mocks.db, 'conversion_events', `tenant_id = '${TENANT_A}'`)).toBe(2);
    expect(await count(mocks.db, 'conversion_events', `tenant_id = '${TENANT_B}'`)).toBe(2);
    expect(await count(mocks.db, 'conversion_events', `tenant_id = '${TENANT_C}'`)).toBe(0);
    const sum = await mocks.db
      .prepare(
        `SELECT tenant_id, SUM(commission_usd) AS total
         FROM conversion_events GROUP BY tenant_id ORDER BY tenant_id`,
      )
      .all<{ tenant_id: string; total: number }>();
    const totals = Object.fromEntries((sum.results ?? []).map((r) => [r.tenant_id, r.total]));
    expect(totals[TENANT_A]).toBeCloseTo(7.5 + 2, 6);
    expect(totals[TENANT_B]).toBeCloseTo(30 + 1, 6);
  });
});
