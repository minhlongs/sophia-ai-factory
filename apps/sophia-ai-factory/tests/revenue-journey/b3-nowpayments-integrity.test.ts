import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  B3_NOWPAYMENTS_SECRET,
  bindD1Globals,
  buildJsonRequest,
  createB3SqliteFixture,
  createFaultInjectingBinding,
  dispatchRoute,
  installZeroNetworkTripwire,
  seedPendingOrder,
  seedSyntheticTenant,
  signNowPaymentsIpn,
  simulateWorkerRestart,
  type B3SqliteFixture,
} from './b3-revenue-harness';
import { getUserTier } from '@/seed/db/get-user-tier';

let fixture: B3SqliteFixture;
let tripwire: ReturnType<typeof installZeroNetworkTripwire>;
let nowpaymentsRoute: typeof import('@/app/api/webhooks/nowpayments/route');

const envKeys = [
  'NOWPAYMENTS_IPN_SECRET',
  'NOWPAYMENTS_API_KEY',
  'RESEND_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'INNGEST_EVENT_KEY',
] as const;
const savedEnv = new Map<string, string | undefined>();

function postIpn(payload: Record<string, unknown>, sigOverride?: string | null) {
  const rawBody = JSON.stringify(payload);
  const headers: Record<string, string> = {};
  if (sigOverride === undefined) {
    headers['x-nowpayments-sig'] = signNowPaymentsIpn(payload);
  } else if (sigOverride !== null) {
    headers['x-nowpayments-sig'] = sigOverride;
  }
  return dispatchRoute(buildJsonRequest('/api/webhooks/nowpayments', rawBody, headers), nowpaymentsRoute.POST);
}

beforeAll(async () => {
  for (const key of envKeys) savedEnv.set(key, process.env[key]);
  process.env.NOWPAYMENTS_IPN_SECRET = B3_NOWPAYMENTS_SECRET;
  process.env.NOWPAYMENTS_API_KEY = 'b3-synthetic-nowpayments-api-key';
  delete process.env.RESEND_API_KEY;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.INNGEST_EVENT_KEY;
  tripwire = installZeroNetworkTripwire();
  nowpaymentsRoute = await import('@/app/api/webhooks/nowpayments/route');
});

