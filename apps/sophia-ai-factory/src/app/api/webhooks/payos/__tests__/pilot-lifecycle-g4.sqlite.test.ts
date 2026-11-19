// @vitest-environment node
/**
 * Gate G4 — Deterministic 10-Scenario Pilot Entitlement Lifecycle Suite
 *
 * Exercises `/api/webhooks/payos` + `getUserTier` + `queryActiveCustomerSubscription`
 * against a real in-memory `node:sqlite` schema built from canonical D1 migrations
 * (including `0503_reconcile_pending_orders_provider_payment_id.sql` and `0504`)
 * using a deterministic clock (`vi.setSystemTime`).
 *
 * Scenarios verified:
 *   1. Successful valid payment -> BASIC active for exactly +14 days from activation clock.
 *   2. Invalid payment signature -> 400 fail-closed, 0 DB writes.
 *   3. Pending payment (no IPN yet) -> order stays pending, no paid subscription row.
 *   4. Failed or cancelled payment (code !== '00') -> 200 acknowledged, order/entitlement untouched.
 *   5. Repeated IPN delivery -> idempotent (`duplicate: true`), period_end NOT stacked twice.
 *   6. Concurrent duplicate IPNs -> one wins lock, second receives 409 `processing` without double grant.
 *   7. Existing active subscription:
 *      - 7a: Existing active BASIC (+10d remaining) -> extended by +14d (+24d total).
 *      - 7b: Existing active PREMIUM (+20d remaining) -> anti-downgrade preserves PREMIUM & period_end.
 *   8. Expired pilot (+14d + 1s elapsed) -> `getUserTier` & `queryActiveCustomerSubscription` enforce expiry.
 *   9. Cross-tenant attempts -> buyer B's order cannot mutate org A's subscription.
 *  10. Reconciliation failure & retry -> transient DB failure rolls back & releases lock; retry succeeds cleanly.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { payOsCanonicalize } from '@/land/payments/payos-gateway/checksum-verifier';

const CHECKSUM_KEY = 'deterministic-pilot-checksum-secret-08';

const mocks = vi.hoisted(() => ({
  d1ClientHolder: { current: null as unknown },
  rawDbHolder: { current: null as unknown },
  resolveOrgId: vi.fn(),
  invalidateOrgIdCache: vi.fn(),
  sendReceiptEmail: vi.fn().mockResolvedValue(undefined),
  recordAudit: vi.fn().mockResolvedValue(undefined),
  safelyRecordAffiliateCommission: vi.fn().mockResolvedValue(undefined),
  track: vi.fn(),
}));

vi.mock('@/land/payments/payos', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/land/payments/payos')>();
  return { ...actual, FEATURE_PAYOS: true };
});
vi.mock('@/seed/db/client', () => ({
  createServerClient: () => mocks.d1ClientHolder.current,
  getD1: async () => mocks.rawDbHolder.current,
  getD1Raw: async () => mocks.rawDbHolder.current,
  getD1Safe: async () => mocks.rawDbHolder.current,
}));
vi.mock('@/seed/auth/workspace-access', () => ({ resolveOrgId: mocks.resolveOrgId }));
vi.mock('@/seed/auth/org-resolver', () => ({ invalidateOrgIdCache: mocks.invalidateOrgIdCache }));
vi.mock('@/land/billing/email/receipt-email-sender', () => ({ sendReceiptEmail: mocks.sendReceiptEmail }));
vi.mock('@/seed/db/audit/audit-log', () => ({ recordAudit: mocks.recordAudit }));
vi.mock('@/tree/affiliates/affiliate-attribution', () => ({
  safelyRecordAffiliateCommission: mocks.safelyRecordAffiliateCommission,
}));
vi.mock('@/tree/signals/track', () => ({ track: mocks.track }));

import { clearUserTierCache, getUserTier } from '@/seed/db/get-user-tier';
import { queryActiveCustomerSubscription } from '@/land/billing/customer-subscription-query';

type SQLInputValue = string | number | bigint | Uint8Array | null;

async function signPayOsBody(payloadWithoutSig: Record<string, unknown>, secret = CHECKSUM_KEY): Promise<string> {
  const canonical = payOsCanonicalize(JSON.stringify(payloadWithoutSig));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(canonical));
  const signature = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return JSON.stringify({ ...payloadWithoutSig, signature });
}

function createSqliteHarness() {
  const sqlite = new DatabaseSync(':memory:') as DatabaseSync & { close(): void };
  // Load canonical baseline WITHOUT 0187, then apply our forward reconciliation 0503 + 0504
  // to prove the forward migration closes the live production schema drift.
  for (const mig of [
    '0001-init.sql',
    '0002-payment-events.sql',
    '0053-mcu-credits.sql',
    '0070-pending-orders.sql',
    '0072-payos-events.sql',
    '0086-subscriptions-add-user-tier.sql',
    '0087-subscriptions-drop-user-id-fk.sql',
    '0088-org-members-drop-user-id-fk.sql',
    '0188_add_amount_vnd_to_pending_orders.sql',
    '0477_payos_contract_fulfillment.sql',
    '0503_reconcile_pending_orders_provider_payment_id.sql',
    '0504_pending_orders_provider_payment_id_index.sql',
  ]) {
    sqlite.exec(readFileSync(resolve('migrations', mig), 'utf8'));
  }
  sqlite.exec('PRAGMA foreign_keys = ON;');

  const hooks: { beforeBatch?: () => Promise<void> | void; failMcu?: 'prepare' | 'bind' } = {};
  function prepare(sql: string) {
    const isMcu = sql.includes('INSERT INTO mcu_transactions');
    if (isMcu && hooks.failMcu === 'prepare') {
      hooks.failMcu = undefined;
      throw new Error('forced MCU prepare failure');
    }
    let highest = 0;
    const normalized = sql.replace(/\?(\d*)/g, (_, index: string) => {
      highest = index ? Math.max(highest, Number(index)) : highest + 1;
      return `?${index || highest}`;
    });
    let values: SQLInputValue[] = [];
    const statement = sqlite.prepare(normalized);
    const bindings = () =>
      Object.fromEntries(values.map((v, idx) => [String(idx + 1), v === undefined ? null : v]));
    return {
      bind(...args: SQLInputValue[]) {
        if (isMcu && hooks.failMcu === 'bind') {
          hooks.failMcu = undefined;
          throw new Error('forced MCU bind failure');
        }
        values = args;
        return this;
      },
      async first<T>() {
        return (statement.get(bindings()) ?? null) as T | null;
      },
      async all<T>() {
        return { results: statement.all(bindings()) as T[], success: true };
      },
      async run() {
        try {
          const info = statement.run(bindings());
          return { success: true, meta: { changes: Number(info.changes) } };
        } catch (err) {
          throw err;
        }
      },
      execute() {
        return statement.run(bindings());
      },
    };
  }

  let failNextBatch = false;
  const rawDb = {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      await hooks.beforeBatch?.();
      if (failNextBatch) {
        failNextBatch = false;
        throw new Error('D1 transient write outage');
      }
      sqlite.exec('BEGIN');
      try {
        const out = statements.map((stmt) => ({
          success: true,
          meta: { changes: Number(stmt.execute().changes) },
        }));
        sqlite.exec('COMMIT');
        return out;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
  };

  function from(table: string) {
    const filters: Array<{ col: string; val: SQLInputValue }> = [];
    let pendingAction: 'select' | 'update' | 'delete' = 'select';
    let updateCols: Record<string, SQLInputValue> = {};

    const whereSql = () =>
      filters.length ? ` WHERE ${filters.map((f, i) => `${f.col} = ?${i + 1}`).join(' AND ')}` : '';
    const whereVals = () => filters.map((f) => f.val);

    const builder = {
      select() {
        pendingAction = 'select';
        return builder;
      },
      update(vals: Record<string, SQLInputValue>) {
        pendingAction = 'update';
        updateCols = vals;
        return builder;
      },
      delete() {
        pendingAction = 'delete';
        return builder;
      },
      eq(col: string, val: SQLInputValue) {
        filters.push({ col, val });
        return builder;
      },
      async single() {
        const rows = sqlite.prepare(`SELECT * FROM ${table}${whereSql()} LIMIT 2`).all(...whereVals());
        if (rows.length === 0) return { data: null, error: { code: 'PGRST116', message: 'No rows' } };
        return { data: rows[0], error: null };
      },
      async maybeSingle() {
        const rows = sqlite.prepare(`SELECT * FROM ${table}${whereSql()} LIMIT 1`).all(...whereVals());
        return { data: rows[0] ?? null, error: null };
      },
      then(onFulfilled: (v: { data: unknown; error: null }) => unknown, onRejected?: (e: unknown) => unknown) {
        const exec = async () => {
          if (pendingAction === 'delete') {
            sqlite.prepare(`DELETE FROM ${table}${whereSql()}`).run(...whereVals());
            return { data: null, error: null };
          }
          if (pendingAction === 'update') {
            const entries = Object.entries(updateCols);
            const setClause = entries.map(([k], idx) => `${k} = ?${idx + 1}`).join(', ');
            const wClause = filters.length
              ? ` WHERE ${filters.map((f, i) => `${f.col} = ?${entries.length + i + 1}`).join(' AND ')}`
              : '';
            sqlite
              .prepare(`UPDATE ${table} SET ${setClause}${wClause}`)
              .run(...entries.map(([, v]) => v), ...whereVals());
            return { data: null, error: null };
          }
          const rows = sqlite.prepare(`SELECT * FROM ${table}${whereSql()}`).all(...whereVals());
          return { data: rows, error: null };
        };
        return exec().then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  const dbClient = {
    unwrap: () => rawDb,
    prepare,
    from,
    async execute(sql: string, params: SQLInputValue[] = []) {
      sqlite.prepare(sql).run(...params);
    },
  };

  return {
    sqlite,
    rawDb,
    dbClient,
    hooks,
    setFailNextBatch(val: boolean) {
      failNextBatch = val;
    },
    rows(table: string) {
      return sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all() as Array<Record<string, unknown>>;
    },
  };
}

function buildIpnPayload(overrides: Partial<{
  code: string;
  success: boolean;
  orderCode: number;
  amount: number;
  paymentLinkId: string;
  dataCode: string;
}> = {}) {
  return {
    code: overrides.code ?? '00',
    desc: 'success',
    success: overrides.success ?? true,
    data: {
      orderCode: overrides.orderCode ?? 880011,
      amount: overrides.amount ?? 1_990_000,
      description: 'Sophia BASIC - pilot14d',
      accountNumber: '19001122',
      reference: 'FT26319',
      transactionDateTime: '2026-11-15 10:00:00',
      currency: 'VND',
      paymentLinkId: overrides.paymentLinkId ?? 'plink_pilot_01',
      code: overrides.dataCode ?? '00',
      desc: 'Thanh cong',
    },
  };
}

describe('Gate G4 — Deterministic 10-Scenario Pilot Entitlement Lifecycle', () => {
  const BASE_ISO = '2026-11-15T00:00:00.000Z';
  const PLUS_14D_ISO = '2026-11-29T00:00:00.000Z';
  let harness: ReturnType<typeof createSqliteHarness>;
  let postWebhook: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(BASE_ISO));
    process.env.PAYOS_CHECKSUM_KEY = CHECKSUM_KEY;
    clearUserTierCache();
    vi.clearAllMocks();

    harness = createSqliteHarness();
    mocks.d1ClientHolder.current = harness.dbClient;
    mocks.rawDbHolder.current = harness.rawDb;
    mocks.resolveOrgId.mockImplementation(async (uid: string) => {
      const row = harness.sqlite
        .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
        .get(uid) as { org_id?: string } | undefined;
      return row?.org_id ?? null;
    });

    vi.resetModules();
    const routeMod = await import('@/app/api/webhooks/payos/route');
    postWebhook = routeMod.POST;
  });

  afterEach(() => {
    clearUserTierCache();
    harness.sqlite.close();
    vi.useRealTimers();
  });

  function seedPilotOrder(params: {
    orderId?: string;
    userId?: string;
    paymentLinkId?: string;
    orderCode?: number;
    amountVnd?: number;
  } = {}) {
    harness.sqlite
      .prepare(
        `INSERT INTO pending_orders
           (order_id, user_id, tier, period, payment_method, amount_usd_cents, amount_vnd, provider_payment_id, provider_order_code, status, created_at)
         VALUES (?, ?, 'BASIC', 'pilot_14d', 'payos', 7900, ?, ?, ?, 'pending', ?)`,
      )
      .run(
        params.orderId ?? 'sophia_u_pilot_1',
        params.userId ?? 'u_pilot',
        params.amountVnd ?? 1_990_000,
        params.paymentLinkId ?? 'plink_pilot_01',
        params.orderCode ?? 880011,
        BASE_ISO,
      );
  }

  async function deliver(endpoint: 'legacy' | 'canonical', payload = buildIpnPayload()) {
    const body = await signPayOsBody(payload);
    const route = endpoint === 'legacy' ? (await import('@/app/api/payos/ipn/route')).POST : postWebhook;
    return route(new NextRequest('https://sophia.agencyos.network/api/payos/ipn', { method: 'POST', body }));
  }

  function seedMember() {
    harness.sqlite.exec(`INSERT INTO organizations(id,name,slug,plan) VALUES ('buyer_org','Buyer','buyer','basic');
      INSERT INTO org_members(org_id,user_id,role) VALUES ('buyer_org','u_pilot','owner');`);
  }

  it.each(['legacy', 'canonical'] as const)('%s rejects signed identity/amount/currency mismatches before writes', async endpoint => {
    seedPilotOrder(); seedMember();
    for (const mutation of [
      { paymentLinkId: 'another-link' }, { orderCode: 880012 }, { amount: 1 },
    ]) expect((await deliver(endpoint, buildIpnPayload(mutation))).status).toBe(400);
    expect((await deliver(endpoint, buildIpnPayload({ orderCode: 880011 }))).status).toBe(200);
    expect(harness.rows('user_mcu_balance')[0].credits_remaining).toBe(500);
    const currency = buildIpnPayload(); currency.data.currency = 'USD';
    expect((await deliver(endpoint, currency)).status).toBe(400);
    harness.sqlite.exec("UPDATE pending_orders SET payment_method='nowpayments'");
    expect((await deliver(endpoint)).status).toBe(400);
    harness.sqlite.exec("UPDATE pending_orders SET payment_method='payos', provider_payment_id=NULL, provider_order_code=NULL, invoice_url='https://pay.payos.vn/web/plink_pilot_01'");
    expect((await deliver(endpoint)).status).toBe(400);
    expect(harness.rows('mcu_transactions')).toHaveLength(1);
    expect(harness.rows('pending_orders')[0].status).toBe('completed');
  });

  it.each(['legacy', 'canonical'] as const)('%s accepts only exact legacy URL with stored order code', async endpoint => {
    seedPilotOrder(); seedMember();
    harness.sqlite.exec("UPDATE pending_orders SET provider_payment_id=NULL, invoice_url='https://pay.payos.vn/web/plink_pilot_01?x=1'");
    expect((await deliver(endpoint)).status).toBe(400);
    harness.sqlite.exec("UPDATE pending_orders SET invoice_url='https://pay.payos.vn/web/plink_pilot_01'");
    expect((await deliver(endpoint)).status).toBe(200);
    expect(harness.rows('user_mcu_balance')[0].credits_remaining).toBe(500);
  });

  it.each(['legacy', 'canonical'] as const)('%s retains replacement lease and grants nothing for displaced worker', async endpoint => {
    seedPilotOrder(); seedMember();
    const table = endpoint === 'legacy' ? 'payos_events' : 'payment_events';
    harness.hooks.beforeBatch = () => {
      harness.hooks.beforeBatch = undefined;
      harness.sqlite.exec(`UPDATE ${table} SET created_at='2026-11-15T00:00:01.000Z'`);
    };
    expect((await deliver(endpoint)).status).toBe(500);
    expect(harness.rows(table)[0]).toMatchObject({ processed: 0, created_at: '2026-11-15T00:00:01.000Z' });
    expect(harness.rows('pending_orders')[0].status).toBe('pending');
    expect(harness.rows('subscriptions')).toEqual([]); expect(harness.rows('mcu_transactions')).toEqual([]);
  });

  it.each(['legacy', 'canonical'] as const)('%s cancellation failure rolls back and retries', async endpoint => {
    seedPilotOrder();
    harness.sqlite.exec("CREATE TRIGGER fail_cancel BEFORE UPDATE OF status ON pending_orders WHEN NEW.status='failed' BEGIN SELECT RAISE(ABORT,'forced cancellation outage'); END");
    const payload = buildIpnPayload({ dataCode: '01' });
    expect((await deliver(endpoint, payload)).status).toBe(500);
    expect(harness.rows('pending_orders')[0].status).toBe('pending');
    expect(harness.rows('payos_events')).toEqual([]); expect(harness.rows('payment_events')).toEqual([]);
    harness.sqlite.exec('DROP TRIGGER fail_cancel');
    expect((await deliver(endpoint, payload)).status).toBe(200);
    expect(harness.rows('pending_orders')[0].status).toBe('failed');
    expect((await deliver(endpoint, payload)).status).toBe(200);
    expect(harness.rows('mcu_transactions')).toEqual([]);
  });

  it.each(['legacy', 'canonical'] as const)('%s cancellation rejects a changed financial order snapshot', async endpoint => {
    seedPilotOrder();
    harness.hooks.beforeBatch = () => {
      harness.hooks.beforeBatch = undefined;
      harness.sqlite.exec("UPDATE pending_orders SET amount_usd_cents=8000, contract_id='replacement-contract', invoice_id='replacement-invoice'");
    };
    expect((await deliver(endpoint, buildIpnPayload({ dataCode: '01' }))).status).toBe(500);
    expect(harness.rows('pending_orders')[0].status).toBe('pending');
    expect(harness.rows('payos_events')).toEqual([]);
    expect(harness.rows('payment_events')).toEqual([]);
    expect(harness.rows('mcu_transactions')).toEqual([]);
  });

  it('reclaims a crashed legacy lease with one winner among two contenders', async () => {
    seedPilotOrder(); seedMember();
    harness.sqlite.exec("INSERT INTO payos_events(event_id,order_code,status,amount,currency,payload,processed,created_at) VALUES ('payos_880011','880011','PAID',1990000,'VND','{}',0,'2026-11-14T23:54:59.999Z')");
    const { acquireEventLock } = await import('@/app/api/payos/ipn/modules/event-locker');
    const raw = harness.rawDb as unknown as import('@cloudflare/workers-types').D1Database;
    const claims = await Promise.all([1,2].map(() => acquireEventLock(raw, 'payos_880011', 880011, true, 1990000, {})));
    expect(claims.map(r => r.status).sort()).toEqual(['already_processing','won_lock']);
    harness.sqlite.exec("UPDATE payos_events SET created_at='2026-11-14T23:54:59.999Z'");
    expect((await deliver('legacy')).status).toBe(200);
    expect(harness.rows('payos_events')[0].processed).toBe(1);
    expect(harness.rows('mcu_transactions')).toHaveLength(1);
  });

  it.each(['legacy', 'canonical'] as const)('%s first and mixed endpoint interleaving grant once', async first => {
    seedPilotOrder(); seedMember();
    const second = first === 'legacy' ? 'canonical' : 'legacy';
    harness.hooks.beforeBatch = async () => {
      harness.hooks.beforeBatch = undefined;
      expect((await deliver(second)).status).toBe(200);
    };
    expect((await deliver(first)).status).toBe(500);
    expect((await deliver(first)).status).toBe(200);
    expect((await deliver(second)).status).toBe(200);
    expect(harness.rows('mcu_transactions')).toHaveLength(1);
    expect(harness.rows('user_mcu_balance')[0].credits_remaining).toBe(500);
    expect(harness.rows('subscriptions')[0].current_period_end).toBe(PLUS_14D_ISO);
  });

  it.each(['prepare', 'bind'] as const)('fails closed on the first MCU %s failure and grants exactly once on retry', async (stage) => {
    seedPilotOrder();
    const signed = await signPayOsBody(buildIpnPayload());
    const deliver = () => postWebhook(new NextRequest('https://sophia.agencyos.network/api/webhooks/payos', { method: 'POST', body: signed }));
    harness.hooks.failMcu = stage;
    const failed = await deliver();
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: `Activation failed: forced MCU ${stage} failure` });
    for (const table of ['organizations', 'org_members', 'subscriptions', 'payment_events', 'mcu_transactions', 'user_mcu_balance']) {
      expect(harness.rows(table)).toEqual([]);
    }
    expect(harness.rows('pending_orders')[0]).toMatchObject({ status: 'pending', payment_id: null });
    expect((await deliver()).status).toBe(200);
    expect(harness.rows('subscriptions')[0]).toMatchObject({ current_period_end: PLUS_14D_ISO });
    expect(harness.rows('user_mcu_balance')[0]).toMatchObject({ credits_remaining: 500 });
    expect(harness.rows('mcu_transactions')).toHaveLength(1);
  });

  it.each(['upgrade', 'renewal'] as const)('rejects a concurrent same-row %s and recomputes entitlement on retry', async (change) => {
    harness.sqlite.exec(`
      INSERT INTO organizations(id,name,slug,plan) VALUES ('org_race','Race','race','basic');
      INSERT INTO org_members(org_id,user_id,role) VALUES ('org_race','u_pilot','owner');
      INSERT INTO subscriptions(id,org_id,user_id,tier,plan,status,current_period_start,current_period_end)
      VALUES ('sub_race','org_race','u_pilot','BASIC','basic','active','2026-11-01T00:00:00.000Z','2026-11-25T00:00:00.000Z');
    `);
    seedPilotOrder();
    const signed = await signPayOsBody(buildIpnPayload());
    const deliver = () => postWebhook(new NextRequest('https://sophia.agencyos.network/api/webhooks/payos', { method: 'POST', body: signed }));
    const snapshot = () => Object.fromEntries(['organizations', 'org_members', 'subscriptions', 'pending_orders', 'mcu_transactions', 'user_mcu_balance'].map((table) => [table, harness.rows(table)]));
    let concurrentState: ReturnType<typeof snapshot> | undefined;
    harness.hooks.beforeBatch = async () => {
      harness.hooks.beforeBatch = undefined;
      if (change === 'upgrade') {
        harness.sqlite.exec("UPDATE subscriptions SET tier = 'PREMIUM', plan = 'premium', current_period_end = '2026-12-05T00:00:00.000Z' WHERE id = 'sub_race'; UPDATE organizations SET plan = 'premium' WHERE id = 'org_race';");
      } else {
        seedPilotOrder({ orderId: 'pilot_second', paymentLinkId: 'plink_second', orderCode: 880012 });
        const second = await postWebhook(new NextRequest('https://sophia.agencyos.network/api/webhooks/payos', {
          method: 'POST', body: await signPayOsBody(buildIpnPayload({ paymentLinkId: 'plink_second', orderCode: 880012 })),
        }));
        expect(second.status).toBe(200);
      }
      concurrentState = snapshot();
    };
    const conflict = await deliver();
    expect(conflict.status).toBe(500);
    expect(await conflict.json()).toMatchObject({ error: expect.stringContaining('unexpected number of rows') });
    expect(snapshot()).toEqual(concurrentState);
    expect(harness.rows('payment_events').some((row) => row.event_id === 'payos_plink_pilot_01')).toBe(false);
    expect((await deliver()).status).toBe(200);
    expect(harness.rows('subscriptions')[0]).toMatchObject({
      tier: change === 'upgrade' ? 'PREMIUM' : 'BASIC',
      current_period_end: change === 'upgrade' ? '2026-12-05T00:00:00.000Z' : '2026-12-23T00:00:00.000Z',
    });
    expect(harness.rows('user_mcu_balance')[0]).toMatchObject({ credits_remaining: change === 'upgrade' ? 500 : 1000 });
    expect(harness.rows('mcu_transactions')).toHaveLength(change === 'upgrade' ? 1 : 2);
  });

  it('Scenario 1 & 8: Valid payment grants BASIC for exact +14d window, and expires cleanly at +14d + 1s', async () => {
    seedPilotOrder();
    const signed = await signPayOsBody(buildIpnPayload());
    const res = await postWebhook(new NextRequest('https://sophia.agencyos.network/api/webhooks/payos', { method: 'POST', body: signed }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });

    const subs = harness.rows('subscriptions');
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({
      tier: 'BASIC',
      plan: 'basic',
      status: 'active',
      current_period_start: BASE_ISO,
      current_period_end: PLUS_14D_ISO,
    });

    // Verify atomic 500 MCU grant on real SQLite partial unique index (0477)
    const mcuBal = harness.rows('user_mcu_balance');
    expect(mcuBal).toEqual([
      expect.objectContaining({
        user_id: 'u_pilot',
        credits_remaining: 500,
        credits_total_purchased: 500,
      }),
    ]);
    expect(harness.rows('mcu_transactions')).toEqual([
      expect.objectContaining({
        user_id: 'u_pilot',
        delta: 500,
        reason: 'PAYOS_SUBSCRIPTION_ACTIVATION',
        payment_reference: 'payos_order_sophia_u_pilot_1',
      }),
    ]);

    // Inside window (+13d 23h 59m 59s)
    vi.setSystemTime(new Date('2026-11-28T23:59:59.000Z'));
    const activeInfo = await queryActiveCustomerSubscription('u_pilot');
    expect(activeInfo).toMatchObject({ resolvedTier: 'BASIC', subStatus: 'active', periodEnd: PLUS_14D_ISO });

    // Scenario 8: Past 14-day window (+14d + 1s) — even before cron runs, read-path enforces expiry
    vi.setSystemTime(new Date('2026-11-29T00:00:01.000Z'));
    const expiredInfo = await queryActiveCustomerSubscription('u_pilot');
    expect(expiredInfo).toMatchObject({ resolvedTier: 'BASIC', subStatus: 'expired', periodEnd: PLUS_14D_ISO });

    // Also verify a PREMIUM subscription with past current_period_end drops back to BASIC on getUserTier
    harness.sqlite.prepare("UPDATE subscriptions SET tier = 'PREMIUM', plan = 'premium' WHERE user_id = 'u_pilot'").run();
    expect(await getUserTier('u_pilot')).toBe('BASIC');
  });

  it('Scenario 2: Invalid payment signature fails closed (400) with zero DB mutations', async () => {
    seedPilotOrder();
    const forged = await signPayOsBody(buildIpnPayload(), 'wrong-attacker-key');
    const res = await postWebhook(new NextRequest('https://sophia.agencyos.network/api/webhooks/payos', { method: 'POST', body: forged }));
    expect(res.status).toBe(400);
    expect(harness.rows('subscriptions')).toHaveLength(0);
    expect(harness.rows('payment_events')).toHaveLength(0);
    expect(harness.rows('pending_orders')[0]).toMatchObject({ status: 'pending' });
  });

  it('Scenario 3 & 4: Pending order and cancelled/non-00 IPN grant zero entitlement', async () => {
    seedPilotOrder();
    // Scenario 3: Before any IPN arrives, order is pending and no subscription exists
    expect(harness.rows('subscriptions')).toHaveLength(0);
    expect(harness.rows('pending_orders')[0]).toMatchObject({ status: 'pending' });

    // Scenario 4: Cancelled / failed payment event (data.code !== '00')
    const cancelledBody = await signPayOsBody(buildIpnPayload({ dataCode: '01', success: false }));
    const res = await postWebhook(new NextRequest('https://sophia.agencyos.network/api/webhooks/payos', { method: 'POST', body: cancelledBody }));
    expect(res.status).toBe(200);
    expect(harness.rows('subscriptions')).toHaveLength(0);
    expect(harness.rows('pending_orders')[0]).toMatchObject({ status: 'failed' });
    expect(harness.rows('payment_events')[0]).toMatchObject({ processed: 1 });
  });

  it('Scenario 5 & 6: Repeated sequential IPN and concurrent in-flight IPN never double-extend entitlement', async () => {
    seedPilotOrder();
    const signed = await signPayOsBody(buildIpnPayload());

    // Scenario 6: Simulate an in-flight concurrent lock already inserted in payment_events (processed = 0)
    harness.sqlite
      .prepare("INSERT INTO payment_events (event_id, event_type, payload, processed, created_at) VALUES ('payos_plink_pilot_01', 'payos.payment_success', '{}', 0, ?)")
      .run(BASE_ISO);

    const concurrentRes = await postWebhook(
      new NextRequest('https://sophia.agencyos.network/api/webhooks/payos', { method: 'POST', body: signed }),
    );
    expect(concurrentRes.status).toBe(409);
    expect(await concurrentRes.json()).toMatchObject({ status: 'processing' });
    expect(harness.rows('subscriptions')).toHaveLength(0);

    // Clear simulated in-flight lock and run real first delivery + repeated delivery (Scenario 5)
    harness.sqlite.exec('DELETE FROM payment_events;');
    const first = await postWebhook(new NextRequest('https://sophia.agencyos.network/api/webhooks/payos', { method: 'POST', body: signed }));
    expect(first.status).toBe(200);

    vi.setSystemTime(new Date('2026-11-16T00:00:00.000Z'));
    const duplicate = await postWebhook(new NextRequest('https://sophia.agencyos.network/api/webhooks/payos', { method: 'POST', body: signed }));
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual({ received: true, duplicate: true });

    // Period end remains strictly 2026-11-29 (not stacked to +28d) and MCU stays strictly 500
    const subs = harness.rows('subscriptions');
    expect(subs).toHaveLength(1);
    expect(subs[0]?.current_period_end).toBe(PLUS_14D_ISO);
    expect(harness.rows('user_mcu_balance')).toEqual([
      expect.objectContaining({ user_id: 'u_pilot', credits_remaining: 500 }),
    ]);
    expect(harness.rows('mcu_transactions')).toHaveLength(1);
  });

  it('Scenario 7: Existing active BASIC extends by +14d; existing active PREMIUM is protected from downgrade', async () => {
    // 7a: Existing active BASIC ending in +10 days -> extended to +24 days
    harness.sqlite.exec("INSERT INTO organizations (id, name, slug, plan) VALUES ('org_basic', 'Agency B', 'agency-b', 'basic');");
    harness.sqlite.exec("INSERT INTO org_members (org_id, user_id, role) VALUES ('org_basic', 'u_basic', 'owner');");
    harness.sqlite
      .prepare("INSERT INTO subscriptions (id, org_id, user_id, tier, plan, status, current_period_start, current_period_end) VALUES ('sub_b', 'org_basic', 'u_basic', 'BASIC', 'basic', 'active', ?, '2026-11-25T00:00:00.000Z')")
      .run(BASE_ISO);
    seedPilotOrder({ orderId: 'sophia_u_basic_1', userId: 'u_basic', paymentLinkId: 'plink_b', orderCode: 880022 });

    const resBasic = await postWebhook(
      new NextRequest('https://sophia.agencyos.network/api/webhooks/payos', {
        method: 'POST',
        body: await signPayOsBody(buildIpnPayload({ paymentLinkId: 'plink_b', orderCode: 880022 })),
      }),
    );
    expect(resBasic.status).toBe(200);
    const subBasic = harness.sqlite.prepare("SELECT tier, plan, current_period_end FROM subscriptions WHERE org_id = 'org_basic'").get() as Record<string, unknown>;
    expect(subBasic).toEqual({
      tier: 'BASIC',
      plan: 'basic',
      current_period_end: '2026-12-09T00:00:00.000Z', // 2026-11-25 + 14 days
    });

    // 7b: Existing active PREMIUM ending in +20 days -> NOT downgraded to BASIC
    harness.sqlite.exec("INSERT INTO organizations (id, name, slug, plan) VALUES ('org_prem', 'Agency P', 'agency-p', 'premium');");
    harness.sqlite.exec("INSERT INTO org_members (org_id, user_id, role) VALUES ('org_prem', 'u_prem', 'owner');");
    harness.sqlite
      .prepare("INSERT INTO subscriptions (id, org_id, user_id, tier, plan, status, current_period_start, current_period_end) VALUES ('sub_p', 'org_prem', 'u_prem', 'PREMIUM', 'premium', 'active', ?, '2026-12-05T00:00:00.000Z')")
      .run(BASE_ISO);
    seedPilotOrder({ orderId: 'sophia_u_prem_1', userId: 'u_prem', paymentLinkId: 'plink_p', orderCode: 880033 });

    const resPrem = await postWebhook(
      new NextRequest('https://sophia.agencyos.network/api/webhooks/payos', {
        method: 'POST',
        body: await signPayOsBody(buildIpnPayload({ paymentLinkId: 'plink_p', orderCode: 880033 })),
      }),
    );
    expect(resPrem.status).toBe(200);
    const subPrem = harness.sqlite.prepare("SELECT tier, plan, current_period_end FROM subscriptions WHERE org_id = 'org_prem'").get() as Record<string, unknown>;
    expect(subPrem).toEqual({
      tier: 'PREMIUM',
      plan: 'premium',
      current_period_end: '2026-12-05T00:00:00.000Z',
    });
  });

  it('Scenario 9 & 10: Cross-tenant isolation holds, and transient batch failure releases lock for clean retry', async () => {
    // Seed Tenant Victim
    harness.sqlite.exec("INSERT INTO organizations (id, name, slug, plan) VALUES ('org_victim', 'Victim Org', 'victim', 'enterprise');");
    harness.sqlite.exec("INSERT INTO org_members (org_id, user_id, role) VALUES ('org_victim', 'u_victim', 'owner');");
    harness.sqlite
      .prepare("INSERT INTO subscriptions (id, org_id, user_id, tier, plan, status, current_period_end) VALUES ('sub_v', 'org_victim', 'u_victim', 'ENTERPRISE', 'enterprise', 'active', '2026-12-31T00:00:00.000Z')")
      .run();

    // Seed Attacker Pilot Order
    seedPilotOrder({ orderId: 'sophia_u_attacker_1', userId: 'u_attacker', paymentLinkId: 'plink_atk', orderCode: 880044 });
    const signedAtk = await signPayOsBody(buildIpnPayload({ paymentLinkId: 'plink_atk', orderCode: 880044 }));

    // Scenario 10a: Force D1 batch failure on first delivery -> 500, lock released, order stays pending
    harness.setFailNextBatch(true);
    const failedAttempt = await postWebhook(
      new NextRequest('https://sophia.agencyos.network/api/webhooks/payos', { method: 'POST', body: signedAtk }),
    );
    expect(failedAttempt.status).toBe(500);
    expect(harness.rows('payment_events')).toHaveLength(0); // lock released!
    expect(harness.rows('pending_orders')[0]).toMatchObject({ status: 'pending' });

    // Scenario 10b & 9: Retry succeeds cleanly in attacker's isolated org, leaving org_victim untouched
    const retryAttempt = await postWebhook(
      new NextRequest('https://sophia.agencyos.network/api/webhooks/payos', { method: 'POST', body: signedAtk }),
    );
    expect(retryAttempt.status).toBe(200);

    const victimSub = harness.sqlite.prepare("SELECT tier, plan, current_period_end FROM subscriptions WHERE org_id = 'org_victim'").get();
    expect(victimSub).toEqual({
      tier: 'ENTERPRISE',
      plan: 'enterprise',
      current_period_end: '2026-12-31T00:00:00.000Z',
    });

    const attackerMember = harness.sqlite.prepare("SELECT org_id FROM org_members WHERE user_id = 'u_attacker'").get() as { org_id: string };
    expect(attackerMember.org_id).not.toBe('org_victim');
  });
});
