// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingOrder } from '@/land/orders/pending-order-types';
import type { DbClient } from './payos-idempotency';

const mocks = vi.hoisted(() => ({ resolveOrgId: vi.fn(), invalidateOrgIdCache: vi.fn(), getD1: vi.fn() }));
vi.mock('@/seed/auth/workspace-access', () => ({ resolveOrgId: mocks.resolveOrgId }));
vi.mock('@/seed/auth/org-resolver', () => ({ invalidateOrgIdCache: mocks.invalidateOrgIdCache }));
vi.mock('@/seed/db/client', () => ({ getD1: mocks.getD1 }));
import { getUserTier, clearUserTierCache } from '@/seed/db/get-user-tier';
import { activatePayOsSubscription } from './payos-subscription';

// The repository's minimal node:sqlite shim omits the native value and close types.
type SQLInputValue = string | number | bigint | Uint8Array | null;

const lockCreatedAt = '2026-10-18T00:00:00.000Z';
const order: PendingOrder = {
  order_id: 'sqlite-order', user_id: 'buyer', tier: 'BASIC', period: 'monthly',
  payment_method: 'payos', amount_usd_cents: 19900, amount_vnd: 4975000,
  promo_code: null, customer_email: null, invoice_url: null, status: 'pending',
  payment_id: null, created_at: lockCreatedAt, completed_at: null, provider_payment_id: 'link-1',
};