beforeEach(() => {
  fixture?.sqlite.close();
  fixture = createB3SqliteFixture();
  bindD1Globals(fixture.binding);
  seedSyntheticTenant(fixture, { userId: 'usr-alpha', orgId: 'org-alpha', email: 'alpha@example.invalid' });
  seedSyntheticTenant(fixture, { userId: 'usr-beta', orgId: 'org-beta', email: 'beta@example.invalid' });
  simulateWorkerRestart(['usr-alpha', 'usr-beta']);
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

describe.sequential('B3 NOWPayments revenue integrity on disposable local D1', () => {
  it('enforces HMAC-SHA512 authenticity, canonicalization, size cap, and fail-closed secret guard', async () => {
    const payload = {
      payment_id: 'np-auth-1',
      payment_status: 'finished',
      order_id: 'sophia_usr-alpha_1001',
      price_amount: 199,
      price_currency: 'usd',
      pay_amount: 199,
      actually_paid: 199,
      pay_currency: 'usdttrc20',
    };

    expect((await postIpn(payload, null)).status).toBe(400);
    expect((await postIpn(payload, '0'.repeat(128))).status).toBe(400);

    // Wrong canonicalization: sign unsorted raw JSON instead of recursive sorted JSON
    const unsortedSig = createHmac('sha512', B3_NOWPAYMENTS_SECRET).update(JSON.stringify(payload)).digest('hex');
    expect((await postIpn(payload, unsortedSig)).status).toBe(400);

    // Malformed JSON
    const badJson = await dispatchRoute(
      buildJsonRequest('/api/webhooks/nowpayments', '{not-json', { 'x-nowpayments-sig': 'deadbeef' }),
      nowpaymentsRoute.POST,
    );
    expect(badJson.status).toBe(400);

    // Oversized body (>64KB)
    const hugeBody = JSON.stringify({ pad: 'x'.repeat(70_000) });
    const hugeRes = await dispatchRoute(
      buildJsonRequest('/api/webhooks/nowpayments', hugeBody, { 'x-nowpayments-sig': 'deadbeef' }),
      nowpaymentsRoute.POST,
    );
    expect(hugeRes.status).toBe(413);

    // Missing secret fails closed
    delete process.env.NOWPAYMENTS_IPN_SECRET;
    try {
      expect((await postIpn(payload)).status).toBe(500);
    } finally {
      process.env.NOWPAYMENTS_IPN_SECRET = B3_NOWPAYMENTS_SECRET;
    }

    expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM payment_events').get()).toEqual({ n: 0 });
    expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM subscriptions').get()).toEqual({ n: 0 });
  });

  it('activates entitlement once on finished IPN, survives replay and Worker restart, and blocks stale success after refund', async () => {
    const orderId = 'sophia_usr-alpha_2001';
    seedPendingOrder(fixture, {
      orderId,
      userId: 'usr-alpha',
      tier: 'PREMIUM',
      period: 'monthly',
      paymentMethod: 'nowpayments',
      amountUsdCents: 39900,
    });

    const finishedPayload = {
      payment_id: 'np-journey-2001',
      payment_status: 'finished',
      order_id: orderId,
      price_amount: 399,
      price_currency: 'usd',
      pay_amount: 399,
      actually_paid: 399,
      pay_currency: 'usdttrc20',
    };

    // 1. Initial finished delivery activates once
    expect(await getUserTier('usr-alpha')).toBe('BASIC');
    const first = await postIpn(finishedPayload);
    expect(first.status).toBe(200);
    expect(await getUserTier('usr-alpha')).toBe('PREMIUM');
    expect(await getUserTier('usr-beta')).toBe('BASIC');

    const subAfterFirst = fixture.sqlite
      .prepare('SELECT plan, status, current_period_end FROM subscriptions WHERE org_id = ?')
      .get('org-alpha') as { plan: string; status: string; current_period_end: string };
    expect(subAfterFirst).toMatchObject({ plan: 'premium', status: 'active' });

    // 2. Immediate replay is idempotent (no second mutation or period extension)
    const replay = await postIpn(finishedPayload);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ received: true, deduplicated: true });
    const subAfterReplay = fixture.sqlite
      .prepare('SELECT current_period_end FROM subscriptions WHERE org_id = ?')
      .get('org-alpha') as { current_period_end: string };
    expect(subAfterReplay.current_period_end).toBe(subAfterFirst.current_period_end);

    // 3. Simulated Worker restart + replay remains durably idempotent
    simulateWorkerRestart(['usr-alpha', 'usr-beta']);
    const postRestart = await postIpn(finishedPayload);
    expect(postRestart.status).toBe(200);
    expect(await postRestart.json()).toMatchObject({ received: true, deduplicated: true });
    expect(await getUserTier('usr-alpha')).toBe('PREMIUM');

    // 4. Refund cancels entitlement and records durable refund barrier
    const refundPayload = { ...finishedPayload, payment_status: 'refunded' };
    const refunded = await postIpn(refundPayload);
    expect(refunded.status).toBe(200);
    expect(await getUserTier('usr-alpha')).toBe('BASIC');
    expect(
      fixture.sqlite
        .prepare('SELECT payment_id FROM nowpayments_refund_barriers WHERE payment_id = ?')
        .get('np-journey-2001'),
    ).toEqual({ payment_id: 'np-journey-2001' });

    // 5. Duplicate refund replay is idempotent
    const refundReplay = await postIpn(refundPayload);
    expect(refundReplay.status).toBe(200);
    expect(await refundReplay.json()).toMatchObject({ received: true, deduplicated: true });

    // 6. Delayed old finished IPN cannot reactivate refunded entitlement
    simulateWorkerRestart(['usr-alpha']);
    const staleFinished = await postIpn(finishedPayload);
    expect(staleFinished.status).toBe(200);
    expect(await getUserTier('usr-alpha')).toBe('BASIC');
  });

  it('rejects missing price_currency, non-USD currency, tampered amount, underpayment, partially_paid, failed, expired, and unknown order', async () => {
    const orderId = 'sophia_usr-alpha_3001';
    seedPendingOrder(fixture, {
      orderId,
      userId: 'usr-alpha',
      tier: 'PREMIUM',
      period: 'monthly',
      paymentMethod: 'nowpayments',
      amountUsdCents: 39900,
    });

    // Missing price_currency must fail closed (HTTP 400) rather than defaulting to USD
    const missingCurrencyRes = await postIpn({
      payment_id: 'np-neg-missing-currency',
      payment_status: 'finished',
      order_id: orderId,
      price_amount: 399,
      pay_amount: 399,
      actually_paid: 399,
      pay_currency: 'usdttrc20',
    });
    expect(missingCurrencyRes.status).toBe(400);
    expect(await getUserTier('usr-alpha')).toBe('BASIC');

    const cases: Array<{ name: string; payload: Record<string, unknown> }> = [
      {
        name: 'non-USD price_currency',
        payload: {
          payment_id: 'np-neg-currency',
          payment_status: 'finished',
          order_id: orderId,
          price_amount: 399,
          price_currency: 'vnd',
          pay_amount: 399,
          actually_paid: 399,
          pay_currency: 'usdttrc20',
        },
      },
      {
        name: 'tampered fiat price_amount',
        payload: {
          payment_id: 'np-neg-amount',
          payment_status: 'finished',
          order_id: orderId,
          price_amount: 1,
          price_currency: 'usd',
          pay_amount: 1,
          actually_paid: 1,
          pay_currency: 'usdttrc20',
        },
      },
      {
        name: 'crypto underpayment',
        payload: {
          payment_id: 'np-neg-underpaid',
          payment_status: 'finished',
          order_id: orderId,
          price_amount: 399,
          price_currency: 'usd',
          pay_amount: 399,
          actually_paid: 150,
          pay_currency: 'usdttrc20',
        },
      },
      {
        name: 'partially_paid non-terminal status',
        payload: {
          payment_id: 'np-neg-partial',
          payment_status: 'partially_paid',
          order_id: orderId,
          price_amount: 399,
          price_currency: 'usd',
          pay_amount: 399,
          actually_paid: 100,
          pay_currency: 'usdttrc20',
        },
      },
      {
        name: 'failed status',
        payload: {
          payment_id: 'np-neg-failed',
          payment_status: 'failed',
          order_id: orderId,
          price_amount: 399,
          price_currency: 'usd',
        },
      },
      {
        name: 'expired status',
        payload: {
          payment_id: 'np-neg-expired',
          payment_status: 'expired',
          order_id: orderId,
          price_amount: 399,
          price_currency: 'usd',
        },
      },
      {
        name: 'unknown order',
        payload: {
          payment_id: 'np-neg-unknown',
          payment_status: 'finished',
          order_id: 'sophia_usr-alpha_does_not_exist',
          price_amount: 399,
          price_currency: 'usd',
          pay_amount: 399,
          actually_paid: 399,
          pay_currency: 'usdttrc20',
        },
      },
    ];

    for (const c of cases) {
      const res = await postIpn(c.payload);
      expect(res.status, c.name).toBe(200);
      simulateWorkerRestart(['usr-alpha']);
      expect(await getUserTier('usr-alpha'), c.name).toBe('BASIC');
    }
    expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM subscriptions').get()).toEqual({ n: 0 });
  });

  it('enforces single activation under 50 concurrent duplicate deliveries and fails closed on transient D1 failure', async () => {
    const orderId = 'sophia_usr-alpha_4001';
    seedPendingOrder(fixture, {
      orderId,
      userId: 'usr-alpha',
      tier: 'PREMIUM',
      period: 'monthly',
      paymentMethod: 'nowpayments',
      amountUsdCents: 39900,
    });

    // Transient D1 failure on lock insert returns non-2xx for provider retry and mutates zero state
    const failingBinding = createFaultInjectingBinding(fixture.binding, (sql) => sql.includes('payment_events'));
    bindD1Globals(failingBinding);
    const failedRes = await postIpn({
      payment_id: 'np-burst-4001',
      payment_status: 'finished',
      order_id: orderId,
      price_amount: 399,
      price_currency: 'usd',
      pay_amount: 399,
      actually_paid: 399,
      pay_currency: 'usdttrc20',
    });
    expect(failedRes.status).toBe(503);
    bindD1Globals(fixture.binding);
    expect(await getUserTier('usr-alpha')).toBe('BASIC');

    // 50 concurrent duplicate deliveries against shared D1
    const burstPayload = {
      payment_id: 'np-burst-4001',
      payment_status: 'finished',
      order_id: orderId,
      price_amount: 399,
      price_currency: 'usd',
      pay_amount: 399,
      actually_paid: 399,
      pay_currency: 'usdttrc20',
    };
    const results = await Promise.all(Array.from({ length: 50 }, () => postIpn(burstPayload)));
    expect(results.every((r) => r.status === 200 || r.status === 409 || r.status === 500)).toBe(true);
    expect(results.filter((r) => r.status === 200).length).toBeGreaterThanOrEqual(1);
    expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE org_id = ?').get('org-alpha')).toEqual({ n: 1 });
    expect(await getUserTier('usr-alpha')).toBe('PREMIUM');

    // Conflicting payment_id reuse with a different order cannot re-trigger activation
    seedPendingOrder(fixture, {
      orderId: 'sophia_usr-beta_4002',
      userId: 'usr-beta',
      tier: 'ENTERPRISE',
      period: 'monthly',
      paymentMethod: 'nowpayments',
      amountUsdCents: 79900,
    });
    const conflictRes = await postIpn({
      ...burstPayload,
      order_id: 'sophia_usr-beta_4002',
      price_amount: 799,
      pay_amount: 799,
      actually_paid: 799,
    });
    expect(conflictRes.status).toBe(200);
    simulateWorkerRestart(['usr-beta']);
    expect(await getUserTier('usr-beta')).toBe('BASIC');

    // Zero external network requests escaped
    expect(tripwire.blockedFetches).toEqual([]);
  });
});
