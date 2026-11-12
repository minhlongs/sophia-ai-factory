/**
 * Tests for Postback Dead-Letter Queue (DLQ)
 *
 * Runs against a real SQLite-backed fake D1 seeded from the REAL migration, so
 * the upsert, the retry counter and the tenant scope are exercised by the
 * actual SQL rather than by a mock that reimplements it.
 *
 * @module land/postback/__tests__/postback-dead-letter.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import {
  enqueuePostbackDlq,
  listUnresolvedPostbackDlq,
  getPostbackDlqCounts,
  resolvePostbackDlqEntry,
} from '../postback-dead-letter';
import { getD1 } from '@/seed/db/client';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

type FakeD1 = ReturnType<typeof createFakeD1>;

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

const BASE_INPUT = {
  network: 'partnerstack',
  endpoint: 'https://sophia.agencyos.network/api/webhooks/saas-crypto/partnerstack',
  sourceIp: '1.2.3.4',
  headersJson: JSON.stringify({ 'x-partnerstack-signature': 'abc' }),
  rawBody: JSON.stringify({ amount: 100 }),
  failureReason: 'tenant_unresolvable',
  tenantHint: TENANT_A,
};

function createDlqD1(): FakeD1 {
  const schema = readFileSync(
    resolve(process.cwd(), 'migrations/0489_postback_dead_letter.sql'),
    'utf8',
  );
  return createFakeD1([schema]);
}

async function allRows(db: FakeD1) {
  const res = await db.prepare('SELECT * FROM postback_dead_letter').all<
    Record<string, unknown>
  >();
  return res.results;
}

function useDb(db: FakeD1) {
  vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database);
}

describe('Postback Dead-Letter Queue', () => {
  let db: FakeD1;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createDlqD1();
    useDb(db);
  });

  it('enqueues unmapped postback to dead-letter queue with correct fields', async () => {
    const id = await enqueuePostbackDlq(BASE_INPUT);

    expect(typeof id).toBe('string');
    const rows = await allRows(db);
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({
      network: 'partnerstack',
      failure_reason: 'tenant_unresolvable',
      resolved: 0,
      source_ip: '1.2.3.4',
      tenant_hint: TENANT_A,
      retry_count: 1,
    });
  });

  it('derives a stable id from the attribution key so redelivery is idempotent', async () => {
    const first = await enqueuePostbackDlq(BASE_INPUT);
    const second = await enqueuePostbackDlq(BASE_INPUT);
    const third = await enqueuePostbackDlq(BASE_INPUT);

    expect(first).toBe(second);
    expect(second).toBe(third);

    const rows = await allRows(db);
    expect(rows.length).toBe(1);
    expect(rows[0].retry_count).toBe(3);
  });

  it('refreshes last_attempted_at on redelivery while pinning created_at', async () => {
    const first = await enqueuePostbackDlq(BASE_INPUT);
    const before = await allRows(db);

    await new Promise((r) => setTimeout(r, 5));
    await enqueuePostbackDlq(BASE_INPUT);

    const after = await allRows(db);
    expect(after.length).toBe(1);
    expect(after[0].id).toBe(first);
    expect(after[0].created_at).toBe(before[0].created_at);
    expect(after[0].last_attempted_at).not.toBe(before[0].last_attempted_at);
    expect(after[0].retry_count).toBe(2);
  });

  it('treats a different failure reason as a distinct row', async () => {
    await enqueuePostbackDlq(BASE_INPUT);
    await enqueuePostbackDlq({ ...BASE_INPUT, failureReason: 'secret_not_configured' });

    const rows = await allRows(db);
    expect(rows.length).toBe(2);
  });

  it('keeps distinct payloads and tenants as distinct rows', async () => {
    await enqueuePostbackDlq(BASE_INPUT);
    await enqueuePostbackDlq({ ...BASE_INPUT, rawBody: JSON.stringify({ amount: 200 }) });
    await enqueuePostbackDlq({ ...BASE_INPUT, tenantHint: TENANT_B });
    await enqueuePostbackDlq({ ...BASE_INPUT, endpoint: 'https://example.com/other' });

    const rows = await allRows(db);
    expect(rows.length).toBe(4);
    expect(rows.every((r) => r.retry_count === 1)).toBe(true);
  });

  it('lists unresolved dead-letter items for the owning tenant', async () => {
    await enqueuePostbackDlq(BASE_INPUT);

    const unresolved = await listUnresolvedPostbackDlq(TENANT_A);
    expect(unresolved.length).toBe(1);
    expect(unresolved[0].network).toBe('partnerstack');
    expect(unresolved[0].tenant_hint).toBe(TENANT_A);
    expect(unresolved[0].resolved).toBe(false);
  });

  it('never lists another tenant\'s rows', async () => {
    await enqueuePostbackDlq(BASE_INPUT);
    await enqueuePostbackDlq({ ...BASE_INPUT, tenantHint: TENANT_B });

    expect((await listUnresolvedPostbackDlq(TENANT_A)).length).toBe(1);
    expect((await listUnresolvedPostbackDlq(TENANT_B)).length).toBe(1);
    expect(await listUnresolvedPostbackDlq('tenant-c')).toEqual([]);
  });

  it('never lists rows captured before a tenant could be verified', async () => {
    await enqueuePostbackDlq({ ...BASE_INPUT, tenantHint: null });

    expect(await listUnresolvedPostbackDlq(TENANT_A)).toEqual([]);
    expect(await listUnresolvedPostbackDlq('')).toEqual([]);
  });

  it('aggregates counts by network within the tenant scope', async () => {
    await enqueuePostbackDlq(BASE_INPUT);
    await enqueuePostbackDlq({ ...BASE_INPUT, failureReason: 'secret_not_configured' });
    await enqueuePostbackDlq({
      ...BASE_INPUT,
      network: 'binance',
      rawBody: JSON.stringify({ amount: 300 }),
    });
    await enqueuePostbackDlq({ ...BASE_INPUT, network: 'binance', tenantHint: TENANT_B });

    const counts = await getPostbackDlqCounts(TENANT_A);
    expect(counts.length).toBe(2);
    const byNetwork = Object.fromEntries(counts.map((c) => [c.network, c]));
    expect(byNetwork.partnerstack).toMatchObject({ total: 2, unresolved: 2 });
    expect(byNetwork.binance).toMatchObject({ total: 1, unresolved: 1 });

    const other = await getPostbackDlqCounts(TENANT_B);
    expect(other).toEqual([{ network: 'binance', total: 1, unresolved: 1 }]);
  });

  it('resolves a dead-letter entry for its owning tenant', async () => {
    const id = await enqueuePostbackDlq(BASE_INPUT);

    await resolvePostbackDlqEntry(TENANT_A, id!);

    const rows = await allRows(db);
    expect(rows[0].resolved).toBe(1);
    expect(rows[0].resolved_at).not.toBeNull();
    expect(await listUnresolvedPostbackDlq(TENANT_A)).toEqual([]);
  });

  it('refuses to resolve another tenant\'s entry', async () => {
    const id = await enqueuePostbackDlq(BASE_INPUT);

    await resolvePostbackDlqEntry(TENANT_B, id!);

    const rows = await allRows(db);
    expect(rows[0].resolved).toBe(0);
    expect(rows[0].resolved_at).toBeNull();
  });

  it('fails gracefully when D1 is unavailable across all operations', async () => {
    vi.mocked(getD1).mockResolvedValue(null as unknown as D1Database);

    expect(await enqueuePostbackDlq(BASE_INPUT)).toBeNull();
    expect(await listUnresolvedPostbackDlq(TENANT_A)).toEqual([]);
    expect(await getPostbackDlqCounts(TENANT_A)).toEqual([]);
    await expect(resolvePostbackDlqEntry(TENANT_A, 'some-id')).resolves.not.toThrow();
  });

  it('handles database errors gracefully across query operations', async () => {
    const errorD1 = {
      prepare: () => ({
        bind: () => ({
          run: async () => {
            throw new Error('D1 write error');
          },
          all: async () => {
            throw new Error('D1 read error');
          },
        }),
        all: async () => {
          throw new Error('D1 aggregation error');
        },
      }),
    };
    vi.mocked(getD1).mockResolvedValue(errorD1 as unknown as D1Database);

    expect(await enqueuePostbackDlq(BASE_INPUT)).toBeNull();
    expect(await listUnresolvedPostbackDlq(TENANT_A)).toEqual([]);
    expect(await getPostbackDlqCounts(TENANT_A)).toEqual([]);
    await expect(resolvePostbackDlqEntry(TENANT_A, 'some-id')).resolves.not.toThrow();
  });
});
