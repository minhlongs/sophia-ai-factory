import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  B3_PAYOS_SECRET,
  bindD1Globals,
  buildJsonRequest,
  createB3SqliteFixture,
  createFaultInjectingBinding,
  dispatchRoute,
  installZeroNetworkTripwire,
  seedPendingOrder,
  seedSyntheticTenant,
  signPayOsPayload,
  simulateWorkerRestart,
  type B3SqliteFixture,
} from './b3-revenue-harness';
import { getUserTier } from '@/seed/db/get-user-tier';
import { payOsCanonicalize } from '@/land/payments/payos-gateway/checksum-verifier';

let fixture: B3SqliteFixture;
let tripwire: ReturnType<typeof installZeroNetworkTripwire>;
let payosRoute: typeof import('@/app/api/webhooks/payos/route');
let payosLegacyIpnRoute: typeof import('@/app/api/payos/ipn/route');

const envKeys = ['FEATURE_PAYOS', 'PAYOS_CHECKSUM_KEY', 'RESEND_API_KEY', 'TELEGRAM_BOT_TOKEN'] as const;
const savedEnv = new Map<string, string | undefined>();

function makePayOsData(overrides: Record<string, unknown> = {}) {
  return {
    orderCode: 990001,
    amount: 4975000,
    description: 'Sophia BASIC monthly',
    accountNumber: 'synthetic-acct',
    reference: 'synthetic-ref',
    transactionDateTime: '2026-11-23 10:00:00',
    currency: 'VND',
    paymentLinkId: 'b3-payos-link-990001',
    code: '00',
    desc: 'success',
    ...overrides,
  };
}

function postPayOs(dataOverrides: Record<string, unknown> = {}, sigOverride?: string) {
  const envelope = { code: '00', desc: 'success', success: true, data: makePayOsData(dataOverrides) };
  const signature = sigOverride ?? signPayOsPayload(envelope);
  return dispatchRoute(
    buildJsonRequest('/api/webhooks/payos', JSON.stringify({ ...envelope, signature })),
    payosRoute.POST,
  );
}

beforeAll(async () => {
  for (const key of envKeys) savedEnv.set(key, process.env[key]);
  process.env.FEATURE_PAYOS = 'false';
  process.env.PAYOS_CHECKSUM_KEY = B3_PAYOS_SECRET;
  delete process.env.RESEND_API_KEY;
  delete process.env.TELEGRAM_BOT_TOKEN;
  tripwire = installZeroNetworkTripwire();
  payosRoute = await import('@/app/api/webhooks/payos/route');
  payosLegacyIpnRoute = await import('@/app/api/payos/ipn/route');
});

