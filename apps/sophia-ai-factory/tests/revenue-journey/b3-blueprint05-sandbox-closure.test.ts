import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  B3_NOWPAYMENTS_SECRET,
  B3_ORIGIN,
  B3_PAYOS_SECRET,
  bindD1Globals,
  buildJsonRequest,
  createB3SqliteFixture,
  createFaultInjectingBinding,
  dispatchRoute,
  installZeroNetworkTripwire,
  seedPendingOrder,
  seedSyntheticTenant,
  signNowPaymentsIpn,
  signPayOsPayload,
  simulateWorkerRestart,
  type B3SqliteFixture,
} from './b3-revenue-harness';
import { NextRequest } from 'next/server';
import { getUserTier } from '@/seed/db/get-user-tier';
import { runD1LockReaper } from '@/forest/inngest/functions/d1-lock-reaper';
import { upsertUserTier } from '@/tree/handover/handover-account-setup';
import { rollbackTier } from '@/land/refunds/processor/eligibility-checker';

let fixture: B3SqliteFixture;
let tripwire: ReturnType<typeof installZeroNetworkTripwire>;
let nowpaymentsRoute: typeof import('@/app/api/webhooks/nowpayments/route');
let payosRoute: typeof import('@/app/api/webhooks/payos/route');
let checkoutStatusRoute: typeof import('@/app/api/checkout/status/route');

const envKeys = [
  'FEATURE_PAYOS',
  'PAYOS_CHECKSUM_KEY',
  'NOWPAYMENTS_IPN_SECRET',
  'NOWPAYMENTS_API_KEY',
  'RESEND_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'INNGEST_EVENT_KEY',
] as const;
const savedEnv = new Map<string, string | undefined>();

function postNowPayments(payload: Record<string, unknown>, sigOverride?: string | null) {
  const rawBody = JSON.stringify(payload);
  const headers: Record<string, string> = {};
  if (sigOverride === undefined) {
    headers['x-nowpayments-sig'] = signNowPaymentsIpn(payload);
  } else if (sigOverride !== null) {
    headers['x-nowpayments-sig'] = sigOverride;
  }
  return dispatchRoute(
    buildJsonRequest('/api/webhooks/nowpayments', rawBody, headers),
    nowpaymentsRoute.POST,
  );
}

function makePayOsData(overrides: Record<string, unknown> = {}) {
  return {
    orderCode: 880501,
    amount: 4_975_000,
    description: 'Sophia BASIC monthly',
    accountNumber: 'synthetic-acct',
    reference: 'synthetic-ref',
    transactionDateTime: '2026-11-25 12:00:00',
    currency: 'VND',
    paymentLinkId: 'bp05-payos-link-880501',
    code: '00',
    desc: 'success',
    ...overrides,
  };
}

function postPayOs(dataOverrides: Record<string, unknown> = {}, sigOverride?: string | null) {
  const envelope = {
    code: '00',
    desc: 'success',
    success: true,
    data: makePayOsData(dataOverrides),
  };
  const bodyObj =
    sigOverride === null
      ? envelope
      : { ...envelope, signature: sigOverride ?? signPayOsPayload(envelope) };
  return dispatchRoute(
    buildJsonRequest('/api/webhooks/payos', JSON.stringify(bodyObj)),
    payosRoute.POST,
  );
}

beforeAll(async () => {
  for (const key of envKeys) savedEnv.set(key, process.env[key]);
  process.env.FEATURE_PAYOS = 'true';
  process.env.PAYOS_CHECKSUM_KEY = B3_PAYOS_SECRET;
  process.env.NOWPAYMENTS_IPN_SECRET = B3_NOWPAYMENTS_SECRET;
  process.env.NOWPAYMENTS_API_KEY = 'bp05-synthetic-nowpayments-api-key';
  delete process.env.RESEND_API_KEY;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.INNGEST_EVENT_KEY;
  tripwire = installZeroNetworkTripwire();
  nowpaymentsRoute = await import('@/app/api/webhooks/nowpayments/route');
  payosRoute = await import('@/app/api/webhooks/payos/route');
  checkoutStatusRoute = await import('@/app/api/checkout/status/route');
});