function sqliteFixture() {
  const sqlite = new DatabaseSync(':memory:') as DatabaseSync & { close(): void };
  // Execute the canonical schema and rebuild migrations, including 0086 prerequisites.
  for (const migration of [
    '0001-init.sql', '0002-payment-events.sql', '0070-pending-orders.sql',
    '0086-subscriptions-add-user-tier.sql', '0087-subscriptions-drop-user-id-fk.sql',
    '0088-org-members-drop-user-id-fk.sql', '0187_add_provider_payment_id_to_pending_orders.sql',
    '0188_add_amount_vnd_to_pending_orders.sql',
  ]) sqlite.exec(readFileSync(resolve('migrations', migration), 'utf8'));
  sqlite.exec("PRAGMA foreign_keys = ON; INSERT INTO organizations(id,name,slug,plan) VALUES ('unrelated','Other tenant','other','premium');");
  sqlite.prepare('INSERT INTO pending_orders(order_id,user_id,tier,period,payment_method,amount_usd_cents,amount_vnd,provider_payment_id) VALUES (?,?,?,?,?,?,?,?)')
    .run(order.order_id, order.user_id, order.tier, order.period, 'payos', order.amount_usd_cents, order.amount_vnd ?? null, 'link-1');
  sqlite.prepare('INSERT INTO payment_events(event_id,event_type,created_at,processed) VALUES (?,?,?,0)')
    .run('payos_link-1', 'payment', lockCreatedAt);

  function prepare(sql: string) {
    // node:sqlite binds numbered parameters by name; normalize anonymous slots to
    // their SQLite slot number while preserving repeated ?N placeholders.
    let highest = 0;
    const normalized = sql.replace(/\?(\d*)/g, (_, index: string) => {
      highest = index ? Math.max(highest, Number(index)) : highest + 1;
      return `?${index || highest}`;
    });
    let values: SQLInputValue[] = [];
    const statement = sqlite.prepare(normalized);
    const bindings = () => Object.fromEntries(values.map((value, index) => [String(index + 1), value]));
    return {
      bind(...args: SQLInputValue[]) { values = args; return this; },
      async first<T>() { return (statement.get(bindings()) ?? null) as T | null; },
      execute() { return statement.run(bindings()); },
    };
  }
  const hooks: { beforeBatch?: () => void } = {};
  const rawDb = {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      hooks.beforeBatch?.();
      // D1 batch commits atomically and rolls back on a SQL error.
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((statement) => ({ success: true, meta: { changes: Number(statement.execute().changes) } }));
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const db = { unwrap: () => rawDb, prepare } as unknown as DbClient;
  const rows = (table: string) => sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
  const snapshot = () => Object.fromEntries(['organizations', 'org_members', 'subscriptions', 'pending_orders', 'payment_events'].map((table) => [table, rows(table)]));
  return { sqlite, db, rawDb, rows, snapshot, hooks };
}

describe('PayOS activation against canonical SQLite schema', () => {
  let fixture: ReturnType<typeof sqliteFixture>;
  beforeEach(() => {
    vi.clearAllMocks();
    clearUserTierCache();
    mocks.resolveOrgId.mockResolvedValue(null);
    fixture = sqliteFixture();
    mocks.getD1.mockResolvedValue(fixture.rawDb);
  });
  afterEach(() => { clearUserTierCache(); fixture.sqlite.close(); });
  const activate = () => activatePayOsSubscription({ db: fixture.db, userId: 'buyer', tier: 'BASIC', order, paymentLinkId: 'link-1', lockCreatedAt });

  it('creates a dedicated customer organization without granting unrelated tenant access', async () => {
    const result = await activate();
    expect(result.orgId).not.toBe('unrelated');
    expect(fixture.rows('org_members')).toEqual([expect.objectContaining({ org_id: result.orgId, user_id: 'buyer', role: 'owner' })]);
    expect(fixture.rows('organizations')).toEqual([
      expect.objectContaining({ id: 'unrelated', plan: 'premium' }),
      expect.objectContaining({ id: result.orgId, plan: 'basic' }),
    ]);
    expect(fixture.rows('subscriptions')).toEqual([expect.objectContaining({ org_id: result.orgId, plan: 'basic', status: 'active' })]);
    expect(fixture.rows('pending_orders')[0]).toMatchObject({ status: 'completed', payment_id: 'payos_link-1' });
    expect(fixture.rows('payment_events')[0]).toMatchObject({ processed: 1 });
  });

  it('rejects a stale lock owner without changing any persisted state', async () => {
    fixture.sqlite.prepare('UPDATE payment_events SET created_at = ?').run('replacement-lock');
    const before = fixture.snapshot();
    await expect(activate()).rejects.toThrow('unexpected number of rows');
    expect(fixture.snapshot()).toEqual(before);
    expect(mocks.invalidateOrgIdCache).not.toHaveBeenCalled();
  });

  it('does not commit entitlement when the matching order is no longer pending', async () => {
    fixture.sqlite.exec("UPDATE pending_orders SET status = 'expired';");
    const before = fixture.snapshot();
    await expect(activate()).rejects.toThrow();
    expect(fixture.snapshot()).toEqual(before);
    expect(mocks.invalidateOrgIdCache).not.toHaveBeenCalled();
  });

  it('rolls back organization, membership, entitlement, order and lock on a statement failure', async () => {
    fixture.sqlite.exec("CREATE TRIGGER reject_subscription BEFORE INSERT ON subscriptions BEGIN SELECT RAISE(ABORT, 'forced entitlement failure'); END;");
    const before = fixture.snapshot();
    await expect(activate()).rejects.toThrow('forced entitlement failure');
    expect(fixture.snapshot()).toEqual(before);
    expect(mocks.invalidateOrgIdCache).not.toHaveBeenCalled();
  });

  it('rejects duplicate subscription rows without committing entitlement or settlement changes', async () => {
    fixture.sqlite.exec("INSERT INTO org_members(org_id,user_id,role) VALUES ('unrelated','buyer','owner'); INSERT INTO subscriptions(org_id,plan,status) VALUES ('unrelated','premium','cancelled'),('unrelated','enterprise','cancelled');");
    mocks.resolveOrgId.mockResolvedValue('unrelated');
    const before = fixture.snapshot();
    await expect(activate()).rejects.toThrow();
    expect(fixture.snapshot()).toEqual(before);
  });

  it('aligns an existing user subscription tier with the purchased plan and invalidates cached tier', async () => {
    fixture.sqlite.exec("INSERT INTO org_members(org_id,user_id,role) VALUES ('unrelated','buyer','owner'); INSERT INTO subscriptions(org_id,user_id,tier,plan,status) VALUES ('unrelated','buyer','PREMIUM','premium','active');");
    mocks.resolveOrgId.mockResolvedValue('unrelated');
    expect(await getUserTier('buyer')).toBe('PREMIUM');
    await activate();
    expect.soft(fixture.rows('subscriptions')).toEqual([expect.objectContaining({ user_id: 'buyer', plan: 'basic', tier: 'BASIC' })]);
    expect(await getUserTier('buyer')).toBe('BASIC');
  });

  it('rejects stale cached absence when the buyer already has an organization membership', async () => {
    fixture.sqlite.exec("INSERT INTO org_members(org_id,user_id,role) VALUES ('unrelated','buyer','member');");
    mocks.resolveOrgId.mockResolvedValue(null);
    const before = fixture.snapshot();
    await expect(activate()).rejects.toThrow();
    expect(fixture.snapshot()).toEqual(before);
    expect(mocks.invalidateOrgIdCache).not.toHaveBeenCalled();
  });

  it('rejects stale cached organization after membership was removed', async () => {
    fixture.sqlite.exec("INSERT INTO subscriptions(org_id,plan,status) VALUES ('unrelated','premium','active');");
    mocks.resolveOrgId.mockResolvedValue('unrelated');
    const before = fixture.snapshot();
    await expect(activate()).rejects.toThrow();
    expect(fixture.snapshot()).toEqual(before);
    expect(mocks.invalidateOrgIdCache).not.toHaveBeenCalled();
  });

  it.each(['delete', 'insert'] as const)('rejects a concurrent subscription %s before batch without settling the order', async (operation) => {
    fixture.sqlite.exec("INSERT INTO org_members(org_id,user_id,role) VALUES ('unrelated','buyer','owner');");
    if (operation === 'delete') fixture.sqlite.exec("INSERT INTO subscriptions(org_id,plan,status) VALUES ('unrelated','premium','cancelled');");
    mocks.resolveOrgId.mockResolvedValue('unrelated');
    let afterConcurrentChange: ReturnType<typeof fixture.snapshot> | undefined;
    const concurrentChange = vi.fn(() => {
      fixture.sqlite.exec(operation === 'delete'
        ? "DELETE FROM subscriptions WHERE org_id = 'unrelated';"
        : "INSERT INTO subscriptions(org_id,plan,status) VALUES ('unrelated','enterprise','cancelled');");
      afterConcurrentChange = fixture.snapshot();
    });
    fixture.hooks.beforeBatch = concurrentChange;
    await expect(activate()).rejects.toThrow();
    expect(concurrentChange).toHaveBeenCalledTimes(1);
    // Compare after the independent concurrent commit, so only activation side effects count.
    expect(fixture.snapshot()).toEqual(afterConcurrentChange);
    expect(fixture.rows('pending_orders')[0]).toMatchObject({ status: 'pending', payment_id: null });
    expect(fixture.rows('payment_events')[0]).toMatchObject({ processed: 0 });
    expect(mocks.invalidateOrgIdCache).not.toHaveBeenCalled();
  });

  it.each([false, true])('activates an existing member organization (existing subscription=%s)', async (existing) => {
    fixture.sqlite.exec("INSERT INTO org_members(org_id,user_id,role) VALUES ('unrelated','buyer','owner');");
    mocks.resolveOrgId.mockResolvedValue('unrelated');
    if (existing) fixture.sqlite.exec("INSERT INTO subscriptions(org_id,plan,status) VALUES ('unrelated','premium','cancelled');");
    const result = await activate();
    expect(result.orgId).toBe('unrelated');
    expect(fixture.rows('organizations')).toHaveLength(1);
    expect(fixture.rows('org_members')).toHaveLength(1);
    expect(fixture.rows('subscriptions')).toEqual([expect.objectContaining({ org_id: 'unrelated', plan: 'basic', status: 'active', current_period_end: result.periodEnd })]);
    expect(fixture.rows('organizations')[0]).toMatchObject({ plan: 'basic' });
    expect(fixture.rows('pending_orders')[0]).toMatchObject({ status: 'completed' });
    expect(fixture.rows('payment_events')[0]).toMatchObject({ processed: 1 });
  });
});