beforeEach(() => {
  fixture?.sqlite.close();
  fixture = createB3SqliteFixture();
  bindD1Globals(fixture.binding);
  seedSyntheticTenant(fixture, { userId: 'usr-payos-a', orgId: 'org-payos-a', email: 'payosa@example.invalid' });
  seedSyntheticTenant(fixture, { userId: 'usr-payos-b', orgId: 'org-payos-b', email: 'payosb@example.invalid' });
  simulateWorkerRestart(['usr-payos-a', 'usr-payos-b']);
  process.env.FEATURE_PAYOS = 'false';
  process.env.PAYOS_CHECKSUM_KEY = B3_PAYOS_SECRET;
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

describe.sequential('B3 PayOS revenue integrity and FEATURE_PAYOS=false fail-closed gate', () => {
  it('fails closed with HTTP 503 on both PayOS webhook routes when FEATURE_PAYOS=false', async () => {
    seedPendingOrder(fixture, {
      orderId: 'payos-disabled-order',
      userId: 'usr-payos-a',
      tier: 'BASIC',
      period: 'monthly',
      paymentMethod: 'payos',
      amountUsdCents: 19900,
      amountVnd: 4975000,
      providerPaymentId: 'b3-payos-link-990001',
      providerOrderCode: 990001,
    });

    const canonicalRes = await postPayOs();
    expect(canonicalRes.status).toBe(503);

    const envelope = { code: '00', desc: 'success', success: true, data: makePayOsData() };
    const legacyRes = await dispatchRoute(
      buildJsonRequest('/api/payos/ipn', JSON.stringify({ ...envelope, signature: signPayOsPayload(envelope) })),
      payosLegacyIpnRoute.POST,
    );
    expect(legacyRes.status).toBe(503);

    expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM payment_events').get()).toEqual({ n: 0 });
    expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM subscriptions').get()).toEqual({ n: 0 });
    expect(await getUserTier('usr-payos-a')).toBe('BASIC');
  });

  it('verifies PayOS canonicalization (including array element key sorting), invalid signatures, tampering, and test ping', async () => {
    // Official PayOS array-of-objects canonicalization check
    const canonicalWithArray = payOsCanonicalize(
      JSON.stringify({ data: { amount: 1000, items: [{ z: 1, a: 2 }], orderCode: 123 } }),
    );
    expect(canonicalWithArray).toBe('amount=1000&items=[{"a":2,"z":1}]&orderCode=123');

    process.env.FEATURE_PAYOS = 'true';
    try {
      // Invalid signature
      expect((await postPayOs({}, '0'.repeat(64))).status).toBe(400);

      // Modified signed amount (signature computed for 4975000, body altered to 1000)
      const originalEnvelope = { code: '00', desc: 'success', success: true, data: makePayOsData({ amount: 4975000 }) };
      const validSig = signPayOsPayload(originalEnvelope);
      expect((await postPayOs({ amount: 1000 }, validSig)).status).toBe(400);

      // Modified orderCode
      expect((await postPayOs({ orderCode: 999999 }, validSig)).status).toBe(400);

      // Official test ping (orderCode: 123, description: VQRIO123) ignored cleanly with 200 and zero DB writes
      const pingRes = await postPayOs({ orderCode: 123, description: 'VQRIO123', paymentLinkId: 'test-ping' });
      expect(pingRes.status).toBe(200);
      expect(await pingRes.json()).toMatchObject({ received: true, ignored: 'test_ping' });
      expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM payment_events').get()).toEqual({ n: 0 });
    } finally {
      process.env.FEATURE_PAYOS = 'false';
    }
  });

  it('activates once, survives replay and Worker restart, rejects unknown/mismatched/non-success events, and enforces tenant isolation', async () => {
    process.env.FEATURE_PAYOS = 'true';
    try {
      // Unknown order fails closed
      expect((await postPayOs({ orderCode: 777001, paymentLinkId: 'link-unknown' })).status).toBe(400);

      // Seed valid pending order for Org A (PREMIUM monthly)
      seedPendingOrder(fixture, {
        orderId: 'payos-order-a1',
        userId: 'usr-payos-a',
        tier: 'PREMIUM',
        period: 'monthly',
        paymentMethod: 'payos',
        amountUsdCents: 39900,
        amountVnd: 9975000,
        providerPaymentId: 'b3-payos-link-a1',
        providerOrderCode: 990101,
      });

      // Wrong currency (USD instead of VND) rejected
      expect(
        (await postPayOs({ orderCode: 990101, paymentLinkId: 'b3-payos-link-a1', amount: 9975000, currency: 'USD' })).status,
      ).toBe(400);

      // Wrong amount rejected
      expect(
        (await postPayOs({ orderCode: 990101, paymentLinkId: 'b3-payos-link-a1', amount: 100000 })).status,
      ).toBe(400);

      // Valid activation succeeds once
      expect(await getUserTier('usr-payos-a')).toBe('BASIC');
      const okRes = await postPayOs({ orderCode: 990101, paymentLinkId: 'b3-payos-link-a1', amount: 9975000 });
      expect(okRes.status).toBe(200);
      expect(await getUserTier('usr-payos-a')).toBe('PREMIUM');
      expect(await getUserTier('usr-payos-b')).toBe('BASIC');

      const mcuAfterFirst = fixture.sqlite
        .prepare('SELECT credits_remaining FROM user_mcu_balance WHERE user_id = ?')
        .get('usr-payos-a') as { credits_remaining: number };
      expect(mcuAfterFirst.credits_remaining).toBeGreaterThan(50);

      // Replay and post-restart replay remain idempotent
      const replay = await postPayOs({ orderCode: 990101, paymentLinkId: 'b3-payos-link-a1', amount: 9975000 });
      expect(replay.status).toBe(200);
      expect(await replay.json()).toMatchObject({ received: true, duplicate: true });

      simulateWorkerRestart(['usr-payos-a', 'usr-payos-b']);
      const postRestart = await postPayOs({ orderCode: 990101, paymentLinkId: 'b3-payos-link-a1', amount: 9975000 });
      expect(postRestart.status).toBe(200);
      expect(await postRestart.json()).toMatchObject({ received: true, duplicate: true });
      expect(
        (fixture.sqlite
          .prepare('SELECT credits_remaining FROM user_mcu_balance WHERE user_id = ?')
          .get('usr-payos-a') as { credits_remaining: number }).credits_remaining,
      ).toBe(mcuAfterFirst.credits_remaining);

      // Non-success PayOS code ('01') cancels pending order without granting entitlement
      seedPendingOrder(fixture, {
        orderId: 'payos-order-b-fail',
        userId: 'usr-payos-b',
        tier: 'PREMIUM',
        period: 'monthly',
        paymentMethod: 'payos',
        amountUsdCents: 39900,
        amountVnd: 9975000,
        providerPaymentId: 'b3-payos-link-b-fail',
        providerOrderCode: 990102,
      });
      const nonSuccess = await postPayOs({
        orderCode: 990102,
        paymentLinkId: 'b3-payos-link-b-fail',
        amount: 9975000,
        code: '01',
        desc: 'failed',
      });
      expect(nonSuccess.status).toBe(200);
      expect(await getUserTier('usr-payos-b')).toBe('BASIC');
      expect(
        fixture.sqlite.prepare('SELECT status FROM pending_orders WHERE order_id = ?').get('payos-order-b-fail'),
      ).toEqual({ status: 'failed' });
    } finally {
      process.env.FEATURE_PAYOS = 'false';
    }
  });

  it('returns HTTP 503 on transient D1 failure and enforces single activation across 50 concurrent duplicates', async () => {
    process.env.FEATURE_PAYOS = 'true';
    try {
      seedPendingOrder(fixture, {
        orderId: 'payos-order-burst',
        userId: 'usr-payos-b',
        tier: 'BASIC',
        period: 'monthly',
        paymentMethod: 'payos',
        amountUsdCents: 19900,
        amountVnd: 4975000,
        providerPaymentId: 'b3-payos-link-burst',
        providerOrderCode: 990201,
      });

      // Transient D1 failure during idempotency lock returns 503 (retriable), not 422
      bindD1Globals(createFaultInjectingBinding(fixture.binding, (sql) => sql.includes('payment_events')));
      const transientRes = await postPayOs({ orderCode: 990201, paymentLinkId: 'b3-payos-link-burst' });
      expect(transientRes.status).toBe(503);
      bindD1Globals(fixture.binding);
      expect(await getUserTier('usr-payos-b')).toBe('BASIC');

      // 50 concurrent duplicate deliveries
      const burst = await Promise.all(
        Array.from({ length: 50 }, () => postPayOs({ orderCode: 990201, paymentLinkId: 'b3-payos-link-burst' })),
      );
      expect(burst.every((r) => r.status === 200 || r.status === 409)).toBe(true);
      expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE org_id = ?').get('org-payos-b')).toEqual({
        n: 1,
      });
      expect(
        (fixture.sqlite
          .prepare('SELECT credits_remaining FROM user_mcu_balance WHERE user_id = ?')
          .get('usr-payos-b') as { credits_remaining: number }).credits_remaining,
      ).toBe(1050);

      // Zero external network requests escaped
      expect(tripwire.blockedFetches).toEqual([]);
    } finally {
      process.env.FEATURE_PAYOS = 'false';
    }
  });
});