beforeEach(() => {
  fixture?.sqlite.close();
  fixture = createB3SqliteFixture();
  bindD1Globals(fixture.binding);
  seedSyntheticTenant(fixture, {
    userId: 'usr-tenant-a',
    orgId: 'org-tenant-a',
    email: 'tenanta@example.invalid',
  });
  seedSyntheticTenant(fixture, {
    userId: 'usr-tenant-b',
    orgId: 'org-tenant-b',
    email: 'tenantb@example.invalid',
  });
  simulateWorkerRestart(['usr-tenant-a', 'usr-tenant-b']);
  process.env.FEATURE_PAYOS = 'true';
  process.env.PAYOS_CHECKSUM_KEY = B3_PAYOS_SECRET;
  process.env.NOWPAYMENTS_IPN_SECRET = B3_NOWPAYMENTS_SECRET;
});

afterEach(() => {
  expect(tripwire.blockedFetches).toEqual([]);
});

afterAll(() => {
  fixture?.sqlite.close();
  tripwire?.restore();
  for (const [key, val] of savedEnv) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
});

describe.sequential('Blueprint 05 Payment Trust — 12 Sandbox Invariants & Fault-Injection Matrix', () => {
  it('handles >=25 concurrent duplicate webhook deliveries on PayOS and NOWPayments with single activation and zero double-credit', async () => {
    seedPendingOrder(fixture, {
      orderId: 'sophia_usr-tenant-a_5001',
      userId: 'usr-tenant-a',
      tier: 'PREMIUM',
      period: 'monthly',
      paymentMethod: 'nowpayments',
      amountUsdCents: 39_900,
    });
    seedPendingOrder(fixture, {
      orderId: 'sophia_usr-tenant-b_5002',
      userId: 'usr-tenant-b',
      tier: 'PREMIUM',
      period: 'monthly',
      paymentMethod: 'payos',
      amountUsdCents: 39_900,
      amountVnd: 9_975_000,
      providerPaymentId: 'bp05-payos-concurrent-5002',
      providerOrderCode: 880502,
    });

    const npPayload = {
      payment_id: 'np-concurrent-5001',
      payment_status: 'finished',
      order_id: 'sophia_usr-tenant-a_5001',
      price_amount: 399,
      price_currency: 'usd',
      pay_amount: 399,
      actually_paid: 399,
      pay_currency: 'usdttrc20',
    };

    const [npResults, payosResults] = await Promise.all([
      Promise.all(Array.from({ length: 25 }, () => postNowPayments(npPayload))),
      Promise.all(
        Array.from({ length: 25 }, () =>
          postPayOs({
            orderCode: 880502,
            paymentLinkId: 'bp05-payos-concurrent-5002',
            amount: 9_975_000,
          }),
        ),
      ),
    ]);

    expect(npResults).toHaveLength(25);
    expect(payosResults).toHaveLength(25);
    expect(npResults.some((r) => r.status === 200)).toBe(true);
    expect(payosResults.some((r) => r.status === 200)).toBe(true);

    expect(
      fixture.sqlite
        .prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE org_id = ?')
        .get('org-tenant-a'),
    ).toEqual({ n: 1 });
    expect(
      fixture.sqlite
        .prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE org_id = ?')
        .get('org-tenant-b'),
    ).toEqual({ n: 1 });

    // PayOS PREMIUM monthly grants 5000 MCU once onto initial 50 MCU = 5050 (never 10050+)
    const tenantBMcu = fixture.sqlite
      .prepare('SELECT credits_remaining, credits_total_purchased FROM user_mcu_balance WHERE user_id = ?')
      .get('usr-tenant-b') as { credits_remaining: number; credits_total_purchased: number };
    expect(tenantBMcu.credits_total_purchased).toBe(5000);
    expect(tenantBMcu.credits_remaining).toBe(5050);

    simulateWorkerRestart(['usr-tenant-a', 'usr-tenant-b']);
    expect(await getUserTier('usr-tenant-a')).toBe('PREMIUM');
    expect(await getUserTier('usr-tenant-b')).toBe('PREMIUM');
  });

  it('rejects >=60 mixed malformed, forged-signature, merchant-test, wrong-amount/currency, and replay fault-injection cases with zero unauthorized activations', async () => {
    seedPendingOrder(fixture, {
      orderId: 'sophia_usr-tenant-a_6001',
      userId: 'usr-tenant-a',
      tier: 'ENTERPRISE',
      period: 'monthly',
      paymentMethod: 'nowpayments',
      amountUsdCents: 79_900,
    });
    seedPendingOrder(fixture, {
      orderId: 'sophia_usr-tenant-b_6002',
      userId: 'usr-tenant-b',
      tier: 'PREMIUM',
      period: 'monthly',
      paymentMethod: 'payos',
      amountUsdCents: 39_900,
      amountVnd: 9_975_000,
      providerPaymentId: 'bp05-payos-fault-6002',
      providerOrderCode: 880602,
    });

    let totalFaultCases = 0;

    // 15 Forged NOWPayments signatures
    for (let i = 0; i < 15; i++) {
      totalFaultCases++;
      const res = await postNowPayments(
        {
          payment_id: `np-forged-${i}`,
          payment_status: 'finished',
          order_id: 'sophia_usr-tenant-a_6001',
          price_amount: 799,
          price_currency: 'usd',
          pay_amount: 799,
          actually_paid: 799,
          pay_currency: 'usdttrc20',
        },
        i === 0 ? null : `${i.toString(16)}`.padStart(128, 'a'),
      );
      expect(res.status).toBe(400);
    }

    // 15 Forged PayOS signatures
    for (let i = 0; i < 15; i++) {
      totalFaultCases++;
      const res = await postPayOs(
        {
          orderCode: 880602,
          paymentLinkId: 'bp05-payos-fault-6002',
          amount: 9_975_000,
        },
        i === 0 ? null : `${i.toString(16)}`.padStart(64, 'b'),
      );
      expect(res.status).toBe(400);
    }

    // 10 Malformed JSON / invalid schema bodies across both webhooks
    const malformedBodies = [
      '',
      '{bad-json',
      '[]',
      'null',
      '{"payment_id":"","payment_status":"finished"}',
      '{"payment_id":"x","payment_status":"unknown_status","price_amount":10,"price_currency":"usd"}',
      '{"payment_id":"x","payment_status":"finished","price_amount":-5,"price_currency":"usd"}',
      '{"code":"00","desc":"ok","success":true}',
      '{"code":"00","desc":"ok","success":true,"data":{},"signature":"deadbeef"}',
      JSON.stringify({ pad: 'z'.repeat(68_000) }),
    ];
    for (const raw of malformedBodies) {
      totalFaultCases++;
      const isPayOsSample = raw.includes('"code"');
      const res = await dispatchRoute(
        buildJsonRequest(
          isPayOsSample ? '/api/webhooks/payos' : '/api/webhooks/nowpayments',
          raw,
          isPayOsSample ? {} : { 'x-nowpayments-sig': 'deadbeef' },
        ),
        isPayOsSample ? payosRoute.POST : nowpaymentsRoute.POST,
      );
      expect([400, 413]).toContain(res.status);
    }

    // 10 Merchant test / ping deliveries (PayOS VQRIO123 + NOWPayments non-settlement statuses)
    for (let i = 0; i < 5; i++) {
      totalFaultCases++;
      const pingRes = await postPayOs({
        orderCode: 123,
        description: 'VQRIO123',
        paymentLinkId: `test-ping-${i}`,
        amount: 1000,
      });
      expect(pingRes.status).toBe(200);
      expect(await pingRes.json()).toMatchObject({ ignored: 'test_ping' });
    }
    const nonTerminalStatuses = ['waiting', 'confirming', 'confirmed', 'sending', 'partially_paid'] as const;
    for (const st of nonTerminalStatuses) {
      totalFaultCases++;
      const stRes = await postNowPayments({
        payment_id: `np-ping-${st}`,
        payment_status: st,
        order_id: 'sophia_usr-tenant-a_6001',
        price_amount: 799,
        price_currency: 'usd',
        pay_amount: 799,
        actually_paid: st === 'partially_paid' ? 100 : 799,
        pay_currency: 'usdttrc20',
      });
      expect(stRes.status).toBe(200);
    }

    // 10 Wrong amount / wrong currency / underpayment signed attempts
    const mismatchNowPayments = [
      { price_amount: 199, price_currency: 'usd', pay_amount: 199, actually_paid: 199 }, // wrong USD price for ENTERPRISE ($799)
      { price_amount: 799, price_currency: 'eur', pay_amount: 799, actually_paid: 799 }, // wrong fiat currency
      { price_amount: 799, price_currency: 'vnd', pay_amount: 799, actually_paid: 799 }, // VND instead of USD
      { price_amount: 799, price_currency: 'usd', pay_amount: 799, actually_paid: 700 }, // crypto underpayment (<99%)
      { price_amount: 799, price_currency: 'usd', pay_amount: 0, actually_paid: 0 }, // non-positive pay_amount -> schema 400
    ];
    for (let i = 0; i < mismatchNowPayments.length; i++) {
      totalFaultCases++;
      const res = await postNowPayments({
        payment_id: `np-mismatch-${i}`,
        payment_status: 'finished',
        order_id: 'sophia_usr-tenant-a_6001',
        pay_currency: 'usdttrc20',
        ...mismatchNowPayments[i],
      });
      expect([200, 400]).toContain(res.status);
    }

    const mismatchPayOs = [
      { amount: 4_975_000, currency: 'VND' }, // BASIC price instead of PREMIUM 9,975,000
      { amount: 9_974_999, currency: 'VND' }, // 1 VND short
      { amount: 9_975_000, currency: 'USD' }, // wrong currency
      { amount: 0, currency: 'VND' }, // zero amount
      { amount: 9_975_000, currency: 'VND', paymentLinkId: 'wrong-link-id' }, // wrong paymentLinkId
    ];
    for (const m of mismatchPayOs) {
      totalFaultCases++;
      const res = await postPayOs({
        orderCode: 880602,
        paymentLinkId: 'bp05-payos-fault-6002',
        ...m,
      });
      expect(res.status).toBe(400);
    }

    expect(totalFaultCases).toBeGreaterThanOrEqual(60);
    simulateWorkerRestart(['usr-tenant-a', 'usr-tenant-b']);
    expect(await getUserTier('usr-tenant-a')).toBe('BASIC');
    expect(await getUserTier('usr-tenant-b')).toBe('BASIC');
    expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM subscriptions').get()).toEqual({ n: 0 });
  });

  it('enforces cross-tenant organization binding and blocks order_id/static-invoice spoofing across organizations', async () => {
    // Seed order owned by Tenant A for BASIC ($199)
    seedPendingOrder(fixture, {
      orderId: 'sophia_usr-tenant-a_7001',
      userId: 'usr-tenant-a',
      tier: 'BASIC',
      period: 'monthly',
      paymentMethod: 'nowpayments',
      amountUsdCents: 19_900,
    });
    // Seed order where order_id string looks like Tenant B, but authoritative DB owner is Tenant A
    seedPendingOrder(fixture, {
      orderId: 'sophia_usr-tenant-b_7002',
      userId: 'usr-tenant-a',
      tier: 'PREMIUM',
      period: 'monthly',
      paymentMethod: 'nowpayments',
      amountUsdCents: 39_900,
    });

    // 1. Static PREMIUM invoice ('4559269964') paired with Tenant A's BASIC pending_order is rejected (tier + amount mismatch)
    const tierSpoofRes = await postNowPayments({
      payment_id: 'np-spoof-tier-7001',
      payment_status: 'finished',
      invoice_id: '4559269964', // PREMIUM static invoice
      order_id: 'sophia_usr-tenant-a_7001', // BASIC order
      price_amount: 399,
      price_currency: 'usd',
      pay_amount: 399,
      actually_paid: 399,
      pay_currency: 'usdttrc20',
    });
    expect(tierSpoofRes.status).toBe(200);
    expect(await getUserTier('usr-tenant-a')).toBe('BASIC');

    // 2. Order with mismatched parsed userId ('usr-tenant-b') vs pending_orders.user_id ('usr-tenant-a') fails closed
    const ownerMismatchRes = await postNowPayments({
      payment_id: 'np-spoof-owner-7002',
      payment_status: 'finished',
      order_id: 'sophia_usr-tenant-b_7002',
      price_amount: 399,
      price_currency: 'usd',
      pay_amount: 399,
      actually_paid: 399,
      pay_currency: 'usdttrc20',
    });
    expect(ownerMismatchRes.status).toBe(200);
    simulateWorkerRestart(['usr-tenant-a', 'usr-tenant-b']);
    expect(await getUserTier('usr-tenant-a')).toBe('BASIC');
    expect(await getUserTier('usr-tenant-b')).toBe('BASIC');
  });

  it('prevents out-of-order lower-tier webhook from truncating MASTER/yearly current_period_end and reconciles refunds + admin rollbackTier accurately', async () => {
    // Seed Tenant A with active MASTER lifetime subscription (2099-12-31)
    fixture.sqlite
      .prepare(
        `INSERT INTO subscriptions (id, org_id, plan, tier, status, current_period_start, current_period_end)
         VALUES ('sub-master-a', 'org-tenant-a', 'master', 'MASTER', 'active', '2026-11-25T00:00:00.000Z', '2099-12-31T23:59:59.000Z')`,
      )
      .run();
    seedPendingOrder(fixture, {
      orderId: 'sophia_usr-tenant-a_8001',
      userId: 'usr-tenant-a',
      tier: 'BASIC',
      period: 'monthly',
      paymentMethod: 'nowpayments',
      amountUsdCents: 19_900,
    });

    // Out-of-order BASIC monthly finished IPN arrives for Org A
    const downgradeRes = await postNowPayments({
      payment_id: 'np-ooo-basic-8001',
      payment_status: 'finished',
      order_id: 'sophia_usr-tenant-a_8001',
      price_amount: 199,
      price_currency: 'usd',
      pay_amount: 199,
      actually_paid: 199,
      pay_currency: 'usdttrc20',
    });
    expect(downgradeRes.status).toBe(200);

    // Org A must retain MASTER plan AND 2099-12-31 current_period_end (not truncated to 30 days)
    const subRow = fixture.sqlite
      .prepare('SELECT plan, status, current_period_end FROM subscriptions WHERE org_id = ?')
      .get('org-tenant-a') as { plan: string; status: string; current_period_end: string };
    expect(subRow.plan).toBe('master');
    expect(subRow.status).toBe('active');
    expect(subRow.current_period_end).toBe('2099-12-31T23:59:59.000Z');
    simulateWorkerRestart(['usr-tenant-a']);
    expect(await getUserTier('usr-tenant-a')).toBe('MASTER');

    // Admin rollbackTier must also roll back org-scoped subscriptions where subscriptions.user_id IS NULL
    await rollbackTier(
      'usr-tenant-a',
      'BASIC',
      fixture.binding as unknown as Parameters<typeof rollbackTier>[2],
    );
    simulateWorkerRestart(['usr-tenant-a']);
    expect(await getUserTier('usr-tenant-a')).toBe('BASIC');

    // Also verify upsertUserTier updates existing org subscription in-place without creating duplicate org/subscription rows
    await upsertUserTier(
      fixture.binding as unknown as D1Database,
      'usr-tenant-a',
      'PREMIUM',
      'tenanta@example.invalid',
    );
    expect(
      fixture.sqlite
        .prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE org_id = ?')
        .get('org-tenant-a'),
    ).toEqual({ n: 1 });
    simulateWorkerRestart(['usr-tenant-a']);
    expect(await getUserTier('usr-tenant-a')).toBe('PREMIUM');
  });

  it('converges ledger and entitlement state after crash-after-ledger-write (stale lock reaper) and crash-before-entitlement-update without double-stacking', async () => {
    // Case A: Crash after INSERT INTO payment_events (processed = 0) and BEFORE entitlement write,
    // followed by runD1LockReaper() after >5 minutes, then provider webhook retry.
    seedPendingOrder(fixture, {
      orderId: 'sophia_usr-tenant-b_9001',
      userId: 'usr-tenant-b',
      tier: 'PREMIUM',
      period: 'monthly',
      paymentMethod: 'payos',
      amountUsdCents: 39_900,
      amountVnd: 9_975_000,
      providerPaymentId: 'bp05-crash-ledger-9001',
      providerOrderCode: 880901,
    });

    // Simulate crashed handler leaving stale unprocessed lock (10 minutes old)
    const tenMinAgoSql = "datetime('now', '-10 minutes')";
    fixture.sqlite
      .prepare(
        `INSERT INTO payment_events (event_id, event_type, payload, processed, created_at)
         VALUES ('payos_bp05-crash-ledger-9001', 'payos.payment_success', '{}', 0, ${tenMinAgoSql})`,
      )
      .run();

    // Run D1 lock reaper — must release unprocessed stale lock (NOT mark processed=1!)
    const reaperSummary = await runD1LockReaper();
    expect(reaperSummary.recovered).toBe(1);
    expect(
      fixture.sqlite
        .prepare('SELECT * FROM payment_events WHERE event_id = ?')
        .get('payos_bp05-crash-ledger-9001'),
    ).toBeUndefined();

    // Subsequent PayOS retry converges cleanly: activates PREMIUM once and marks processed=1
    const retryPayOsRes = await postPayOs({
      orderCode: 880901,
      paymentLinkId: 'bp05-crash-ledger-9001',
      amount: 9_975_000,
    });
    expect(retryPayOsRes.status).toBe(200);
    simulateWorkerRestart(['usr-tenant-b']);
    expect(await getUserTier('usr-tenant-b')).toBe('PREMIUM');
    expect(
      fixture.sqlite
        .prepare('SELECT processed FROM payment_events WHERE event_id = ?')
        .get('payos_bp05-crash-ledger-9001'),
    ).toEqual({ processed: 1 });

    // Case B: Crash BEFORE entitlement update (injected D1 batch failure on subscriptions) -> releases lock -> retry converges once
    seedPendingOrder(fixture, {
      orderId: 'sophia_usr-tenant-a_9002',
      userId: 'usr-tenant-a',
      tier: 'PREMIUM',
      period: 'monthly',
      paymentMethod: 'nowpayments',
      amountUsdCents: 39_900,
    });
    const npCrashPayload = {
      payment_id: 'np-crash-9002',
      payment_status: 'finished',
      order_id: 'sophia_usr-tenant-a_9002',
      price_amount: 399,
      price_currency: 'usd',
      pay_amount: 399,
      actually_paid: 399,
      pay_currency: 'usdttrc20',
    };

    const crashBeforeSub = createFaultInjectingBinding(fixture.binding, (sql) =>
      sql.includes('INSERT INTO subscriptions'),
    );
    bindD1Globals(crashBeforeSub);
    const crashedRes = await postNowPayments(npCrashPayload);
    expect(crashedRes.status).toBe(500);
    bindD1Globals(fixture.binding);
    expect(await getUserTier('usr-tenant-a')).toBe('BASIC');

    // Recovery retry succeeds and activates PREMIUM
    const recoveredRes = await postNowPayments(npCrashPayload);
    expect(recoveredRes.status).toBe(200);
    simulateWorkerRestart(['usr-tenant-a']);
    expect(await getUserTier('usr-tenant-a')).toBe('PREMIUM');

    const periodEndFirst = (
      fixture.sqlite
        .prepare('SELECT current_period_end FROM subscriptions WHERE org_id = ?')
        .get('org-tenant-a') as { current_period_end: string }
    ).current_period_end;

    // Even if payment_events lock were lost/reclaimed after subscription batch committed,
    // completed pending_orders(order_id, payment_id) guard prevents double-stacking +30d!
    fixture.sqlite
      .prepare('DELETE FROM payment_events WHERE event_id LIKE ?')
      .run('%np-crash-9002%');
    const postCrashDuplicate = await postNowPayments(npCrashPayload);
    expect(postCrashDuplicate.status).toBe(200);
    const periodEndAfter = (
      fixture.sqlite
        .prepare('SELECT current_period_end FROM subscriptions WHERE org_id = ?')
        .get('org-tenant-a') as { current_period_end: string }
    ).current_period_end;
    expect(periodEndAfter).toBe(periodEndFirst);
  });

  it('verifies checkout success redirect polling (/api/checkout/status) is strictly read-only and never grants entitlement without settled webhook', async () => {
    const orderId = 'sophia_usr-tenant-a_9900';
    seedPendingOrder(fixture, {
      orderId,
      userId: 'usr-tenant-a',
      tier: 'ENTERPRISE',
      period: 'monthly',
      paymentMethod: 'nowpayments',
      amountUsdCents: 79_900,
    });

    // Simulate customer hitting /vi/payment-success?tier=ENTERPRISE&order_id=... which polls GET /api/checkout/status
    for (let poll = 0; poll < 5; poll++) {
      const req = new NextRequest(
        `${B3_ORIGIN}/api/checkout/status?orderId=${encodeURIComponent(orderId)}`,
        { method: 'GET' },
      );
      const res = await dispatchRoute(req, checkoutStatusRoute.GET);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        status: 'pending',
        tier: 'ENTERPRISE',
        paymentId: null,
      });
    }

    simulateWorkerRestart(['usr-tenant-a']);
    expect(await getUserTier('usr-tenant-a')).toBe('BASIC');
    expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM subscriptions').get()).toEqual({ n: 0 });
  });
});
