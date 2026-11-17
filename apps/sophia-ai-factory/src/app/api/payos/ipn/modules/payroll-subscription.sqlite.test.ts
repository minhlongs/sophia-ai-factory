// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import type { D1Client } from '@/seed/db/client';
import { commitPayOsSubscriptionBatch } from './payroll-subscription';

vi.mock('@/seed/db/get-user-tier', async (original) => ({
  ...await original<typeof import('@/seed/db/get-user-tier')>(), invalidateUserTierCache: vi.fn(),
}));
type Value = string | number | null;
function fixture() {
  const sqlite = new DatabaseSync(':memory:') as DatabaseSync & { close(): void };
  sqlite.exec(`CREATE TABLE organizations(id TEXT PRIMARY KEY, plan TEXT, updated_at TEXT);
    CREATE TABLE org_members(org_id TEXT, user_id TEXT);
    CREATE TABLE subscriptions(id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), org_id TEXT, user_id TEXT, tier TEXT, plan TEXT, status TEXT, current_period_start TEXT, current_period_end TEXT, updated_at TEXT);
    CREATE TABLE pending_orders(order_id TEXT PRIMARY KEY, user_id TEXT, tier TEXT, period TEXT, payment_method TEXT, amount_vnd INTEGER, status TEXT, payment_id TEXT, completed_at TEXT);
    CREATE TABLE mcu_transactions(user_id TEXT, delta INTEGER, reason TEXT, metadata TEXT, payment_reference TEXT);
    CREATE UNIQUE INDEX payment_ref ON mcu_transactions(payment_reference) WHERE payment_reference IS NOT NULL;
    CREATE TABLE user_mcu_balance(user_id TEXT PRIMARY KEY, credits_remaining INTEGER, credits_total_purchased INTEGER, updated_at INTEGER);
    INSERT INTO organizations VALUES ('org','free',NULL);
    INSERT INTO org_members VALUES ('org','buyer');
    INSERT INTO pending_orders VALUES ('order','buyer','BASIC','pilot_14d','payos',1990000,'pending',NULL,NULL);`);
  const hooks: { beforeBatch?: () => void; failPrepare?: string } = {};
  const prepare = (sql: string) => {
    if (hooks.failPrepare && sql.includes(hooks.failPrepare)) throw new Error('prepare failure');
    let highest = 0;
    const normalized = sql.replace(/\?(\d*)/g, (_, index: string) => {
      highest = index ? Math.max(highest, Number(index)) : highest + 1;
      return `?${index || highest}`;
    });
    const statement = sqlite.prepare(normalized);
    let values: Value[] = [];
    const bindings = () => Object.fromEntries(values.map((value, index) => [String(index + 1), value]));
    return {
      bind(...args: Value[]) { values = args; return this; },
      async first<T>() { return (statement.get(bindings()) ?? null) as T | null; },
      execute() { return statement.run(bindings()); },
    };
  };
  const raw = {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      hooks.beforeBatch?.();
      sqlite.exec('BEGIN');
      try {
        const results = statements.map(s => ({ success: true, meta: { changes: Number(s.execute().changes) } }));
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const db = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: sqlite.prepare('SELECT * FROM subscriptions').get() ?? null }) }) }) }) } as unknown as D1Client;
  const rows = (table: string) => sqlite.prepare(`SELECT * FROM ${table}`).all();
  const snapshot = () => Object.fromEntries(['organizations','org_members','subscriptions','pending_orders','mcu_transactions','user_mcu_balance'].map(t => [t, rows(t)]));
  const activate = () => commitPayOsSubscriptionBatch({ db, d1: raw as unknown as D1Database, userId: 'buyer', orgId: 'org', tier: 'BASIC', billingPeriod: 'pilot_14d', now: '2026-11-17T00:00:00.000Z', periodEnd: '2026-12-01T00:00:00.000Z', orderCode: 123, orderId: 'order', amount: 1990000 });
  return { sqlite, hooks, raw, rows, snapshot, activate };
}
describe('legacy PayOS order claim and entitlement invariants', () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(() => { f = fixture(); });
  afterEach(() => f.sqlite.close());
  it('grants exactly 500 MCU once across simultaneous deliveries', async () => {
    const results = await Promise.allSettled([f.activate(), f.activate()]);
    expect(results.map(result => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(f.rows('subscriptions')).toHaveLength(1);
    expect(f.rows('mcu_transactions')).toEqual([expect.objectContaining({ delta: 500, payment_reference: 'payos_order_order' })]);
    expect(f.rows('user_mcu_balance')).toEqual([expect.objectContaining({ credits_remaining: 500 })]);
  });
  it('does not write entitlement after another endpoint has completed the order', async () => {
    f.sqlite.exec("UPDATE pending_orders SET status='completed', payment_id='canonical';");
    const before = f.snapshot();
    await expect(f.activate()).rejects.toThrow();
    expect(f.snapshot()).toEqual(before);
  });
  it('does not write after another endpoint wins immediately before batch', async () => {
    let before: unknown;
    f.hooks.beforeBatch = () => { f.sqlite.exec("UPDATE pending_orders SET status='completed', payment_id='canonical';"); before = f.snapshot(); };
    await expect(f.activate()).rejects.toThrow();
    expect(f.snapshot()).toEqual(before);
  });
  it.each(['DELETE FROM org_members', "UPDATE pending_orders SET amount_vnd=1"])('fails closed after concurrent ownership or amount change: %s', async sql => {
    let before: unknown;
    f.hooks.beforeBatch = () => { f.sqlite.exec(sql); before = f.snapshot(); };
    await expect(f.activate()).rejects.toThrow();
    expect(f.snapshot()).toEqual(before);
  });
  it.each(['mcu_transactions', 'user_mcu_balance'])('fails closed if preparing %s fails', async table => {
    f.hooks.failPrepare = table;
    const before = f.snapshot();
    await expect(f.activate()).rejects.toThrow('prepare failure');
    expect(f.snapshot()).toEqual(before);
  });
  it('preserves an active higher tier and its end date', async () => {
    f.sqlite.exec("INSERT INTO subscriptions(org_id,user_id,tier,plan,status,current_period_start,current_period_end) VALUES ('org','buyer','PREMIUM','premium','active','2026-11-01','2027-01-01');");
    await f.activate();
    expect(f.rows('subscriptions')).toEqual([expect.objectContaining({ tier: 'PREMIUM', current_period_end: '2027-01-01' })]);
  });
  it('rolls back the order claim and entitlement if the MCU balance write fails', async () => {
    f.sqlite.exec("CREATE TRIGGER reject_balance BEFORE INSERT ON user_mcu_balance BEGIN SELECT RAISE(ABORT, 'balance failure'); END;");
    const before = f.snapshot();
    await expect(f.activate()).rejects.toThrow('balance failure');
    expect(f.snapshot()).toEqual(before);
  });
  it('extends an active BASIC renewal by fourteen days', async () => {
    f.sqlite.exec("INSERT INTO subscriptions(org_id,user_id,tier,plan,status,current_period_start,current_period_end) VALUES ('org','buyer','BASIC','basic','active','2026-11-01','2027-01-01');");
    await f.activate();
    expect(f.rows('subscriptions')).toEqual([expect.objectContaining({ tier: 'BASIC', current_period_end: '2027-01-15T00:00:00.000Z' })]);
  });
  it('rejects a concurrent same-row upgrade rather than overwriting it', async () => {
    f.sqlite.exec("INSERT INTO subscriptions(org_id,user_id,tier,plan,status,current_period_start,current_period_end) VALUES ('org','buyer','BASIC','basic','active','2026-11-01','2027-01-01');");
    let before: unknown;
    f.hooks.beforeBatch = () => { f.sqlite.exec("UPDATE subscriptions SET tier='PREMIUM', plan='premium';"); before = f.snapshot(); };
    await expect(f.activate()).rejects.toThrow();
    expect(f.snapshot()).toEqual(before);
  });
});
