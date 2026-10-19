// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getD1: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ getD1: mocks.getD1 }));
vi.mock('../nowpayments-ipn-db', () => ({
  getDb: vi.fn(() => ({})),
  parseUserIdFromOrderId: vi.fn(() => 'owner'),
}));

import { clearOrgIdCache } from '@/seed/auth/org-resolver/session-org-cache';
import { setInL1OrgCache } from '@/seed/auth/org-resolver/session-org-cache';
import { clearUserTierCache, getUserTier } from '@/seed/db/get-user-tier';
import { handleRefunded } from '../nowpayments-ipn-refunded-failed';

type SqlInput = string | number | bigint | Uint8Array | null;

function createDatabase() {
  const sqlite = new DatabaseSync(':memory:') as DatabaseSync & { close(): void };
  sqlite.exec(`
    CREATE TABLE organizations (id TEXT PRIMARY KEY, user_id TEXT);
    CREATE TABLE org_members (org_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL);
    CREATE TABLE subscriptions (
      id INTEGER PRIMARY KEY, org_id TEXT NOT NULL, user_id TEXT, tier TEXT,
      plan TEXT, status TEXT NOT NULL, updated_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE raas_licenses (user_id TEXT NOT NULL, nonce TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO organizations (id) VALUES ('org-1');
    INSERT INTO org_members (org_id, user_id, role) VALUES ('org-1', 'owner', 'owner'), ('org-1', 'member', 'member');
    INSERT INTO subscriptions (org_id, user_id, tier, plan, status) VALUES ('org-1', 'owner', 'PREMIUM', 'premium', 'active');
    INSERT INTO raas_licenses (user_id, nonce) VALUES ('owner', 'nonce-owner'), ('member', 'nonce-member');
  `);

  const db = {
    prepare(sql: string) {
      let highest = 0;
      const normalized = sql.replace(/\?(\d*)/g, (_match, index: string) => {
        highest = index ? Math.max(highest, Number(index)) : highest + 1;
        return `?${index || highest}`;
      });
      const statement = sqlite.prepare(normalized);
      let bindings: SqlInput[] = [];
      const namedBindings = () => Object.fromEntries(bindings.map((value, index) => [String(index + 1), value]));
      return {
        bind(...values: SqlInput[]) { bindings = values; return this; },
        async first<T>() { return (statement.get(namedBindings()) ?? null) as T | null; },
        async all<T>() { return { success: true, results: statement.all(namedBindings()) as T[] }; },
        async run() {
          const result = statement.run(namedBindings());
          return { success: true, results: [], meta: { changes: Number(result.changes) } };
        },
      };
    },
  };
  return { sqlite, db };
}

describe('NOWPayments refund invalidates cached org entitlements', () => {
  let fixture: ReturnType<typeof createDatabase>;
  const kv = {
    get: vi.fn(async () => null),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async (_key: string) => undefined),
  };
  const previousKv = (globalThis as Record<string, unknown>).KV_KV;

  beforeEach(() => {
    clearOrgIdCache();
    clearUserTierCache();
    kv.get.mockClear();
    kv.put.mockClear();
    kv.delete.mockClear();
    Object.assign(globalThis, { KV_KV: kv });
    fixture = createDatabase();
    mocks.getD1.mockResolvedValue(fixture.db);
  });

  afterEach(() => {
    clearOrgIdCache();
    clearUserTierCache();
    fixture.sqlite.close();
    if (previousKv === undefined) delete (globalThis as Record<string, unknown>).KV_KV;
    else Object.assign(globalThis, { KV_KV: previousKv });
  });

  it.each(['resolved org cache', 'stale negative org cache'])('immediately downgrades the buyer and all org members after refund with %s', async (cacheState) => {
    expect(await getUserTier('owner')).toBe('PREMIUM');
    expect(await getUserTier('member')).toBe('PREMIUM');
    if (cacheState === 'stale negative org cache') setInL1OrgCache('owner', null);

    const result = await handleRefunded({
      payment_id: 'payment-refund-1',
      payment_status: 'refunded',
      order_id: 'sophia_owner_1',
    } as never);

    expect(result.ok).toBe(true);
    expect(sqliteStatus()).toBe('cancelled');
    expect(await getUserTier('owner')).toBe('BASIC');
    expect(await getUserTier('member')).toBe('BASIC');
    expect(kv.delete).toHaveBeenCalledWith('user_tier:owner');
    expect(kv.delete).toHaveBeenCalledWith('user_tier:member');
    expect(kv.delete).toHaveBeenCalledWith('license:nonce-owner');
    expect(kv.delete).toHaveBeenCalledWith('license:nonce-member');
    expect(kv.delete).toHaveBeenCalledWith('quota:owner:nonce-owner');
    expect(kv.delete).toHaveBeenCalledWith('quota:member:nonce-member');
  });

  it('does not acknowledge a refund before cross-isolate tier cache deletion completes', async () => {
    expect(await getUserTier('owner')).toBe('PREMIUM');

    let releaseDelete!: () => void;
    const deletionGate = new Promise<void>((resolve) => { releaseDelete = resolve; });
    kv.delete.mockImplementation(async (key) => {
      if (key === 'user_tier:owner') await deletionGate;
    });

    let settled = false;
    const resultPromise = handleRefunded({
      payment_id: 'payment-refund-cache-wait',
      payment_status: 'refunded',
      order_id: 'sophia_owner_1',
    } as never).then((result) => {
      settled = true;
      return result;
    });

    await vi.waitFor(() => expect(kv.delete).toHaveBeenCalledWith('user_tier:owner'));
    expect(settled).toBe(false);

    releaseDelete();
    expect((await resultPromise).ok).toBe(true);
    expect(settled).toBe(true);
  });

  it('falls back to the org tier when the latest direct subscription has no tier', async () => {
    fixture.sqlite.exec(`
      UPDATE subscriptions
      SET org_id = 'solo-owner', created_at = '2025-01-01T00:00:00.000Z'
      WHERE user_id = 'owner';
      INSERT INTO subscriptions (org_id, plan, status, created_at)
      VALUES ('org-1', 'enterprise', 'active', '2025-02-01T00:00:00.000Z');
      INSERT INTO subscriptions (org_id, user_id, tier, plan, status, created_at)
      VALUES ('solo-owner', 'owner', NULL, NULL, 'active', '2025-03-01T00:00:00.000Z');
    `);

    expect(await getUserTier('owner')).toBe('ENTERPRISE');
  });

  function sqliteStatus(): string | undefined {
    const row = fixture.sqlite.prepare('SELECT status FROM subscriptions WHERE org_id = ?1').get({ '1': 'org-1' }) as { status?: string } | undefined;
    return row?.status;
  }
});
